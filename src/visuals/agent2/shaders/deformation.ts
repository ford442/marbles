/**
 * Enhanced vertex shader with deformation support
 */
export const DEFORMATION_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uImpactTime;
uniform float uImpactForce;
uniform vec3 uImpactNormal;
uniform float uImpactRecovery;
uniform float uAngularVelocity;
uniform vec3 uRollAxis;
uniform float uWobbleTime;
uniform float uWobbleIntensity;

in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vBitangent;
out vec3 vViewDirection;
out vec2 vUv;
out float vDeformationAmount;

// Impact squish deformation
vec3 applyImpactDeformation(vec3 pos, vec3 norm) {
    if (uImpactForce <= 0.0) return pos;
    
    float age = uTime - uImpactTime;
    if (age > uImpactRecovery || age < 0.0) return pos;
    
    float t = age / uImpactRecovery;
    float recovery = exp(-t * 4.0) * sin(t * 3.14159 * 4.0);
    float squish = uImpactForce * 0.3 * recovery;
    
    // Deform along impact normal
    vec3 deformation = -uImpactNormal * squish;
    
    // Bulge perpendicular
    float dist = length(pos);
    vec3 toCenter = normalize(-pos);
    float bulge = squish * 0.3 * (1.0 - dist);
    
    return pos + deformation + toCenter * bulge;
}

// Roll flattening deformation
vec3 applyRollDeformation(vec3 pos, vec3 norm) {
    if (uAngularVelocity <= 0.0) return pos;
    
    float flattenFactor = max(0.0, -norm.y) * uAngularVelocity * 0.05;
    flattenFactor = min(1.0, flattenFactor);
    
    vec3 result = pos;
    result.y -= flattenFactor * 0.1;
    
    // Volume preservation bulge
    float bulge = flattenFactor * 0.05;
    result.x += sign(pos.x) * bulge;
    result.z += sign(pos.z) * bulge;
    
    return result;
}

// Bounce wobble deformation
vec3 applyWobbleDeformation(vec3 pos, vec3 norm) {
    if (uWobbleIntensity <= 0.0 || uWobbleTime > 3.0) return pos;
    
    float decay = exp(-uWobbleTime * 2.0);
    float wobble = sin(uWobbleTime * 10.0) * uWobbleIntensity * decay;
    
    // Spherical harmonic wobble
    float theta = atan(pos.z, pos.x);
    float phi = acos(pos.y / (length(pos) + 0.001));
    
    float harmonic = sin(2.0 * theta) * cos(phi);
    wobble *= harmonic;
    
    return pos + norm * wobble * 0.05;
}

void main() {
    vec3 deformedPos = position;
    
    // Apply deformations in order
    deformedPos = applyImpactDeformation(deformedPos, normal);
    deformedPos = applyRollDeformation(deformedPos, normal);
    deformedPos = applyWobbleDeformation(deformedPos, normal);
    
    // Calculate deformation amount for fragment shader
    vDeformationAmount = length(deformedPos - position);
    
    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(deformedPos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view direction
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewDirection = -viewPosition.xyz;
    
    // Transform normal basis
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

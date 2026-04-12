/**
 * Agent 3: Advanced Rendering Layer - Vertex Shader
 * 
 * Enhanced vertex shader with support for advanced distortion effects
 */

/**
 * Enhanced vertex shader with support for advanced distortion effects
 */
export const ADVANCED_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uDistortionStrength;
uniform float uHeatDistortion;
uniform float uWaveAmplitude;

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
out float vDepth;
out float vFresnel;
out vec4 vScreenPos;

// Heat wave distortion
vec3 heatDistortion(vec3 pos, float time, float strength) {
    float wave1 = sin(pos.x * 15.0 + time * 3.0) * cos(pos.y * 12.0 + time * 2.5);
    float wave2 = cos(pos.z * 10.0 + time * 2.0) * sin(pos.x * 8.0 + time * 1.5);
    return normal * (wave1 + wave2) * strength * 0.02;
}

// Quantum wave interference distortion
vec3 quantumDistortion(vec3 pos, float time, float amplitude) {
    float interference = sin(pos.x * 20.0 + time * 5.0) * 
                         sin(pos.y * 20.0 + time * 4.0) * 
                         sin(pos.z * 20.0 + time * 3.0);
    return normal * interference * amplitude;
}

void main() {
    vec3 pos = position;
    
    // Apply heat distortion for volcanic effect
    pos += heatDistortion(pos, uTime, uHeatDistortion);
    
    // Apply quantum wave distortion
    pos += quantumDistortion(pos, uTime, uWaveAmplitude);
    
    // General vertex distortion
    float distortion = sin(pos.x * 10.0 + uTime * 2.0) * 
                       cos(pos.y * 10.0 + uTime * 1.5) * 
                       sin(pos.z * 10.0 + uTime * 0.5) * 
                       uDistortionStrength;
    pos += normal * distortion;
    
    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view direction
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewDirection = -viewPosition.xyz;
    vDepth = -viewPosition.z;
    vScreenPos = projectionMatrix * viewPosition;
    
    // Transform normal basis to world space
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    // Pre-calculate fresnel
    vec3 viewDir = normalize(vViewDirection);
    vFresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

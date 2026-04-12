/**
 * Velocity-reactive circuit pattern shader
 * Circuit intensity increases with marble velocity
 */
export const VELOCITY_CIRCUIT_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D circuitTexture;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uVelocity;
uniform float uMaxVelocity;
uniform float uCircuitGlow;
uniform float uBaseIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;
out vec4 bloomColor;

// Hexagonal grid UV
vec2 hexGrid(vec2 uv, float scale) {
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(uv * scale, r) - h;
    vec2 b = mod(uv * scale + h, r) - h;
    return dot(a, a) < dot(b, b) ? a : b;
}

// Circuit pattern generator
float circuitPattern(vec2 uv, float velocityRatio) {
    // Base hex grid
    vec2 hexUv = hexGrid(uv, 8.0);
    float hexDist = length(hexUv);
    
    // Circuit lines along hex edges
    float circuitLine = smoothstep(0.15, 0.12, abs(hexDist - 0.25));
    
    // Velocity-reactive energy flow
    float flowSpeed = 2.0 + velocityRatio * 8.0;
    float flow = sin(hexUv.y * 20.0 + uTime * flowSpeed) * 0.5 + 0.5;
    flow *= sin(hexUv.x * 15.0 - uTime * flowSpeed * 0.7) * 0.5 + 0.5;
    
    // Data packets moving along circuits
    float packetPos = fract(uTime * flowSpeed * 0.5 + uv.x * 3.0);
    float packet = smoothstep(0.1, 0.0, abs(packetPos - 0.5));
    packet *= circuitLine;
    
    // Turbulence at high velocities
    float turbulence = texture(noiseTexture, uv * 2.0 + uTime * 0.1).r;
    turbulence = pow(turbulence, 3.0) * velocityRatio;
    
    return circuitLine + packet * (1.0 + velocityRatio) + turbulence * 0.3;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Calculate velocity ratio (0-1)
    float velocityRatio = clamp(uVelocity / uMaxVelocity, 0.0, 1.0);
    
    // Generate velocity-reactive circuit pattern
    float circuit = circuitPattern(vUv, velocityRatio);
    
    // Circuit colors
    vec3 baseColor = vec3(0.05, 0.05, 0.08);
    vec3 circuitColor = mix(
        vec3(0.0, 0.8, 1.0),    // Cyan at rest
        vec3(1.0, 0.2, 0.8),    // Magenta at high speed
        velocityRatio
    );
    
    // Intensity boost with velocity
    float intensity = uBaseIntensity + velocityRatio * uCircuitGlow * 2.0;
    
    // Pulse effect
    float pulse = sin(uTime * 3.0 + velocityRatio * 5.0) * 0.3 + 0.7;
    intensity *= pulse;
    
    // Fresnel rim for energy effect
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 rimColor = circuitColor * fresnel * (0.5 + velocityRatio);
    
    // Combine
    vec3 finalColor = mix(baseColor, circuitColor, circuit * intensity);
    finalColor += rimColor * intensity;
    
    // Reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * 0.1 * (1.0 - circuit);
    
    // Bloom calculation - circuits glow
    vec3 bloom = circuitColor * circuit * intensity * (0.5 + velocityRatio);
    
    fragColor = vec4(finalColor, 0.95);
    bloomColor = vec4(bloom, 1.0);
}
`;

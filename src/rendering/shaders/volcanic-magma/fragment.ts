/**
 * Volcanic Magma Fragment Shader
 * Features: Cracked crust with animated lava, heat shimmer, surface bubbles,
 *           eruption glow, multi-layer emissive
 */

export const VOLCANIC_MAGMA_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D crustTexture;
uniform sampler2D lavaFlowTexture;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uLavaFlowSpeed;
uniform float uHeatIntensity;
uniform float uCrackGlow;
uniform float uBubbleFormation;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;
out vec4 bloomColor;

// Procedural volcanic crust with cracks
float crustPattern(vec2 uv, vec3 worldPos) {
    float crust = 0.0;
    
    // Large cracks
    vec2 p1 = uv * 8.0;
    float c1 = sin(p1.x * 2.0 + sin(p1.y * 3.0)) * 0.5 + 0.5;
    c1 = smoothstep(0.55, 0.6, c1);
    crust += c1 * 0.6;
    
    // Medium cracks
    vec2 p2 = uv * 15.0 + worldPos.xz * 0.5;
    float c2 = sin(p2.y * 3.0 + cos(p2.x * 2.0)) * sin(p2.x * 2.5);
    c2 = smoothstep(0.65, 0.7, c2 * 0.5 + 0.5) * 0.4;
    crust += c2;
    
    // Fine surface detail
    vec2 p3 = uv * 25.0;
    float c3 = sin(p3.x * 5.0) * cos(p3.y * 4.0) * 0.5 + 0.5;
    c3 = pow(c3, 8.0) * 0.2;
    crust += c3;
    
    return min(crust, 1.0);
}

// Animated lava flow through cracks
vec3 lavaFlow(vec2 uv, vec3 worldPos, float time) {
    vec3 lava = vec3(0.0);
    
    // Flow direction with turbulence
    vec2 flowDir = vec2(0.3, -1.0) * uLavaFlowSpeed;
    vec2 flowUv = uv + flowDir * time;
    
    // Turbulent flow
    float turbulence = sin(flowUv.x * 10.0 + time * 2.0) * 
                      cos(flowUv.y * 8.0 - time * 1.5) * 0.3;
    flowUv += vec2(turbulence);
    
    // Primary lava layer - bright orange
    float l1 = sin(flowUv.x * 6.0) * cos(flowUv.y * 4.0 + time);
    l1 = l1 * 0.5 + 0.5;
    l1 = pow(l1, 2.0) * uCrackGlow;
    lava += vec3(1.0, 0.4, 0.05) * l1;
    
    // Secondary lava layer - deeper red
    vec2 flowUv2 = uv * 1.5 + flowDir * time * 0.7 + vec2(0.5);
    float l2 = sin(flowUv2.x * 5.0 + time) * cos(flowUv2.y * 6.0);
    l2 = l2 * 0.5 + 0.5;
    l2 = pow(l2, 3.0) * uCrackGlow * 0.7;
    lava += vec3(1.0, 0.15, 0.0) * l2;
    
    // Hot spots
    float hotSpot = sin(worldPos.x * 4.0 + worldPos.y * 3.0 + time * 0.5) * 0.5 + 0.5;
    hotSpot = pow(hotSpot, 4.0) * 0.5;
    lava += vec3(1.0, 0.6, 0.2) * hotSpot;
    
    return lava;
}

// Surface bubble simulation
float surfaceBubbles(vec2 uv, vec3 worldPos, float time) {
    float bubbles = 0.0;
    
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 offset = vec2(
            sin(fi * 1.5 + time * 0.3) * 0.4,
            cos(fi * 2.0 + time * 0.2) * 0.4
        );
        
        vec2 bubbleUv = uv - 0.5 + offset;
        float dist = length(bubbleUv);
        
        // Bubble formation animation
        float formation = sin(time * 2.0 + fi * 0.8) * 0.5 + 0.5;
        formation = smoothstep(0.3, 0.7, formation);
        
        // Bubble size variation
        float size = 0.02 + 0.04 * fract(fi * 0.7);
        
        float bubble = smoothstep(size, size * 0.5, dist) * formation;
        bubbles += bubble * (1.0 + sin(time * 5.0 + fi) * 0.5);
    }
    
    return bubbles * uBubbleFormation;
}

// Core pulse effect
float corePulse(vec3 worldPos, float time) {
    float dist = length(worldPos) * 2.0;
    float pulse = sin(time * 1.5) * 0.2 + 0.8;
    
    // Inner glow
    float core = exp(-dist * 2.0) * pulse;
    
    // Pulsating ring
    float ring = smoothstep(0.1, 0.15, abs(dist - 0.3 - sin(time) * 0.05));
    
    return core + ring * 0.3;
}

// Heat shimmer calculation for screen-space effect
float heatShimmer(vec2 uv, vec3 worldPos, float time) {
    vec2 p = uv * 20.0 + vec2(0.0, time * 3.0);
    float shimmer = sin(p.x) * cos(p.y) * 0.5 + 0.5;
    shimmer += sin(p.x * 2.0 - time) * cos(p.y * 1.5) * 0.25;
    return shimmer * uHeatIntensity;
}

// Eruption glow - random bright flashes
float eruptionGlow(vec3 worldPos, float time) {
    // Pseudo-random eruption timing
    float eruption1 = sin(time * 0.7 + worldPos.x * 2.0) * 0.5 + 0.5;
    float eruption2 = cos(time * 0.5 + worldPos.z * 1.5) * 0.5 + 0.5;
    
    float combined = eruption1 * eruption2;
    combined = pow(combined, 8.0);
    
    // Sharp flash
    float flash = step(0.95, combined) * (sin(time * 20.0) * 0.5 + 0.5);
    
    return combined * 2.0 + flash * 3.0;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Volcanic rock base color
    vec3 rockColor = vec3(0.15, 0.05, 0.02);
    
    // Crust pattern
    float crust = crustPattern(vUv, vWorldPosition);
    
    // Lava flowing through cracks
    vec3 lava = lavaFlow(vUv, vWorldPosition, uTime);
    
    // Surface bubbles
    float bubbles = surfaceBubbles(vUv, vWorldPosition, uTime);
    vec3 bubbleColor = vec3(1.0, 0.5, 0.1) * bubbles * 2.0;
    
    // Core pulse
    float core = corePulse(vWorldPosition, uTime);
    vec3 coreColor = vec3(1.0, 0.2, 0.0) * core * 1.5;
    
    // Eruption glow
    float eruption = eruptionGlow(vWorldPosition, uTime);
    vec3 eruptionColor = vec3(1.0, 0.6, 0.15) * eruption;
    
    // Surface roughness variation
    float roughness = mix(0.9, 0.4, crust);
    
    // Diffuse lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Specular (molten sheen)
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 16.0 / roughness);
    vec3 specColor = vec3(1.0, 0.7, 0.4) * spec * (1.0 - crust * 0.5);
    
    // Ambient occlusion in cracks
    float ao = 1.0 - crust * 0.4;
    
    // Fresnel for heat glow at edges
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 heatGlow = vec3(1.0, 0.3, 0.05) * fresnel * 2.0;
    
    // Combine all layers
    vec3 finalColor = rockColor * (0.3 + 0.7 * diff) * ao;
    finalColor += lava;
    finalColor += bubbleColor;
    finalColor += coreColor;
    finalColor += eruptionColor;
    finalColor += specColor;
    finalColor += heatGlow;
    
    // Environment reflection (subtle on rock parts)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * 0.05 * (1.0 - crust);
    
    // Bloom calculation - all emissive elements
    vec3 bloom = lava * 0.8 + bubbleColor * 0.5 + coreColor * 0.6 + eruptionColor * 0.9;
    
    fragColor = vec4(finalColor, 1.0);
    bloomColor = vec4(bloom, 1.0);
}
`;

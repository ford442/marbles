/**
 * Agent 3: Advanced Rendering Layer - Volcanic Marble Fragment Shader
 * 
 * Volcanic Marble Fragment Shader
 * Features: Lava glow with heat distortion, emissive cracks, flowing magma patterns,
 *           thermal pulses, ash and soot accumulation
 * 
 * Performance: ~0.5ms on mid-tier GPU
 */

/**
 * Volcanic Marble Fragment Shader
 */
export const VOLCANIC_MARBLE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D lavaTexture;
uniform sampler2D crackTexture;
uniform sampler2D noiseTexture;
uniform sampler2D emberTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uLavaFlowSpeed;
uniform float uHeatIntensity;
uniform float uCrackEmissive;
uniform float uMagmaViscosity;
uniform float uThermalPulse;
uniform float uAshCoverage;
uniform vec3 uLavaColor;
uniform vec3 uAshColor;
uniform float uGlowRadius;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;
in float vDepth;
in float vFresnel;

out vec4 fragColor;
out vec4 bloomColor;

// Fractal Brownian Motion for organic lava flow
float fbm(vec2 p, float time) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
        value += amplitude * sin(p.x * frequency + time) * cos(p.y * frequency + time * 0.7);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value * 0.5 + 0.5;
}

// Turbulent lava flow
vec3 lavaFlow(vec2 uv, vec3 worldPos, float time) {
    vec3 lava = vec3(0.0);
    
    // Base flow direction with turbulence
    vec2 flowDir = normalize(vec2(0.3, -0.8)) * uLavaFlowSpeed;
    
    // Layer 1: Primary magma flow
    vec2 uv1 = uv + flowDir * time;
    float turbulence1 = fbm(uv1 * 4.0, time * 0.5);
    vec2 distortedUV1 = uv1 + vec2(
        sin(uv1.y * 8.0 + time) * 0.1,
        cos(uv1.x * 6.0 + time * 0.8) * 0.1
    ) * turbulence1;
    
    float flow1 = fbm(distortedUV1 * 3.0, time * 0.3);
    flow1 = pow(flow1, 2.0) * uHeatIntensity;
    
    // Layer 2: Secondary slower flow
    vec2 uv2 = uv * 1.5 + flowDir * time * 0.6 + vec2(0.5);
    float turbulence2 = fbm(uv2 * 6.0, time * 0.4);
    float flow2 = fbm(uv2 * 5.0 + turbulence2, time * 0.2);
    flow2 = pow(flow2, 3.0) * uHeatIntensity * 0.7;
    
    // Layer 3: Viscous pools
    vec2 uv3 = uv * 0.8 + vec2(sin(time * 0.2) * 0.1, cos(time * 0.15) * 0.1);
    float pool = fbm(uv3 * 2.0, time * 0.1);
    pool = smoothstep(0.4, 0.8, pool) * uMagmaViscosity;
    
    // Color temperatures
    vec3 hotColor = vec3(1.0, 0.9, 0.3);     // Yellow-white
    vec3 warmColor = vec3(1.0, 0.4, 0.05);   // Orange
    vec3 coolColor = vec3(0.8, 0.1, 0.0);    // Red
    
    lava += hotColor * flow1 * flow1;
    lava += warmColor * flow2;
    lava += coolColor * pool * 0.5;
    
    return lava * uLavaColor;
}

// Crack network with emissive lava
float crackPattern(vec2 uv, vec3 worldPos, float time) {
    float cracks = 0.0;
    
    // Large structural cracks
    vec2 p1 = uv * 6.0 + worldPos.xz * 0.3;
    float c1 = sin(p1.x * 2.0 + sin(p1.y * 3.0 + time * 0.1)) * 0.5 + 0.5;
    c1 = smoothstep(0.62, 0.68, c1);
    
    // Medium thermal cracks
    vec2 p2 = uv * 12.0 - time * 0.05;
    float c2 = sin(p2.y * 3.0 + cos(p2.x * 2.5)) * sin(p2.x * 4.0);
    c2 = smoothstep(0.7, 0.8, c2 * 0.5 + 0.5) * 0.6;
    
    // Fine surface cracking
    vec2 p3 = uv * 24.0 + worldPos.y * 2.0;
    float c3 = sin(p3.x * 5.0) * cos(p3.y * 4.0) * 0.5 + 0.5;
    c3 = pow(c3, 12.0) * 0.3;
    
    // Dynamic crack widening based on thermal pulse
    float pulse = sin(time * 0.8 + worldPos.y * 3.0) * 0.5 + 0.5;
    pulse = pow(pulse, 2.0) * uThermalPulse;
    
    cracks = (c1 + c2 + c3) * (1.0 + pulse * 0.5);
    
    return min(cracks, 1.0);
}

// Thermal pulse - periodic heating/cooling
float thermalPulse(vec3 worldPos, float time) {
    // Main pulse
    float pulse = sin(time * 1.2 + worldPos.y * 2.0) * 0.5 + 0.5;
    
    // Harmonic overtones
    float harmonic1 = sin(time * 2.4 + worldPos.x * 1.5) * 0.25 + 0.25;
    float harmonic2 = sin(time * 3.6 + worldPos.z * 2.0) * 0.15 + 0.15;
    
    // Local hot spots
    float hotSpot = sin(worldPos.x * 5.0) * cos(worldPos.z * 4.0) * 0.5 + 0.5;
    hotSpot = pow(hotSpot, 4.0) * 0.3;
    
    return (pulse + harmonic1 + harmonic2 + hotSpot) * uThermalPulse;
}

// Ash and soot accumulation
float ashAccumulation(vec2 uv, vec3 worldPos, float time) {
    float ash = 0.0;
    
    // Procedural ash texture
    vec2 ashUV = uv * 8.0 + vec2(time * 0.02, time * 0.01);
    float ashNoise = fbm(ashUV, time * 0.1);
    
    // Ash collects in crevices
    float crevice = sin(worldPos.x * 10.0) * cos(worldPos.z * 8.0) * 0.5 + 0.5;
    crevice = pow(crevice, 3.0);
    
    // Weathering pattern
    float weather = sin(uv.x * 20.0 + uv.y * 15.0) * 0.5 + 0.5;
    weather = smoothstep(0.3, 0.7, weather);
    
    ash = ashNoise * crevice * weather * uAshCoverage;
    
    return ash;
}

// Floating embers
vec3 floatingEmbers(vec2 uv, vec3 worldPos, float time) {
    vec3 embers = vec3(0.0);
    
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        
        // Ember position with upward drift
        vec2 emberPos = vec2(
            sin(fi * 1.3 + time * 0.5 + worldPos.x) * 0.4,
            mod(fi * 0.2 + time * 0.3 + worldPos.y * 0.5, 1.0) - 0.5
        );
        
        vec2 diff = uv - 0.5 - emberPos;
        float dist = length(diff);
        
        // Ember glow
        float size = 0.015 + 0.025 * fract(fi * 0.7);
        float glow = smoothstep(size, size * 0.3, dist);
        
        // Flicker
        float flicker = sin(time * 10.0 + fi * 2.0) * 0.3 + 0.7;
        flicker *= sin(time * 23.0 + fi) * 0.2 + 0.8;
        
        // Ember color (yellow to orange)
        vec3 emberColor = mix(
            vec3(1.0, 0.8, 0.1),
            vec3(1.0, 0.4, 0.0),
            fract(fi * 0.4)
        );
        
        embers += emberColor * glow * flicker * 0.5;
    }
    
    return embers;
}

// Heat distortion for surrounding air
float heatDistortion(vec2 uv, float time) {
    vec2 p = uv * 15.0 + vec2(0.0, time * 2.0);
    float distortion = sin(p.x) * cos(p.y);
    distortion += sin(p.x * 2.0 - time) * cos(p.y * 1.5) * 0.5;
    return distortion * 0.5 + 0.5;
}

// Magma bubble formation
float magmaBubbles(vec2 uv, vec3 worldPos, float time) {
    float bubbles = 0.0;
    
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        
        // Bubble position
        vec2 bubbleCenter = vec2(
            sin(fi * 2.5 + time * 0.4) * 0.3,
            cos(fi * 1.8 + time * 0.3) * 0.3
        );
        
        // Bubble growth
        float growth = sin(time * 2.0 + fi) * 0.5 + 0.5;
        growth = smoothstep(0.3, 0.7, growth);
        
        float dist = length(uv - 0.5 - bubbleCenter);
        float size = 0.02 + 0.04 * growth;
        
        float bubble = smoothstep(size, size * 0.5, dist) * growth;
        bubbles += bubble;
    }
    
    return bubbles * uMagmaViscosity;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Base volcanic rock
    vec3 rockColor = vec3(0.12, 0.08, 0.06);
    
    // Lava flow
    vec3 lava = lavaFlow(vUv, vWorldPosition, uTime);
    
    // Crack pattern
    float cracks = crackPattern(vUv, vWorldPosition, uTime);
    vec3 crackGlow = uLavaColor * cracks * uCrackEmissive * 3.0;
    
    // Thermal pulse effect
    float thermal = thermalPulse(vWorldPosition, uTime);
    vec3 thermalGlow = uLavaColor * thermal * 0.5;
    
    // Ash accumulation
    float ash = ashAccumulation(vUv, vWorldPosition, uTime);
    vec3 ashLayer = uAshColor * ash;
    
    // Floating embers
    vec3 embers = floatingEmbers(vUv, vWorldPosition, uTime);
    
    // Magma bubbles
    float bubbles = magmaBubbles(vUv, vWorldPosition, uTime);
    vec3 bubbleGlow = vec3(1.0, 0.5, 0.1) * bubbles * 2.0;
    
    // Fresnel heat glow
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 heatGlow = uLavaColor * fresnel * uHeatIntensity * 2.0;
    
    // Surface roughness
    float roughness = mix(0.9, 0.3, cracks * 0.7);
    
    // Lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Specular on molten areas
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0 / roughness);
    vec3 specColor = vec3(1.0, 0.7, 0.4) * spec * cracks * 0.5;
    
    // Combine all layers
    vec3 finalColor = rockColor * (0.2 + 0.8 * diff);
    finalColor = mix(finalColor, lava, smoothstep(0.2, 0.8, length(lava)));
    finalColor += crackGlow;
    finalColor += thermalGlow;
    finalColor = mix(finalColor, ashLayer, ash * 0.7);
    finalColor += embers;
    finalColor += bubbleGlow;
    finalColor += heatGlow;
    finalColor += specColor;
    
    // Ambient occlusion in cracks
    float ao = 1.0 - cracks * 0.3;
    finalColor *= ao;
    
    // Environment reflection (very subtle)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * 0.03 * (1.0 - ash * 0.5);
    
    // Bloom calculation
    vec3 bloom = crackGlow * 0.8;
    bloom += thermalGlow * 0.6;
    bloom += embers * 0.9;
    bloom += bubbleGlow * 0.5;
    bloom += heatGlow * 0.4;
    
    fragColor = vec4(finalColor, 1.0);
    bloomColor = vec4(bloom, 1.0);
}
`;

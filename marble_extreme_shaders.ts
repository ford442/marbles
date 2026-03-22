/**
 * EXTREME LEVEL MARBLE SHADERS - Multi-Agent Swarm Visual Overhaul
 * Shadow Ninja & Volcanic Magma - Agent 3 Implementation
 * 
 * Add these to marble_rendering_layer.ts
 */

// ============================================================================
// AGENT 3: SHADOW NINJA - VOID ABSORPTION SHADER
// ============================================================================

/**
 * Custom Fragment Shader: Shadow Ninja
 * Features: Void absorption (light-draining), smoke wisps, shadow tendrils,
 *           purple rim lighting, ethereal distortion
 */
const SHADOW_NINJA_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D voidNoiseTexture;
uniform sampler2D shadowTendrilTexture;
uniform sampler2D smokeWispTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uVoidAbsorption;
uniform float uSmokeIntensity;
uniform float uRimLightPower;
uniform float uDistortionStrength;
uniform float uShadowSpeed;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;
out vec4 bloomColor;

// Void noise - multi-layered darkness
float voidNoise(vec3 pos, float time) {
    float noise = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
        vec3 p = pos * frequency + time * uShadowSpeed * float(i + 1);
        noise += sin(p.x) * cos(p.y) * sin(p.z) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.5;
    }
    
    return noise * 0.5 + 0.5;
}

// Shadow tendril pattern
float shadowTendrils(vec2 uv, vec3 worldPos, float time) {
    float tendrils = 0.0;
    
    // Primary tendrils
    vec2 p1 = uv * 6.0 + time * 0.3;
    float t1 = sin(p1.x + sin(p1.y * 2.0 + time * 0.5)) * 0.5 + 0.5;
    tendrils += smoothstep(0.6, 0.65, t1) * 0.7;
    
    // Secondary tendrils
    vec2 p2 = uv * 10.0 - time * 0.2;
    float t2 = sin(p2.y + cos(p2.x * 1.5)) * 0.5 + 0.5;
    tendrils += smoothstep(0.7, 0.75, t2) * 0.4;
    
    // World-space variation
    float worldVar = sin(worldPos.x * 3.0 + worldPos.z * 2.0) * 0.3 + 0.7;
    
    return tendrils * worldVar;
}

// Smoke wisp overlay
vec3 smokeWisps(vec2 uv, vec3 worldPos, float time) {
    vec3 smoke = vec3(0.0);
    
    // Layer 1: Slow drifting smoke
    vec2 s1 = uv * 4.0 + vec2(time * 0.1, time * 0.15);
    float n1 = sin(s1.x * 3.0) * cos(s1.y * 2.0);
    n1 += sin(s1.x * 7.0 - time * 0.3) * 0.5;
    smoke += vec3(0.1, 0.05, 0.15) * (n1 * 0.5 + 0.5) * 0.4;
    
    // Layer 2: Faster ethereal wisps
    vec2 s2 = uv * 8.0 + vec2(-time * 0.2, time * 0.1);
    float n2 = sin(s2.x * 5.0 + s2.y * 3.0) * sin(s2.y * 4.0);
    smoke += vec3(0.15, 0.08, 0.2) * (n2 * 0.5 + 0.5) * 0.3;
    
    return smoke * uSmokeIntensity;
}

// Void absorption - darkens nearby areas
float calculateVoidAbsorption(vec3 worldPos, vec3 viewDir, vec3 normal) {
    float centerDarkness = voidNoise(worldPos * 2.0, uTime * 0.5);
    
    // Edge falloff for absorption effect
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.0);
    
    // Pulsing void core
    float pulse = sin(uTime * 1.5) * 0.2 + 0.8;
    
    return centerDarkness * fresnel * pulse * uVoidAbsorption;
}

// Purple rim light calculation
vec3 calculateRimLight(vec3 viewDir, vec3 normal, float power) {
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), power);
    
    // Color variation based on angle
    vec3 rimColor1 = vec3(0.6, 0.2, 0.9);  // Bright purple
    vec3 rimColor2 = vec3(0.3, 0.1, 0.5);  // Darker purple
    
    float angleVar = sin(atan(normal.y, normal.x) * 3.0 + uTime) * 0.5 + 0.5;
    vec3 rimColor = mix(rimColor1, rimColor2, angleVar);
    
    return rimColor * fresnel * 3.0;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Base void color - deep purple-black
    vec3 baseColor = vec3(0.01, 0.01, 0.015);
    
    // Void noise texture
    float voidTex = voidNoise(vWorldPosition * 8.0, uTime * 0.3);
    baseColor *= (0.7 + voidTex * 0.6);
    
    // Shadow tendrils
    float tendrils = shadowTendrils(vUv, vWorldPosition, uTime);
    vec3 tendrilColor = vec3(0.02, 0.01, 0.03) * tendrils;
    
    // Smoke wisps
    vec3 smoke = smokeWisps(vUv, vWorldPosition, uTime);
    
    // Environment reflection (very subtle for void)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    reflection *= 0.15;  // Very muted reflection
    
    // Void absorption effect
    float absorption = calculateVoidAbsorption(vWorldPosition, viewDir, normal);
    vec3 absorptionColor = vec3(0.0) * absorption;
    
    // Purple rim light
    vec3 rimLight = calculateRimLight(viewDir, normal, uRimLightPower);
    
    // Emissive smoke glow
    float emissiveSmoke = voidNoise(vWorldPosition * 4.0 + uTime * 0.5, uTime * 0.2);
    vec3 emissiveColor = vec3(0.4, 0.1, 0.6) * emissiveSmoke * 0.5;
    
    // Combine all layers
    vec3 finalColor = baseColor;
    finalColor += tendrilColor;
    finalColor += smoke;
    finalColor += reflection;
    finalColor += absorptionColor;
    finalColor += rimLight;
    finalColor += emissiveColor;
    
    // Edge darkening (void characteristic)
    float edgeDarken = pow(abs(dot(viewDir, normal)), 0.5);
    finalColor *= mix(0.3, 1.0, edgeDarken);
    
    // Subsurface scattering approximation
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float wrap = 0.6;
    float sss = max(dot(normal, lightDir) + wrap, 0.0) / ((1.0 + wrap) * (1.0 + wrap));
    finalColor += vec3(0.05, 0.02, 0.08) * sss * 0.3;
    
    // Bloom calculation (rim light and emissive smoke)
    vec3 bloom = rimLight * 0.8 + emissiveColor * 0.5;
    float bloomLuma = dot(bloom, vec3(0.299, 0.587, 0.114));
    bloom = mix(vec3(0.0), bloom, smoothstep(0.3, 0.8, bloomLuma));
    
    fragColor = vec4(finalColor, 1.0);
    bloomColor = vec4(bloom, 1.0);
}
`;

// ============================================================================
// AGENT 3: VOLCANIC MAGMA - LAVA FLOW SHADER
// ============================================================================

/**
 * Custom Fragment Shader: Volcanic Magma
 * Features: Cracked crust with animated lava, heat shimmer, surface bubbles,
 *           eruption glow, multi-layer emissive
 */
const VOLCANIC_MAGMA_FRAGMENT_SHADER = `
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

// ============================================================================
// AGENT 4: MATERIAL CONFIGURATIONS
// ============================================================================

export const ShadowNinjaMaterialConfig = {
  name: 'ShadowNinjaExtreme',
  vertexShader: 'MARBLE_VERTEX_SHADER',  // Reference to existing vertex shader
  fragmentShader: SHADOW_NINJA_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uVoidAbsorption: { type: 'float', value: 0.7 },
    uSmokeIntensity: { type: 'float', value: 0.5 },
    uRimLightPower: { type: 'float', value: 2.5 },
    uDistortionStrength: { type: 'float', value: 0.05 },
    uShadowSpeed: { type: 'float', value: 0.3 },
    voidNoiseTexture: { type: 'sampler2D', value: null },
    shadowTendrilTexture: { type: 'sampler2D', value: null },
    smokeWispTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

export const VolcanicMagmaMaterialConfig = {
  name: 'VolcanicMagmaExtreme',
  vertexShader: 'MARBLE_VERTEX_SHADER',  // Reference to existing vertex shader
  fragmentShader: VOLCANIC_MAGMA_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uLavaFlowSpeed: { type: 'float', value: 0.6 },
    uHeatIntensity: { type: 'float', value: 1.5 },
    uCrackGlow: { type: 'float', value: 0.7 },
    uBubbleFormation: { type: 'float', value: 0.8 },
    crustTexture: { type: 'sampler2D', value: null },
    lavaFlowTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

// ============================================================================
// AGENT 4: PARTICLE EFFECT CONFIGURATIONS
// ============================================================================

export const ShadowNinjaParticleEffects = [
  {
    name: 'ShadowTrail',
    maxParticles: 200,
    emissionRate: 40,
    lifetime: { min: 0.8, max: 1.5 },
    size: { start: 0.15, end: 0.0 },
    color: {
      start: [0.1, 0.05, 0.15, 0.6],
      end: [0.05, 0.02, 0.08, 0.0]
    },
    velocity: { type: 'directional', speed: 0.5, spread: 0.3 },
    acceleration: [0, 0.3, 0],
    texture: 'particle_shadow_wisp.png',
    blending: 'additive',
    trigger: 'continuous'
  },
  {
    name: 'VoidSparkle',
    maxParticles: 100,
    emissionRate: 0,
    lifetime: { min: 0.3, max: 0.8 },
    size: { start: 0.08, end: 0.0 },
    color: {
      start: [0.5, 0.2, 0.8, 0.9],
      end: [0.2, 0.05, 0.4, 0.0]
    },
    velocity: { type: 'radial', speed: 3.0, spread: 1.0 },
    acceleration: [0, -1.0, 0],
    texture: 'particle_purple_spark.png',
    blending: 'additive',
    trigger: 'speed',
    triggerThreshold: 4.0
  },
  {
    name: 'ShadowBurst',
    maxParticles: 80,
    emissionRate: 0,
    lifetime: { min: 0.4, max: 1.0 },
    size: { start: 0.2, end: 0.0 },
    color: {
      start: [0.2, 0.1, 0.3, 0.8],
      end: [0.0, 0.0, 0.0, 0.0]
    },
    velocity: { type: 'burst', speed: 6.0, spread: 1.0 },
    acceleration: [0, -2.0, 0],
    texture: 'particle_shadow_burst.png',
    blending: 'additive',
    trigger: 'impact',
    triggerThreshold: 2.5
  },
  {
    name: 'NinjaDash',
    maxParticles: 150,
    emissionRate: 80,
    lifetime: { min: 0.1, max: 0.3 },
    size: { start: 0.25, end: 0.05 },
    color: {
      start: [0.3, 0.1, 0.5, 0.7],
      end: [0.1, 0.05, 0.2, 0.0]
    },
    velocity: { type: 'directional', speed: -12.0, spread: 0.2 },
    acceleration: [0, 0, 0],
    texture: 'particle_dash_streak.png',
    blending: 'additive',
    trigger: 'boost'
  }
];

export const VolcanicMagmaParticleEffects = [
  {
    name: 'HeatShimmer',
    maxParticles: 50,
    emissionRate: 15,
    lifetime: { min: 0.5, max: 1.2 },
    size: { start: 0.3, end: 0.6 },
    color: {
      start: [1.0, 0.4, 0.1, 0.2],
      end: [1.0, 0.6, 0.3, 0.0]
    },
    velocity: { type: 'directional', speed: 1.5, spread: 0.5, direction: [0, 1, 0] },
    acceleration: [0, 0.8, 0],
    texture: 'particle_heat_wave.png',
    blending: 'additive',
    trigger: 'continuous'
  },
  {
    name: 'LavaSparks',
    maxParticles: 150,
    emissionRate: 0,
    lifetime: { min: 0.2, max: 0.7 },
    size: { start: 0.06, end: 0.0 },
    color: {
      start: [1.0, 0.8, 0.2, 1.0],
      end: [0.8, 0.2, 0.0, 0.0]
    },
    velocity: { type: 'burst', speed: 10.0, spread: 0.8 },
    acceleration: [0, -8.0, 0],
    texture: 'particle_lava_spark.png',
    blending: 'additive',
    trigger: 'speed',
    triggerThreshold: 5.0
  },
  {
    name: 'EruptionBurst',
    maxParticles: 100,
    emissionRate: 0,
    lifetime: { min: 0.3, max: 0.9 },
    size: { start: 0.25, end: 0.0 },
    color: {
      start: [1.0, 0.5, 0.1, 0.9],
      end: [0.5, 0.1, 0.0, 0.0]
    },
    velocity: { type: 'burst', speed: 12.0, spread: 1.0 },
    acceleration: [0, -6.0, 0],
    texture: 'particle_eruption_fire.png',
    blending: 'additive',
    trigger: 'impact',
    triggerThreshold: 3.0
  },
  {
    name: 'MagmaTrail',
    maxParticles: 120,
    emissionRate: 35,
    lifetime: { min: 0.6, max: 1.2 },
    size: { start: 0.18, end: 0.05 },
    color: {
      start: [1.0, 0.3, 0.05, 0.7],
      end: [0.4, 0.1, 0.02, 0.0]
    },
    velocity: { type: 'directional', speed: 0.3, spread: 0.2 },
    acceleration: [0, 0, 0],
    texture: 'particle_magma_drip.png',
    blending: 'additive',
    trigger: 'continuous'
  },
  {
    name: 'VolcanicBoost',
    maxParticles: 200,
    emissionRate: 100,
    lifetime: { min: 0.15, max: 0.4 },
    size: { start: 0.3, end: 0.1 },
    color: {
      start: [1.0, 0.6, 0.1, 0.9],
      end: [0.8, 0.1, 0.0, 0.0]
    },
    velocity: { type: 'directional', speed: -15.0, spread: 0.4 },
    acceleration: [0, 0.5, 0],
    texture: 'particle_fire_jet.png',
    blending: 'additive',
    trigger: 'boost'
  },
  {
    name: 'SmokePlume',
    maxParticles: 80,
    emissionRate: 20,
    lifetime: { min: 1.0, max: 2.0 },
    size: { start: 0.2, end: 0.5 },
    color: {
      start: [0.3, 0.3, 0.3, 0.4],
      end: [0.2, 0.2, 0.2, 0.0]
    },
    velocity: { type: 'directional', speed: 2.0, spread: 0.6, direction: [0, 1, 0] },
    acceleration: [0, 1.2, 0],
    texture: 'particle_volcanic_smoke.png',
    blending: 'normal',
    trigger: 'continuous'
  }
];

// ============================================================================
// AGENT 4: POST-PROCESS CONFIGURATIONS
// ============================================================================

export const ShadowNinjaPostProcess = {
  bloom: {
    enabled: true,
    intensity: 1.8,
    threshold: 0.4,
    radius: 0.9,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.6,
    samples: 14
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.015
  },
  vignette: {
    enabled: true,
    intensity: 0.4,
    smoothness: 0.8,
    color: [0.02, 0.01, 0.04]
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.05,
    thickness: 0.08
  },
  colorGrading: {
    enabled: true,
    contrast: 1.25,
    saturation: 0.75,
    tint: [0.85, 0.8, 1.0]
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.5,
    radius: 0.5
  }
};

export const VolcanicMagmaPostProcess = {
  bloom: {
    enabled: true,
    intensity: 3.5,
    threshold: 0.25,
    radius: 1.2,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 12
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.02
  },
  vignette: {
    enabled: true,
    intensity: 0.25,
    smoothness: 0.6,
    color: [0.1, 0.02, 0.0]
  },
  screenSpaceReflections: {
    enabled: false
  },
  colorGrading: {
    enabled: true,
    contrast: 1.3,
    saturation: 1.4,
    tint: [1.1, 0.95, 0.85]
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.2,
    radius: 0.4
  },
  heatDistortion: {
    enabled: true,
    strength: 0.06,
    speed: 3.0
  }
};

// ============================================================================
// AGENT 4: COMPLETE RENDERING PACKAGES
// ============================================================================

export const ShadowNinjaExtremeMarble = {
  name: 'ShadowNinjaExtreme',
  materialConfig: ShadowNinjaMaterialConfig,
  particleEffects: ShadowNinjaParticleEffects,
  postProcessConfig: ShadowNinjaPostProcess,
  lodConfig: {
    levels: [
      {
        distance: 0,
        mesh: 'marble_shadow_ninja_lod0.glb',
        material: 'shadow_ninja_full',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 15,
        mesh: 'marble_shadow_ninja_lod1.glb',
        material: 'shadow_ninja_medium',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 40,
        mesh: 'marble_shadow_ninja_lod2.glb',
        material: 'shadow_ninja_low',
        shadowCasting: false,
        receiveShadows: true
      }
    ],
    impostor: {
      enabled: true,
      distance: 80,
      textureResolution: 256,
      updateRate: 8,
      billboardMode: 'spherical'
    },
    instancing: {
      enabled: true,
      maxInstances: 100,
      frustumCulling: true,
      occlusionCulling: true,
      dynamicBatching: true
    }
  }
};

export const VolcanicMagmaExtremeMarble = {
  name: 'VolcanicMagmaExtreme',
  materialConfig: VolcanicMagmaMaterialConfig,
  particleEffects: VolcanicMagmaParticleEffects,
  postProcessConfig: VolcanicMagmaPostProcess,
  lodConfig: {
    levels: [
      {
        distance: 0,
        mesh: 'marble_volcanic_magma_lod0.glb',
        material: 'volcanic_magma_full',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 12,
        mesh: 'marble_volcanic_magma_lod1.glb',
        material: 'volcanic_magma_medium',
        shadowCasting: true,
        receiveShadows: true
      },
      {
        distance: 35,
        mesh: 'marble_volcanic_magma_lod2.glb',
        material: 'volcanic_magma_low',
        shadowCasting: false,
        receiveShadows: true
      }
    ],
    impostor: {
      enabled: true,
      distance: 70,
      textureResolution: 256,
      updateRate: 10,
      billboardMode: 'spherical'
    },
    instancing: {
      enabled: true,
      maxInstances: 100,
      frustumCulling: true,
      occlusionCulling: true,
      dynamicBatching: true
    }
  }
};

// Export all shader source for external use
export const ExtremeShaderSource = {
  shadowNinjaFragment: SHADOW_NINJA_FRAGMENT_SHADER,
  volcanicMagmaFragment: VOLCANIC_MAGMA_FRAGMENT_SHADER
};

// Integration helper - add to AllMarbleRenderingPackages
export const AllExtremeMarbles = [
  ShadowNinjaExtremeMarble,
  VolcanicMagmaExtremeMarble
];

/**
 * Shared utilities and constants for marble shaders
 */

// Galactic Core Fragment Shader
export const GALACTIC_CORE_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform float uTime;
uniform float uCoreEnergy;
uniform float uStarDensity;
uniform float uAccretionSpeed;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;

void material(inout MaterialInputs material) {
    prepareMaterial(material);

    vec3 normal = normalize(shading_normal);
    vec3 viewDir = normalize(cameraPosition - getWorldPosition());
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    // Core energy simulation using noise
    vec2 uv = getUV0();
    float noiseVal = texture(noiseTexture, uv * 2.0 + uTime * uAccretionSpeed).r;

    // Deep space blue/purple palette
    vec3 coreColor = vec3(0.1, 0.4, 1.0);
    vec3 edgeColor = vec3(0.6, 0.1, 0.8);
    vec3 accretionColor = vec3(0.0, 0.8, 1.0);

    // Mix colors based on fresnel and noise
    vec3 baseColor = mix(coreColor, edgeColor, fresnel);
    baseColor += accretionColor * noiseVal * uCoreEnergy;

    // Stars
    float starNoise = texture(noiseTexture, uv * uStarDensity).g;
    float stars = step(0.95, starNoise) * (sin(uTime * 5.0 + starNoise * 10.0) * 0.5 + 0.5);
    baseColor += vec3(1.0) * stars;

    // Emission
    vec3 emission = baseColor * uCoreEnergy * (1.0 + fresnel * 2.0);

    material.baseColor = vec4(baseColor, 1.0);
    material.metallic = 0.9;
    material.roughness = 0.1 + noiseVal * 0.2;
    material.emissive = vec4(emission, 1.0);
}
`;

// ============================================================================
// Material Configurations
// ============================================================================

export const ShadowNinjaMaterialConfig = {
  name: 'ShadowNinjaExtreme',
  vertexShader: 'MARBLE_VERTEX_SHADER',  // Reference to existing vertex shader
  fragmentShader: 'SHADOW_NINJA_FRAGMENT_SHADER',  // Will be replaced with actual import
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
  fragmentShader: 'VOLCANIC_MAGMA_FRAGMENT_SHADER',  // Will be replaced with actual import
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

export const GalacticCoreMaterialConfig = {
  name: 'GalacticCoreExtreme',
  vertexShader: 'MARBLE_VERTEX_SHADER',
  fragmentShader: 'GALACTIC_CORE_FRAGMENT_SHADER',
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uCoreEnergy: { type: 'float', value: 2.5 },
    uStarDensity: { type: 'float', value: 15.0 },
    uAccretionSpeed: { type: 'float', value: 0.4 },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

// ============================================================================
// Particle Effect Configurations
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

export const GalacticCoreParticleEffects = [
  {
    name: 'CosmicDust',
    maxParticles: 300,
    emissionRate: 50,
    lifetime: { min: 1.0, max: 2.5 },
    size: { start: 0.1, end: 0.0 },
    color: {
      start: [0.1, 0.4, 1.0, 0.8],
      end: [0.6, 0.1, 0.8, 0.0]
    },
    velocity: { type: 'directional', speed: 0.8, spread: 0.5 },
    acceleration: [0, 0.1, 0],
    texture: 'particle_star.png',
    blending: 'additive',
    trigger: 'continuous'
  },
  {
    name: 'NovaBurst',
    maxParticles: 150,
    emissionRate: 0,
    lifetime: { min: 0.5, max: 1.2 },
    size: { start: 0.3, end: 0.0 },
    color: {
      start: [0.0, 0.8, 1.0, 1.0],
      end: [0.1, 0.2, 1.0, 0.0]
    },
    velocity: { type: 'burst', speed: 8.0, spread: 1.0 },
    acceleration: [0, -1.0, 0],
    texture: 'particle_nova.png',
    blending: 'additive',
    trigger: 'impact',
    triggerThreshold: 3.5
  },
  {
    name: 'WarpTrail',
    maxParticles: 200,
    emissionRate: 100,
    lifetime: { min: 0.2, max: 0.6 },
    size: { start: 0.2, end: 0.05 },
    color: {
      start: [0.4, 0.8, 1.0, 0.9],
      end: [0.1, 0.2, 0.8, 0.0]
    },
    velocity: { type: 'directional', speed: -20.0, spread: 0.1 },
    acceleration: [0, 0, 0],
    texture: 'particle_warp_streak.png',
    blending: 'additive',
    trigger: 'boost'
  }
];

// ============================================================================
// Post-Process Configurations
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

export const GalacticCorePostProcess = {
  bloom: {
    enabled: true,
    intensity: 2.5,
    threshold: 0.3,
    radius: 1.0,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.8,
    samples: 16
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.025
  },
  vignette: {
    enabled: true,
    intensity: 0.5,
    smoothness: 0.7,
    color: [0.01, 0.02, 0.05]
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 48,
    stepSize: 0.06,
    thickness: 0.1
  },
  colorGrading: {
    enabled: true,
    contrast: 1.4,
    saturation: 1.2,
    tint: [0.9, 0.95, 1.1]
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.0,
    radius: 0.6
  }
};

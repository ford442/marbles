/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Types and Interfaces
 */

// ============================================================================
// MATERIAL CONFIGURATION
// ============================================================================

export interface MarbleMaterialConfig {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: any }>;
  blending: 'opaque' | 'transparent' | 'additive';
  depthWrite: boolean;
  cullFace: 'front' | 'back' | 'none';
}

// ============================================================================
// PARTICLE EFFECT SYSTEMS
// ============================================================================

export interface ParticleEffect {
  name: string;
  maxParticles: number;
  emissionRate: number;
  lifetime: { min: number; max: number };
  size: { start: number; end: number };
  color: { start: [number, number, number, number]; end: [number, number, number, number] };
  velocity: { type: 'radial' | 'directional' | 'burst'; speed: number; spread: number };
  acceleration: [number, number, number];
  texture: string;
  blending: 'additive' | 'normal';
  trigger: 'speed' | 'impact' | 'boost' | 'continuous';
  triggerThreshold?: number;
}

// ============================================================================
// POST-PROCESSING CONFIGURATION
// ============================================================================

export interface PostProcessConfig {
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    radius: number;
    iterations: number;
  };
  motionBlur: {
    enabled: boolean;
    intensity: number;
    samples: number;
  };
  chromaticAberration: {
    enabled: boolean;
    intensity: number;
  };
  screenSpaceReflections: {
    enabled: boolean;
    maxSteps: number;
    stepSize: number;
    thickness: number;
  };
  colorGrading: {
    enabled: boolean;
    contrast: number;
    saturation: number;
    tint: [number, number, number];
  };
}

// ============================================================================
// ENVIRONMENT & REFLECTION SYSTEM
// ============================================================================

export interface ReflectionProbeConfig {
  id?: string;
  resolution: number;
  updateMode: 'realtime' | 'onAwake' | 'scheduled';
  updateInterval: number;  // seconds for scheduled mode
  position: [number, number, number];
  near: number;
  far: number;
  cullingMask: string[];  // Layers to include in reflection
  intensity: number;
  priority?: number;
  zoneId?: string;
  parallaxBoxMin?: [number, number, number];
  parallaxBoxMax?: [number, number, number];
}

export type RenderingQualityProfileName = 'balanced' | 'high' | 'cinematic';

export interface RenderingQualityProfile {
  name: RenderingQualityProfileName;
  maxProbeUpdatesPerFrame: number;
  probeResolutionScale: number;
  ssrStepScale: number;
  bloomIterationCap: number;
  shadowMapResolution: number;
  lodHysteresisMeters: number;
}

export interface ShadowConfig {
  enabled: boolean;
  mapResolution: number;
  cascadeCount: number;
  cascadeSplits: number[];
  bias: number;
  normalBias: number;
  softness: number;
  maxDistance: number;
}

export interface DirectionalLightConfig {
  enabled: boolean;
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  castShadows: boolean;
}

export interface TrackSurfaceVisualProperties {
  surfaceType?: 'obsidian' | 'ice' | 'rubber' | 'sand' | 'volcanic_rock' | 'crystal';
  roughnessOverride?: number;
  metallicOverride?: number;
  reflectionIntensity?: number;
  shadowIntensity?: number;
  shadowSoftness?: number;
}

export interface TrackZoneVisualMetadata {
  zoneId: string;
  surface: TrackSurfaceVisualProperties;
  reflectionProbeHint?: string;
}

export interface EnvironmentConfig {
  qualityProfile: RenderingQualityProfileName;
  iblIntensity: number;
  iblRotation: number;
  reflectionProbes: ReflectionProbeConfig[];
  directionalLight: DirectionalLightConfig;
  shadow: ShadowConfig;
  skybox: {
    enabled: boolean;
    texture: string | null;
    color: [number, number, number];
    exposure: number;
  };
}

// ============================================================================
// LOD & OPTIMIZATION CONFIGURATION
// ============================================================================

export interface LODLevel {
  distance: number;
  mesh: string;
  material: string;
  shadowCasting: boolean;
  receiveShadows: boolean;
}

export interface ImpostorConfig {
  enabled: boolean;
  distance: number;
  textureResolution: number;
  updateRate: number;  // Updates per second
  billboardMode: 'cylindrical' | 'spherical';
}

export interface InstancingConfig {
  enabled: boolean;
  maxInstances: number;
  frustumCulling: boolean;
  occlusionCulling: boolean;
  dynamicBatching: boolean;
}

export interface LODConfig {
  levels: LODLevel[];
  impostor: ImpostorConfig;
  instancing: InstancingConfig;
  lodFadeMode: 'crossFade' | 'speedTree' | 'none';
  lodFadeWidth: number;
}

// ============================================================================
// MARBLE RENDERING FACTORY
// ============================================================================

export interface MarbleRenderingPackage {
  name: string;
  materialConfig: MarbleMaterialConfig;
  particleEffects: ParticleEffect[];
  postProcessConfig: PostProcessConfig;
  lodConfig: LODConfig;
}

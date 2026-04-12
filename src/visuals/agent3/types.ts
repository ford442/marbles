/**
 * Agent 3: Advanced Rendering Layer - Types
 * Marble Visual Overhaul Agent Swarm
 * 
 * All type definitions and interfaces for advanced rendering
 */

// ============================================================================
// PARTICLE SYSTEM TYPES
// ============================================================================

/**
 * Particle effect configuration interface
 */
export interface AdvancedParticleEffect {
  name: string;
  maxParticles: number;
  emissionRate: number;
  lifetime: { min: number; max: number };
  size: { start: number; end: number; variation?: number };
  color: { 
    start: [number, number, number, number]; 
    end: [number, number, number, number];
    gradient?: [number, number, number, number][];
  };
  velocity: { 
    type: 'radial' | 'directional' | 'burst' | 'orbital' | 'entangled'; 
    speed: number; 
    spread: number;
    direction?: [number, number, number];
  };
  acceleration: [number, number, number];
  rotation: { start: number; speed: number; randomize: boolean };
  texture: string;
  blending: 'additive' | 'normal' | 'screen';
  trigger: 'speed' | 'impact' | 'boost' | 'continuous' | 'quantum_entangle';
  triggerThreshold?: number;
  
  // Advanced features
  quantumEntanglement?: {
    enabled: boolean;
    pairDistance: number;
    syncPhase: boolean;
  };
  heatShimmer?: {
    enabled: boolean;
    intensity: number;
    speed: number;
  };
  spectralShift?: {
    enabled: boolean;
    speed: number;
    range: number;
  };
}

// ============================================================================
// MATERIAL TYPES
// ============================================================================

/**
 * Advanced material configuration interface with performance annotations
 */
export interface AdvancedMaterialConfig {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: any }>;
  blending: 'opaque' | 'transparent' | 'additive';
  depthWrite: boolean;
  cullFace: 'front' | 'back' | 'none';
  
  // Performance annotations
  performance: {
    estimatedGpuCost: number; // milliseconds
    qualityTier: 'low' | 'medium' | 'high' | 'ultra';
    textureCount: number;
    uniformCount: number;
    instructionEstimate: number;
    targetPlatform: 'mobile' | 'desktop' | 'universal';
  };
  
  // Feature flags
  features: {
    requiresBloom: boolean;
    requiresSSS: boolean;
    requiresSSR: boolean;
    supportsInstancing: boolean;
    supportsLOD: boolean;
  };
}

// ============================================================================
// POST-PROCESSING TYPES
// ============================================================================

/**
 * Enhanced post-processing configuration interface
 */
export interface EnhancedPostProcessConfig {
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
    spectralShift?: boolean;
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
    lutTexture?: string;
  };
  
  // NEW: Depth of Field
  depthOfField: {
    enabled: boolean;
    focusDistance: number;      // Distance to focal plane
    focusRange: number;         // Range of sharp focus
    blurRadius: number;         // Maximum blur radius
    bokehShape: 'circular' | 'hexagonal' | 'octagonal';
    bokehIntensity: number;
  };
  
  // NEW: Vignette
  vignette: {
    enabled: boolean;
    intensity: number;
    smoothness: number;
    color: [number, number, number];
    rounded: boolean;
  };
  
  // NEW: Film Grain
  filmGrain: {
    enabled: boolean;
    intensity: number;
    speed: number;
    size: number;
    colorized: boolean;
  };
  
  // NEW: Ambient Occlusion
  ambientOcclusion: {
    enabled: boolean;
    intensity: number;
    radius: number;
    sampleCount: number;
  };
  
  // NEW: Heat Distortion
  heatDistortion?: {
    enabled: boolean;
    strength: number;
    speed: number;
  };
}

// ============================================================================
// LIGHTING TYPES
// ============================================================================

/**
 * Screen-Space Subsurface Scattering (SSSS) Configuration
 * Approximates light scattering within translucent materials
 */
export interface SSSSConfig {
  enabled: boolean;
  
  // Sampling parameters
  sampleCount: number;
  sampleRadius: number;
  
  // Scattering profile (Gaussian weights)
  weights: [number, number, number, number, number, number];
  
  // Distance falloff
  distanceScale: number;
  
  // Color absorption
  absorptionColor: [number, number, number];
  absorptionCoefficients: {
    red: number;
    green: number;
    blue: number;
  };
  
  // Performance settings
  bilateralFilter: boolean;
  downsample: number; // 1 = full, 2 = half, 4 = quarter
}

/**
 * Reflection Probe Blending Configuration
 * Smooth transitions between probe zones
 */
export interface ProbeBlendingConfig {
  enabled: boolean;
  
  // Blend distance parameters
  blendDistance: number;
  blendOverlap: number;
  
  // Blend curve (0 = linear, 1 = smooth, 2 = smoother)
  blendCurve: number;
  
  // Priority-based blending
  usePriorityWeights: boolean;
  
  // Update strategy
  updateStrategy: 'distance' | 'priority' | 'hybrid';
  
  // Performance
  maxActiveProbes: number;
  cullDistance: number;
}

/**
 * Zone transition configuration for track segments
 */
export interface ZoneTransitionConfig {
  zoneA: string;
  zoneB: string;
  transitionLength: number;
  
  // Blend factors
  skyboxBlend: boolean;
  lightingBlend: boolean;
  fogBlend: boolean;
  reflectionBlend: boolean;
  
  // Transition curve
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'custom';
  customCurve?: number[]; // 0-1 values for custom curve
}

/**
 * Reflection probe with zone awareness
 */
export interface ZoneAwareReflectionProbe {
  id: string;
  resolution: number;
  updateMode: 'realtime' | 'onAwake' | 'scheduled';
  updateInterval: number;
  position: [number, number, number];
  near: number;
  far: number;
  cullingMask: string[];
  intensity: number;
  priority: number;
  
  // Zone configuration
  zoneId: string;
  zoneBounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  
  // Blending
  blendDistance: number;
  influenceWeight: number;
  
  // Parallax correction
  parallaxCorrection: boolean;
  parallaxBoxMin: [number, number, number];
  parallaxBoxMax: [number, number, number];
}

// ============================================================================
// PACKAGE TYPES
// ============================================================================

/**
 * Complete rendering package interface
 */
export interface AdvancedMarbleRenderingPackage {
  name: string;
  materialConfig: AdvancedMaterialConfig;
  particleEffects: AdvancedParticleEffect[];
  postProcessConfig: EnhancedPostProcessConfig;
  ssssConfig?: SSSSConfig;
  probeBlending?: ProbeBlendingConfig;
}

// ============================================================================
// PERFORMANCE TYPES
// ============================================================================

/**
 * Performance profile for a platform
 */
export interface PerformanceProfile {
  maxParticles: number;
  bloomIterations: number;
  sssSamples: number;
  dofQuality: 'low' | 'medium' | 'high' | 'ultra';
  aoSamples: number;
  useHeatDistortion: boolean;
}

/**
 * Collection of performance profiles
 */
export interface PerformanceProfiles {
  mobile: PerformanceProfile;
  desktop: PerformanceProfile;
  ultra: PerformanceProfile;
}

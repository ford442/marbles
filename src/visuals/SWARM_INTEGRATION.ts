/**
 * Agent Swarm Integration - Master Module
 * Marble Visual Overhaul v5.1.0
 * 
 * This module integrates all 4 agent refinements into a unified rendering system.
 * 
 * Agent 1: Beauty Layer - Enhanced PBR materials, Quantum Crystal theme
 * Agent 2: Complexity Layer - Procedural textures, vertex deformations
 * Agent 3: Advanced Rendering - Quantum/Prismatic/Volcanic shaders, DoF, SSSS
 * Agent 4: Track Materials - Surface types, wear simulation, zone integration
 * 
 * @module SWARM_INTEGRATION
 * @version 5.1.0
 */

// ============================================================================
// AGENT IMPORTS
// ============================================================================

import {
  // Agent 1: Beauty Layer
  RefinedGlassMaterialConfig,
  RefinedObsidianMaterialConfig,
  RefinedNeonMaterialConfig,
  RefinedStoneMaterialConfig,
  QuantumCrystalMaterialConfig,
  AllRefinedMarblePackages,
  EnhancedColorPalettes,
  QuantumCrystalPalette,
  PerformanceMetrics,
  QualityTierMapping,
  RefinedShaderSource
} from './agent1_beauty_refinement.js';

import {
  // Agent 2: Complexity Layer
  generateFBMNoise,
  generateSimplexNoise,
  generateWorleyNoise,
  createMarbleVeinTexture,
  createCircuitPattern,
  createMetalGrainTexture,
  createWeatheringMap,
  generateImpactDeformation,
  generateRollFlattening,
  generateBounceWobble,
  applyCompositeDeformation,
  PARALLAX_MAPPING_FRAGMENT_SHADER,
  VELOCITY_CIRCUIT_FRAGMENT_SHADER,
  WEATHERING_OVERLAY_FRAGMENT_SHADER,
  DEFORMATION_VERTEX_SHADER,
  MarbleTexturePresets,
  CircuitPatternPresets,
  MetalGrainPresets,
  WeatheringPresets,
  SeededRandom
} from './agent2_complexity_refinement.js';

import {
  // Agent 3: Advanced Rendering
  QuantumMarbleConfig,
  PrismaticMarbleConfig,
  VolcanicMarbleConfig,
  QuantumEntanglementParticles,
  PrismaticSparkles,
  VolcanicEmberTrails,
  QuantumPostProcess,
  PrismaticPostProcess,
  VolcanicPostProcess,
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  AllAdvancedMarblePackages,
  estimateGpuCost
} from './agent3_advanced_rendering.js';

import {
  // Agent 4: Track Materials
  TrackSurfaceType,
  SurfaceFinish,
  TrafficIntensity,
  MaterialQuality,
  TrackMaterialProperties,
  TrackWearState,
  TrackZoneVisualMetadata,
  BASE_TRACK_MATERIALS,
  updateWearState,
  applyWearToMaterial,
  createZoneReflectionProbe,
  blendReflectionProbes,
  getTrackMaterialForZone,
  createMainJSCompatibleMaterial,
  selectOptimalMaterialQuality,
  TrackMaterialBatchUpdater,
  PREDEFINED_ZONE_CONFIGS
} from './agent4_track_materials.js';

// ============================================================================
// UNIFIED MARBLE REGISTRY
// ============================================================================

/**
 * All available marble types from the agent swarm
 */
export const AllMarbleTypes = {
  // Original refined types (Agent 1)
  CLASSIC_GLASS: 'ClassicGlassRefined',
  OBSIDIAN_METAL: 'ObsidianMetalRefined',
  NEON_GLOW: 'NeonGlowRefined',
  STONE_VEIN: 'StoneVeinRefined',
  QUANTUM_CRYSTAL: 'QuantumCrystal',
  
  // Advanced types (Agent 3)
  QUANTUM_MARBLE: 'QuantumMarble',
  PRISMATIC_MARBLE: 'PrismaticMarble',
  VOLCANIC_MARBLE: 'VolcanicMarble'
} as const;

export type MarbleType = typeof AllMarbleTypes[keyof typeof AllMarbleTypes];

/**
 * Complete marble package registry combining all agents
 */
export const UnifiedMarbleRegistry = [
  // Agent 1 packages
  ...AllRefinedMarblePackages,
  // Agent 3 packages
  ...AllAdvancedMarblePackages
];

/**
 * Get a marble package by name
 */
export function getMarblePackage(name: string) {
  return UnifiedMarbleRegistry.find(pkg => pkg.name === name);
}

/**
 * Get all packages for a specific quality tier
 */
export function getPackagesByTier(tier: 'low' | 'medium' | 'high' | 'ultra') {
  // Map packages to tiers based on their complexity
  const tierMap: Record<string, typeof tier> = {
    'RefinedStoneVein': 'low',
    'StoneVein': 'low',
    'RefinedObsidianMetal': 'medium',
    'ObsidianMetal': 'medium',
    'RefinedGlass': 'high',
    'ClassicGlass': 'high',
    'RefinedNeonGlow': 'high',
    'NeonGlow': 'high',
    'QuantumCrystal': 'high',
    'QuantumMarble': 'ultra',
    'PrismaticMarble': 'ultra',
    'VolcanicMarble': 'high'
  };
  
  return UnifiedMarbleRegistry.filter(pkg => tierMap[pkg.name] === tier);
}

// ============================================================================
// DEFORMATION SYSTEM INTEGRATION
// ============================================================================

/**
 * Physics state interface for deformation calculations
 */
export interface PhysicsState {
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  mass: number;
  radius: number;
  lastImpactTime?: number;
  lastImpactForce?: number;
}

/**
 * Calculate vertex deformations based on physics state
 * Combines Agent 2's deformation functions
 */
export function calculateMarbleDeformation(
  physics: PhysicsState,
  time: number,
  deltaTime: number
): { deformation: number[]; normalAdjustment: number[] } {
  const deformations: number[][] = [];
  
  // Roll-based flattening
  const angularSpeed = Math.sqrt(
    physics.angularVelocity[0] ** 2 +
    physics.angularVelocity[1] ** 2 +
    physics.angularVelocity[2] ** 2
  );
  
  if (angularSpeed > 1.0) {
    deformations.push(generateRollFlattening(angularSpeed, physics.radius));
  }
  
  // Impact deformation (if recent impact)
  if (physics.lastImpactTime && physics.lastImpactForce) {
    const timeSinceImpact = time - physics.lastImpactTime;
    if (timeSinceImpact < 0.5) { // 500ms recovery
      deformations.push(generateImpactDeformation(
        physics.lastImpactForce,
        physics.radius,
        1.0 - timeSinceImpact / 0.5 // Recovery factor
      ));
    }
  }
  
  // Bounce wobble
  if (Math.abs(physics.velocity[1]) > 2.0) {
    deformations.push(generateBounceWobble(
      Math.abs(physics.velocity[1]),
      physics.radius,
      time
    ));
  }
  
  // Combine all deformations
  return applyCompositeDeformation(deformations, 'additive');
}

// ============================================================================
// WEATHERING & WEAR INTEGRATION
// ============================================================================

/**
 * Track wear configuration combining Agent 2's weathering with Agent 4's wear state
 */
export interface TrackWeatheringConfig {
  surfaceType: TrackSurfaceType;
  trafficIntensity: TrafficIntensity;
  enablePolishedPaths: boolean;
  enableSkidMarks: boolean;
  enableHeatDiscoloration: boolean;
}

/**
 * Apply procedural weathering to track materials
 */
export function applyProceduralWeathering(
  baseMaterial: TrackMaterialProperties,
  wearState: TrackWearState,
  config: TrackWeatheringConfig
): TrackMaterialProperties {
  // Apply Agent 4's wear calculations
  const wornMaterial = applyWearToMaterial(baseMaterial, wearState);
  
  // Generate Agent 2's weathering texture
  const weatheringTexture = createWeatheringMap({
    wearAmount: Math.min(1.0, wearState.contactCount / 1000),
    dirtAccumulation: wearState.dirtAccumulation,
    rustAmount: config.surfaceType === TrackSurfaceType.METAL ? 0.2 : 0,
    noiseScale: 2.5
  });
  
  // Apply weathering to material
  return {
    ...wornMaterial,
    roughness: Math.min(1.0, (wornMaterial.roughness || 0.5) + (weatheringTexture.wearChannel || 0) * 0.3),
    baseColor: [
      wornMaterial.baseColor[0] * (1 - (weatheringTexture.dirtChannel || 0) * 0.2),
      wornMaterial.baseColor[1] * (1 - (weatheringTexture.dirtChannel || 0) * 0.2),
      wornMaterial.baseColor[2] * (1 - (weatheringTexture.dirtChannel || 0) * 0.15)
    ] as [number, number, number]
  };
}

// ============================================================================
// ENVIRONMENT & REFLECTION SYSTEM
// ============================================================================

/**
 * Unified environment configuration
 */
export interface UnifiedEnvironmentConfig {
  quality: 'balanced' | 'high' | 'cinematic';
  reflectionProbes: {
    zones: TrackZoneVisualMetadata[];
    blendDistance: number;
  };
  subsurfaceScattering: boolean;
  depthOfField: boolean;
}

/**
 * Setup complete environment for a track
 */
export function setupUnifiedEnvironment(
  config: UnifiedEnvironmentConfig,
  engine: any
) {
  // Create reflection probes for each zone
  const probes = config.reflectionProbes.zones.map(zone =>
    createZoneReflectionProbe(zone.zoneId, zone.surface.surfaceType || TrackSurfaceType.OBSIDIAN)
  );
  
  return {
    probes,
    probeBlending: { enabled: true, blendDistance: config.reflectionProbes.blendDistance },
    sssConfig: config.subsurfaceScattering
      ? { enabled: true, intensity: 0.5 }
      : null,
    dofConfig: config.depthOfField
      ? { enabled: true, focalLength: 50, aperture: 2.8 }
      : null
  };
}

// ============================================================================
// PERFORMANCE MANAGEMENT
// ============================================================================

/**
 * Adaptive quality manager that adjusts rendering based on performance
 */
export class AdaptiveQualityManager {
  private targetFrameTime: number = 16.67; // 60fps
  private currentTier: 'ultra' | 'high' | 'medium' | 'low' = 'high';
  private frameTimeHistory: number[] = [];
  private readonly historySize = 60; // 1 second at 60fps
  
  constructor(targetFps: number = 60) {
    this.targetFrameTime = 1000 / targetFps;
  }
  
  recordFrameTime(frameTimeMs: number) {
    this.frameTimeHistory.push(frameTimeMs);
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift();
    }
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return this.targetFrameTime;
    return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
  }
  
  shouldAdjustQuality(): { adjust: boolean; newTier?: typeof this.currentTier } {
    const avgFrameTime = this.getAverageFrameTime();
    const headroom = this.targetFrameTime - avgFrameTime;
    
    if (headroom < 2.0 && this.currentTier !== 'low') {
      // Need to reduce quality
      const tiers: typeof this.currentTier[] = ['ultra', 'high', 'medium', 'low'];
      const currentIdx = tiers.indexOf(this.currentTier);
      return { adjust: true, newTier: tiers[Math.min(tiers.length - 1, currentIdx + 1)] };
    }
    
    if (headroom > 5.0 && this.currentTier !== 'ultra') {
      // Can increase quality
      const tiers: typeof this.currentTier[] = ['ultra', 'high', 'medium', 'low'];
      const currentIdx = tiers.indexOf(this.currentTier);
      return { adjust: true, newTier: tiers[Math.max(0, currentIdx - 1)] };
    }
    
    return { adjust: false };
  }
  
  applyQualityTier(tier: typeof this.currentTier) {
    this.currentTier = tier;
    console.log(`[AdaptiveQuality] Switched to ${tier} tier`);
  }
  
  getCurrentTier(): typeof this.currentTier {
    return this.currentTier;
  }
}

// ============================================================================
// MAIN.JS INTEGRATION HELPERS
// ============================================================================

/**
 * Complete integration helper for main.js
 * Usage: Import this and call functions from your game loop
 */
export const SwarmIntegration = {
  // Marble creation
  getMarblePackage,
  getPackagesByTier,
  AllMarbleTypes,
  UnifiedMarbleRegistry,
  
  // Deformation
  calculateMarbleDeformation,
  
  // Weathering
  applyProceduralWeathering,
  
  // Environment
  setupUnifiedEnvironment,
  
  // Performance
  AdaptiveQualityManager,
  
  // Track materials
  TrackSurfaceType,
  SurfaceFinish,
  TrafficIntensity,
  MaterialQuality,
  getTrackMaterialForZone,
  TrackMaterialBatchUpdater,
  PREDEFINED_ZONE_CONFIGS,
  
  // Procedural generation
  createMarbleVeinTexture,
  createCircuitPattern,
  createMetalGrainTexture,
  createWeatheringMap,
  SeededRandom,
  
  // GPU cost estimation
  estimateGpuCost
};

// Default export for convenience
export default SwarmIntegration;

// ============================================================================
// VERSION INFO
// ============================================================================

export const SWARM_VERSION = '5.1.0';
export const SWARM_SEED = 1337;
export const AGENT_COUNT = 4;

export const SwarmManifest = {
  version: SWARM_VERSION,
  seed: SWARM_SEED,
  agents: [
    { id: 1, name: 'Beauty Layer', file: 'agent1_beauty_refinement.ts', status: 'complete' },
    { id: 2, name: 'Complexity Layer', file: 'agent2_complexity_refinement.ts', status: 'complete' },
    { id: 3, name: 'Advanced Rendering', file: 'agent3_advanced_rendering.ts', status: 'complete' },
    { id: 4, name: 'Track Materials', file: 'agent4_track_materials.ts', status: 'complete' }
  ],
  newMarbleThemes: ['Quantum Crystal', 'Quantum Marble', 'Prismatic Marble', 'Volcanic Marble'],
  newTrackSurfaces: ['obsidian', 'ice', 'rubber', 'sand', 'volcanic_rock', 'crystal', 'wood', 'metal', 'concrete'],
  features: [
    'Enhanced PBR materials with rim lighting',
    'Procedural texture generation (FBM, Simplex, Worley)',
    'Vertex deformation system (impact, roll, wobble)',
    'Custom quantum/prismatic/volcanic shaders',
    'Advanced particle systems',
    'Depth of field and post-processing',
    'Screen-space subsurface scattering',
    'Track wear simulation',
    'Adaptive quality management',
    'Zone-based reflection probes'
  ]
};

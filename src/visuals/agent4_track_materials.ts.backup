/**
 * Agent 4: Track Surface Materials & Integration
 * Marble Visual Overhaul - Track Material Refinements
 * 
 * Provides track surface material definitions, procedural wear/dirt accumulation,
 * dynamic surface properties, zone-based reflection probes, and integration utilities.
 * 
 * @module agent4_track_materials
 * @requires filament
 * @requires gl-matrix
 */

import * as Filament from 'filament';
import { vec3, vec4, mat4 } from 'gl-matrix';

// ============================================================================
// SURFACE TYPE ENUMS AND INTERFACES
// ============================================================================

/**
 * Track surface material types
 * Each type has distinct visual and physical properties
 */
export enum TrackSurfaceType {
  OBSIDIAN = 'obsidian',
  ICE = 'ice',
  RUBBER = 'rubber',
  SAND = 'sand',
  VOLCANIC_ROCK = 'volcanic_rock',
  CRYSTAL = 'crystal',
  WOOD = 'wood',
  METAL = 'metal',
  CONCRETE = 'concrete'
}

/**
 * Track surface finish variants affecting visual appearance
 */
export enum SurfaceFinish {
  POLISHED = 'polished',       // High gloss, mirror-like
  MATT = 'matt',               // Diffuse, no shine
  ROUGH = 'rough',             // Unfinished, textured
  WORN = 'worn',               // Visible wear patterns
  WEATHERED = 'weathered'      // Age effects, oxidation
}

/**
 * Traffic intensity levels affecting wear accumulation
 */
export enum TrafficIntensity {
  NONE = 0,        // Unused track sections
  LIGHT = 1,       // Occasional marble passage
  MEDIUM = 2,      // Regular racing traffic
  HEAVY = 3,       // High-traffic areas, start/finish
  EXTREME = 4      // Constant traffic, boost pads
}

/**
 * Material quality/LOD level for performance optimization
 */
export enum MaterialQuality {
  ULTRA = 'ultra',     // Full shaders, tessellation
  HIGH = 'high',       // Normal maps, PBR
  MEDIUM = 'medium',   // Simplified PBR
  LOW = 'low',         // Basic diffuse
  MINIMAL = 'minimal'  // Vertex colors only
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * PBR material properties for track surfaces
 */
export interface TrackMaterialProperties {
  /** Base color (albedo) as RGBA */
  baseColor: vec4;
  
  /** Surface roughness (0.0 = mirror, 1.0 = diffuse) */
  roughness: number;
  
  /** Metallic factor (0.0 = dielectric, 1.0 = metal) */
  metallic: number;
  
  /** Specular reflectance at normal incidence */
  reflectance: number;
  
  /** Clear coat layer for polished surfaces (0.0 - 1.0) */
  clearCoat: number;
  
  /** Clear coat roughness */
  clearCoatRoughness: number;
  
  /** Subsurface scattering for translucent materials */
  subsurfaceScattering: number;
  
  /** Ambient occlusion intensity */
  ambientOcclusion: number;
  
  /** Emissive color for glowing surfaces */
  emissive: vec4;
  
  /** Emissive intensity multiplier */
  emissiveIntensity: number;
  
  /** Anisotropy for brushed metals (0.0 = isotropic) */
  anisotropy: number;
  
  /** Sheen for velvet-like materials */
  sheen: number;
  
  /** Sheen color tint */
  sheenColor: vec4;
}

/**
 * Procedural texture generation parameters
 */
export interface ProceduralTextureParams {
  /** Noise scale for surface detail */
  noiseScale: number;
  
  /** Number of octaves for fractal noise */
  noiseOctaves: number;
  
  /** Normal map intensity */
  normalStrength: number;
  
  /** Micro-detail scale for close-up surfaces */
  microDetailScale: number;
  
  /** Wear pattern seed for deterministic generation */
  wearSeed: number;
}

/**
 * Dynamic wear and dirt accumulation state
 */
export interface TrackWearState {
  /** Current wear amount (0.0 = new, 1.0 = heavily worn) */
  wearAmount: number;
  
  /** Dirt accumulation level */
  dirtLevel: number;
  
  /** Number of marble contacts recorded */
  contactCount: number;
  
  /** Time since last major wear event */
  lastWearTime: number;
  
  /** Polished path from frequent marble traffic */
  polishedPathIntensity: number;
  
  /** Skid marks from high-speed braking */
  skidMarkIntensity: number;
  
  /** Heat discoloration from friction */
  heatDiscoloration: number;
}

/**
 * Zone-based reflection probe configuration
 */
export interface ReflectionProbeHint {
  /** Unique probe identifier */
  id: string;
  
  /** Probe position in world space */
  position: vec3;
  
  /** Probe influence radius */
  radius: number;
  
  /** Resolution for real-time reflections (power of 2) */
  resolution: number;
  
  /** Update frequency: 'realtime', 'static', 'interval' */
  updateMode: 'realtime' | 'static' | 'interval';
  
  /** Update interval in seconds (for 'interval' mode) */
  updateInterval: number;
  
  /** Reflection intensity multiplier */
  intensity: number;
  
  /** Priority for probe blending (higher = more influence) */
  priority: number;
  
  /** Layers to include in reflection (bitmask or string array) */
  cullingMask: string[];
}

/**
 * Complete track zone visual metadata
 */
export interface TrackZoneVisualMetadata {
  /** Zone identifier matching physics zone ID */
  zoneId: string;
  
  /** Display name for the zone */
  displayName: string;
  
  /** Primary surface type */
  surfaceType: TrackSurfaceType;
  
  /** Surface finish variant */
  finish: SurfaceFinish;
  
  /** Base material properties */
  material: TrackMaterialProperties;
  
  /** Procedural texture parameters */
  textureParams: ProceduralTextureParams;
  
  /** Current wear/dirt state */
  wearState: TrackWearState;
  
  /** Expected traffic intensity for this zone */
  expectedTraffic: TrafficIntensity;
  
  /** Associated reflection probe */
  reflectionProbe?: ReflectionProbeHint;
  
  /** Custom shader overrides */
  shaderOverrides?: Record<string, number | vec3 | vec4>;
}

// ============================================================================
// BASE MATERIAL DEFINITIONS
// ============================================================================

/**
 * Base material configurations for all track surface types
 * These serve as starting points that can be modified by wear state
 */
export const BASE_TRACK_MATERIALS: Record<TrackSurfaceType, TrackMaterialProperties> = {
  [TrackSurfaceType.OBSIDIAN]: {
    baseColor: vec4.fromValues(0.05, 0.05, 0.07, 1.0),
    roughness: 0.15,
    metallic: 0.9,
    reflectance: 1.0,
    clearCoat: 0.4,
    clearCoatRoughness: 0.1,
    subsurfaceScattering: 0.05,
    ambientOcclusion: 0.7,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.ICE]: {
    baseColor: vec4.fromValues(0.85, 0.92, 1.0, 0.6),
    roughness: 0.05,
    metallic: 0.0,
    reflectance: 0.8,
    clearCoat: 1.0,
    clearCoatRoughness: 0.02,
    subsurfaceScattering: 0.7,
    ambientOcclusion: 0.2,
    emissive: vec4.fromValues(0.1, 0.2, 0.3, 1.0),
    emissiveIntensity: 0.1,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.RUBBER]: {
    baseColor: vec4.fromValues(0.15, 0.15, 0.15, 1.0),
    roughness: 0.85,
    metallic: 0.0,
    reflectance: 0.2,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.1,
    ambientOcclusion: 0.9,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.SAND]: {
    baseColor: vec4.fromValues(0.76, 0.70, 0.50, 1.0),
    roughness: 1.0,
    metallic: 0.0,
    reflectance: 0.0,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.VOLCANIC_ROCK]: {
    baseColor: vec4.fromValues(0.12, 0.08, 0.06, 1.0),
    roughness: 0.95,
    metallic: 0.1,
    reflectance: 0.1,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.3, 0.1, 0.0, 1.0),
    emissiveIntensity: 0.15,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.CRYSTAL]: {
    baseColor: vec4.fromValues(0.9, 0.95, 1.0, 0.4),
    roughness: 0.02,
    metallic: 0.0,
    reflectance: 0.9,
    clearCoat: 0.8,
    clearCoatRoughness: 0.05,
    subsurfaceScattering: 0.8,
    ambientOcclusion: 0.3,
    emissive: vec4.fromValues(0.2, 0.5, 0.8, 1.0),
    emissiveIntensity: 0.3,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.WOOD]: {
    baseColor: vec4.fromValues(0.4, 0.25, 0.15, 1.0),
    roughness: 0.6,
    metallic: 0.0,
    reflectance: 0.15,
    clearCoat: 0.1,
    clearCoatRoughness: 0.4,
    subsurfaceScattering: 0.05,
    ambientOcclusion: 0.8,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.METAL]: {
    baseColor: vec4.fromValues(0.72, 0.73, 0.75, 1.0),
    roughness: 0.25,
    metallic: 1.0,
    reflectance: 1.0,
    clearCoat: 0.0,
    clearCoatRoughness: 0.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 0.5,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.3,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.CONCRETE]: {
    baseColor: vec4.fromValues(0.35, 0.35, 0.37, 1.0),
    roughness: 0.9,
    metallic: 0.0,
    reflectance: 0.1,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  }
};

// ============================================================================
// PERFORMANCE-OPTIMIZED MATERIAL VARIANTS
// ============================================================================

/**
 * Material quality variants for LOD switching
 * Each variant reduces shader complexity for performance
 */
export function createMaterialVariant(
  baseMaterial: TrackMaterialProperties,
  quality: MaterialQuality
): TrackMaterialProperties {
  const variant: TrackMaterialProperties = {
    baseColor: vec4.clone(baseMaterial.baseColor),
    roughness: baseMaterial.roughness,
    metallic: baseMaterial.metallic,
    reflectance: baseMaterial.reflectance,
    clearCoat: baseMaterial.clearCoat,
    clearCoatRoughness: baseMaterial.clearCoatRoughness,
    subsurfaceScattering: baseMaterial.subsurfaceScattering,
    ambientOcclusion: baseMaterial.ambientOcclusion,
    emissive: vec4.clone(baseMaterial.emissive),
    emissiveIntensity: baseMaterial.emissiveIntensity,
    anisotropy: baseMaterial.anisotropy,
    sheen: baseMaterial.sheen,
    sheenColor: vec4.clone(baseMaterial.sheenColor)
  };

  switch (quality) {
    case MaterialQuality.ULTRA:
      // Full quality, no changes
      break;
      
    case MaterialQuality.HIGH:
      // Slightly reduced clear coat
      variant.clearCoat *= 0.8;
      variant.subsurfaceScattering *= 0.8;
      break;
      
    case MaterialQuality.MEDIUM:
      // Remove expensive effects
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering *= 0.5;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      break;
      
    case MaterialQuality.LOW:
      // Simplified PBR
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering = 0.0;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      variant.roughness = Math.max(variant.roughness, 0.3);
      break;
      
    case MaterialQuality.MINIMAL:
      // Vertex-color equivalent
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering = 0.0;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      variant.roughness = 0.5;
      variant.metallic = 0.0;
      variant.reflectance = 0.5;
      break;
  }

  return variant;
}

// ============================================================================
// TRACK WEAR SIMULATION
// ============================================================================

/**
 * Default wear state for new track sections
 */
export const DEFAULT_WEAR_STATE: TrackWearState = {
  wearAmount: 0.0,
  dirtLevel: 0.0,
  contactCount: 0,
  lastWearTime: 0,
  polishedPathIntensity: 0.0,
  skidMarkIntensity: 0.0,
  heatDiscoloration: 0.0
};

/**
 * Wear simulation configuration
 */
export interface WearSimulationConfig {
  /** Wear accumulation per marble contact */
  wearPerContact: number;
  
  /** Dirt accumulation rate per second */
  dirtAccumulationRate: number;
  
  /** Polishing effect from repeated traffic */
  polishPerContact: number;
  
  /** Skid mark intensity from high-speed contacts */
  skidIntensityMultiplier: number;
  
  /** Heat buildup from friction */
  heatPerContact: number;
  
  /** Heat dissipation rate per second */
  heatDissipationRate: number;
  
  /** Maximum wear before surface degradation */
  maxWearThreshold: number;
}

/**
 * Default wear simulation parameters
 */
export const DEFAULT_WEAR_CONFIG: WearSimulationConfig = {
  wearPerContact: 0.001,
  dirtAccumulationRate: 0.0001,
  polishPerContact: 0.002,
  skidIntensityMultiplier: 0.1,
  heatPerContact: 0.05,
  heatDissipationRate: 0.02,
  maxWearThreshold: 1.0
};

/**
 * Tracks wear and dirt accumulation on track surfaces
 * Call this each frame or when marbles contact the surface
 */
export function updateWearState(
  currentState: TrackWearState,
  config: WearSimulationConfig,
  deltaTime: number,
  contactInfo?: {
    count: number;
    speed: number;
    isSkidding: boolean;
  }
): TrackWearState {
  const newState: TrackWearState = { ...currentState };
  
  // Apply time-based dirt accumulation
  newState.dirtLevel = Math.min(
    1.0,
    newState.dirtLevel + config.dirtAccumulationRate * deltaTime
  );
  
  // Heat dissipation
  newState.heatDiscoloration = Math.max(
    0.0,
    newState.heatDiscoloration - config.heatDissipationRate * deltaTime
  );
  
  // Process contact events
  if (contactInfo && contactInfo.count > 0) {
    newState.contactCount += contactInfo.count;
    
    // Wear from contacts
    const wearIncrease = config.wearPerContact * contactInfo.count;
    newState.wearAmount = Math.min(1.0, newState.wearAmount + wearIncrease);
    
    // Polishing effect in high-traffic areas
    const polishIncrease = config.polishPerContact * contactInfo.count;
    newState.polishedPathIntensity = Math.min(1.0, 
      newState.polishedPathIntensity + polishIncrease
    );
    
    // Skid marks from high speed or braking
    if (contactInfo.isSkidding || contactInfo.speed > 5.0) {
      const skidIncrease = config.skidIntensityMultiplier * 
        (contactInfo.speed / 10.0) * contactInfo.count;
      newState.skidMarkIntensity = Math.min(1.0, 
        newState.skidMarkIntensity + skidIncrease
      );
    }
    
    // Heat from friction
    const heatIncrease = config.heatPerContact * contactInfo.speed * contactInfo.count;
    newState.heatDiscoloration = Math.min(1.0, 
      newState.heatDiscoloration + heatIncrease
    );
    
    newState.lastWearTime = performance.now();
  }
  
  return newState;
}

/**
 * Applies wear state to material properties
 * Returns modified material properties reflecting wear/dirt
 */
export function applyWearToMaterial(
  baseMaterial: TrackMaterialProperties,
  wearState: TrackWearState,
  surfaceType: TrackSurfaceType
): TrackMaterialProperties {
  const wornMaterial: TrackMaterialProperties = {
    baseColor: vec4.clone(baseMaterial.baseColor),
    roughness: baseMaterial.roughness,
    metallic: baseMaterial.metallic,
    reflectance: baseMaterial.reflectance,
    clearCoat: baseMaterial.clearCoat,
    clearCoatRoughness: baseMaterial.clearCoatRoughness,
    subsurfaceScattering: baseMaterial.subsurfaceScattering,
    ambientOcclusion: baseMaterial.ambientOcclusion,
    emissive: vec4.clone(baseMaterial.emissive),
    emissiveIntensity: baseMaterial.emissiveIntensity,
    anisotropy: baseMaterial.anisotropy,
    sheen: baseMaterial.sheen,
    sheenColor: vec4.clone(baseMaterial.sheenColor)
  };
  
  // Wear increases roughness
  wornMaterial.roughness = Math.min(1.0, 
    wornMaterial.roughness + wearState.wearAmount * 0.4
  );
  
  // Polishing in traffic paths reduces roughness
  wornMaterial.roughness = Math.max(0.0,
    wornMaterial.roughness - wearState.polishedPathIntensity * 0.3
  );
  
  // Dirt darkens the surface and increases roughness
  const dirtDarken = wearState.dirtLevel * 0.3;
  wornMaterial.baseColor[0] *= (1.0 - dirtDarken);
  wornMaterial.baseColor[1] *= (1.0 - dirtDarken);
  wornMaterial.baseColor[2] *= (1.0 - dirtDarken);
  wornMaterial.roughness = Math.min(1.0, 
    wornMaterial.roughness + wearState.dirtLevel * 0.2
  );
  
  // Heat discoloration (oxidation browning for metals)
  if (wearState.heatDiscoloration > 0.1) {
    const heatTint = wearState.heatDiscoloration * 0.2;
    wornMaterial.baseColor[0] = Math.min(1.0, wornMaterial.baseColor[0] + heatTint);
    wornMaterial.baseColor[1] = Math.min(1.0, wornMaterial.baseColor[1] + heatTint * 0.5);
    wornMaterial.baseColor[2] = Math.max(0.0, wornMaterial.baseColor[2] - heatTint * 0.3);
  }
  
  // Skid marks (dark streaks)
  if (wearState.skidMarkIntensity > 0.1) {
    const skidDarken = wearState.skidMarkIntensity * 0.15;
    wornMaterial.baseColor[0] = Math.max(0.0, wornMaterial.baseColor[0] - skidDarken);
    wornMaterial.baseColor[1] = Math.max(0.0, wornMaterial.baseColor[1] - skidDarken);
    wornMaterial.baseColor[2] = Math.max(0.0, wornMaterial.baseColor[2] - skidDarken);
    wornMaterial.clearCoat = Math.max(0.0, wornMaterial.clearCoat - skidDarken * 2);
  }
  
  // Surface-specific wear effects
  switch (surfaceType) {
    case TrackSurfaceType.ICE:
      // Ice gets cloudy with wear
      wornMaterial.subsurfaceScattering = Math.max(0.0,
        wornMaterial.subsurfaceScattering - wearState.wearAmount * 0.3
      );
      break;
      
    case TrackSurfaceType.METAL:
      // Metal shows more shine when polished
      wornMaterial.metallic = Math.min(1.0,
        wornMaterial.metallic + wearState.polishedPathIntensity * 0.1
      );
      break;
      
    case TrackSurfaceType.OBSIDIAN:
      // Obsidian retains glass-like properties longer
      wornMaterial.roughness = Math.min(1.0,
        wornMaterial.roughness + wearState.wearAmount * 0.2
      );
      break;
  }
  
  return wornMaterial;
}

// ============================================================================
// REFLECTION PROBE UTILITIES
// ============================================================================

/**
 * Default reflection probe for track zones
 */
export const DEFAULT_ZONE_PROBE: ReflectionProbeHint = {
  id: 'zone_default',
  position: vec3.fromValues(0, 5, 0),
  radius: 20.0,
  resolution: 128,
  updateMode: 'static',
  updateInterval: 0,
  intensity: 1.0,
  priority: 1,
  cullingMask: ['marbles', 'track', 'environment']
};

/**
 * Creates reflection probe hints for different zone types
 */
export function createZoneReflectionProbe(
  zoneType: string,
  zonePosition: vec3,
  zoneSize: vec3,
  zoneId: string
): ReflectionProbeHint {
  const probe: ReflectionProbeHint = {
    id: `probe_${zoneId}`,
    position: vec3.clone(zonePosition),
    radius: Math.max(zoneSize[0], zoneSize[2]) * 0.8,
    resolution: 128,
    updateMode: 'static',
    updateInterval: 0,
    intensity: 1.0,
    priority: 1,
    cullingMask: ['marbles', 'track', 'environment']
  };
  
  // Adjust probe position and settings based on zone type
  switch (zoneType) {
    case 'ice_cave':
      probe.position[1] += 3; // Higher for ice reflections
      probe.intensity = 1.2;
      probe.resolution = 256; // Higher res for glossy ice
      break;
      
    case 'volcano_zone':
      probe.position[1] += 5;
      probe.intensity = 0.8; // Darker environment
      probe.cullingMask.push('particles'); // Include fire particles
      break;
      
    case 'crystal_cave':
      probe.position[1] += 2;
      probe.intensity = 1.5; // Bright crystal reflections
      probe.resolution = 256;
      break;
      
    case 'boost_pad':
    case 'speed_zone':
      probe.updateMode = 'interval';
      probe.updateInterval = 0.1; // Frequent updates for fast movement
      break;
      
    case 'arena':
    case 'pinball':
      probe.radius = Math.max(zoneSize[0], zoneSize[2]);
      probe.resolution = 256;
      probe.updateMode = 'realtime';
      break;
  }
  
  return probe;
}

/**
 * Blends multiple reflection probes based on position
 */
export function blendReflectionProbes(
  position: vec3,
  probes: ReflectionProbeHint[]
): { probe: ReflectionProbeHint; weight: number }[] {
  const weightedProbes: { probe: ReflectionProbeHint; weight: number; distance: number }[] = [];
  
  // Calculate distance-based weights
  for (const probe of probes) {
    const dist = vec3.distance(position, probe.position);
    if (dist < probe.radius) {
      // Smooth falloff based on distance
      const normalizedDist = dist / probe.radius;
      const weight = Math.pow(1.0 - normalizedDist, 2) * probe.intensity;
      weightedProbes.push({ probe, weight, distance: dist });
    }
  }
  
  // Sort by weight (descending) and normalize
  weightedProbes.sort((a, b) => b.weight - a.weight);
  
  // Normalize weights to sum to 1.0
  const totalWeight = weightedProbes.reduce((sum, wp) => sum + wp.weight, 0);
  
  return weightedProbes.map(wp => ({
    probe: wp.probe,
    weight: totalWeight > 0 ? wp.weight / totalWeight : 0
  }));
}

// ============================================================================
// MATERIAL GENERATION
// ============================================================================

/**
 * Creates a Filament material instance from track properties
 */
export function createTrackMaterial(
  engine: Filament.Engine,
  properties: TrackMaterialProperties,
  quality: MaterialQuality = MaterialQuality.HIGH
): Filament.MaterialInstance | null {
  try {
    // Apply quality level adjustments
    const qualityAdjusted = createMaterialVariant(properties, quality);
    
    // Create material using Filament's standard material
    // Note: In production, this would use precompiled .filamat files
    const material = Filament.Material.Builder()
      .package(createTrackMaterialPackage(qualityAdjusted))
      .build(engine);
    
    const instance = material.getDefaultInstance();
    
    // Set material parameters
    instance.setParameter('baseColor', Filament.RgbaType.sRGB, 
      Array.from(qualityAdjusted.baseColor) as [number, number, number, number]);
    instance.setParameter('roughness', qualityAdjusted.roughness);
    instance.setParameter('metallic', qualityAdjusted.metallic);
    instance.setParameter('reflectance', qualityAdjusted.reflectance);
    instance.setParameter('clearCoat', qualityAdjusted.clearCoat);
    instance.setParameter('clearCoatRoughness', qualityAdjusted.clearCoatRoughness);
    
    if (qualityAdjusted.emissiveIntensity > 0) {
      instance.setParameter('emissive', Filament.RgbaType.sRGB,
        Array.from(qualityAdjusted.emissive) as [number, number, number, number]);
    }
    
    return instance;
  } catch (e) {
    console.error('[TrackMaterials] Failed to create material:', e);
    return null;
  }
}

/**
 * Creates a placeholder material package
 * In production, this would load compiled Filament materials
 */
function createTrackMaterialPackage(props: TrackMaterialProperties): Uint8Array {
  // Placeholder - returns empty array
  // Real implementation would load precompiled .filamat data
  return new Uint8Array(0);
}

// ============================================================================
// ZONE VISUAL METADATA BUILDERS
// ============================================================================

/**
 * Creates complete zone visual metadata from configuration
 */
export function createZoneVisualMetadata(
  zoneId: string,
  config: {
    displayName?: string;
    surfaceType: TrackSurfaceType;
    finish?: SurfaceFinish;
    position: vec3;
    size: vec3;
    expectedTraffic?: TrafficIntensity;
    customColor?: vec4;
  }
): TrackZoneVisualMetadata {
  const baseMaterial = BASE_TRACK_MATERIALS[config.surfaceType];
  
  // Apply custom color if provided
  const material: TrackMaterialProperties = {
    ...baseMaterial,
    baseColor: config.customColor ? vec4.clone(config.customColor) : vec4.clone(baseMaterial.baseColor)
  };
  
  // Apply finish modifications
  const finish = config.finish || SurfaceFinish.MATT;
  switch (finish) {
    case SurfaceFinish.POLISHED:
      material.roughness *= 0.3;
      material.clearCoat = Math.max(material.clearCoat, 0.8);
      break;
    case SurfaceFinish.ROUGH:
      material.roughness = Math.min(1.0, material.roughness * 1.5);
      break;
    case SurfaceFinish.WORN:
      material.roughness = Math.min(1.0, material.roughness * 1.2);
      material.clearCoat *= 0.5;
      break;
    case SurfaceFinish.WEATHERED:
      material.roughness = Math.min(1.0, material.roughness * 1.3);
      material.ambientOcclusion = Math.min(1.0, material.ambientOcclusion * 1.2);
      break;
  }
  
  // Create texture parameters based on surface type
  const textureParams: ProceduralTextureParams = {
    noiseScale: 0.1,
    noiseOctaves: 4,
    normalStrength: 1.0,
    microDetailScale: 0.01,
    wearSeed: Math.floor(Math.random() * 10000)
  };
  
  // Create reflection probe
  const reflectionProbe = createZoneReflectionProbe(
    config.surfaceType,
    config.position,
    config.size,
    zoneId
  );
  
  return {
    zoneId,
    displayName: config.displayName || zoneId,
    surfaceType: config.surfaceType,
    finish,
    material,
    textureParams,
    wearState: { ...DEFAULT_WEAR_STATE },
    expectedTraffic: config.expectedTraffic || TrafficIntensity.MEDIUM,
    reflectionProbe
  };
}

/**
 * Predefined zone configurations for common track types
 */
export const PREDEFINED_ZONE_CONFIGS: Record<string, Partial<TrackZoneVisualMetadata>> = {
  'start_line': {
    surfaceType: TrackSurfaceType.RUBBER,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.EXTREME
  },
  'finish_line': {
    surfaceType: TrackSurfaceType.RUBBER,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.HEAVY
  },
  'checkpoint': {
    surfaceType: TrackSurfaceType.METAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.HEAVY
  },
  'boost_pad': {
    surfaceType: TrackSurfaceType.METAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.EXTREME
  },
  'ice_section': {
    surfaceType: TrackSurfaceType.ICE,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'volcanic_path': {
    surfaceType: TrackSurfaceType.VOLCANIC_ROCK,
    finish: SurfaceFinish.ROUGH,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'crystal_cave': {
    surfaceType: TrackSurfaceType.CRYSTAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.LIGHT
  },
  'obsidian_bridge': {
    surfaceType: TrackSurfaceType.OBSIDIAN,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'sand_trap': {
    surfaceType: TrackSurfaceType.SAND,
    finish: SurfaceFinish.ROUGH,
    expectedTraffic: TrafficIntensity.LIGHT
  },
  'wooden_ramp': {
    surfaceType: TrackSurfaceType.WOOD,
    finish: SurfaceFinish.WEATHERED,
    expectedTraffic: TrafficIntensity.MEDIUM
  }
};

// ============================================================================
// MAIN.JS INTEGRATION UTILITIES
// ============================================================================

/**
 * Integration helper for main.js createStaticBox function
 * Call this before creating the static box to get appropriate material
 * 
 * @example
 * ```typescript
 * // In main.js createStaticBox:
 * const trackMaterial = getTrackMaterialForZone('track_01', TrackSurfaceType.METAL);
 * const matInstance = trackMaterial.createInstance(engine);
 * ```
 */
export function getTrackMaterialForZone(
  zoneId: string,
  surfaceType: TrackSurfaceType,
  quality?: MaterialQuality
): {
  properties: TrackMaterialProperties;
  surfaceType: TrackSurfaceType;
  quality: MaterialQuality;
  applyWear: (wearState: TrackWearState) => TrackMaterialProperties;
} {
  const baseProps = BASE_TRACK_MATERIALS[surfaceType];
  const materialQuality = quality || MaterialQuality.HIGH;
  
  return {
    properties: createMaterialVariant(baseProps, materialQuality),
    surfaceType,
    quality: materialQuality,
    applyWear: (wearState: TrackWearState) => 
      applyWearToMaterial(baseProps, wearState, surfaceType)
  };
}

/**
 * Creates a material instance suitable for main.js integration
 * Returns null if Filament is not available
 */
export function createMainJSCompatibleMaterial(
  engine: Filament.Engine | undefined,
  surfaceType: TrackSurfaceType,
  colorOverride?: [number, number, number],
  quality: MaterialQuality = MaterialQuality.HIGH
): Filament.MaterialInstance | null {
  if (!engine) {
    console.warn('[TrackMaterials] No engine provided, returning null');
    return null;
  }
  
  const baseProps = BASE_TRACK_MATERIALS[surfaceType];
  
  // Apply color override if provided
  const props: TrackMaterialProperties = {
    ...baseProps,
    baseColor: colorOverride 
      ? vec4.fromValues(colorOverride[0], colorOverride[1], colorOverride[2], 1.0)
      : vec4.clone(baseProps.baseColor)
  };
  
  return createTrackMaterial(engine, props, quality);
}

/**
 * Performance optimizer that selects appropriate material quality
 * based on distance from camera and platform capabilities
 */
export function selectOptimalMaterialQuality(
  distanceFromCamera: number,
  isHighEndDevice: boolean = true
): MaterialQuality {
  if (!isHighEndDevice) {
    if (distanceFromCamera > 30) return MaterialQuality.MINIMAL;
    if (distanceFromCamera > 15) return MaterialQuality.LOW;
    return MaterialQuality.MEDIUM;
  }
  
  // High-end device quality selection
  if (distanceFromCamera > 60) return MaterialQuality.LOW;
  if (distanceFromCamera > 30) return MaterialQuality.MEDIUM;
  if (distanceFromCamera > 10) return MaterialQuality.HIGH;
  return MaterialQuality.ULTRA;
}

/**
 * Batch material updater for efficient LOD transitions
 * Call this during the render loop to update track materials
 */
export class TrackMaterialBatchUpdater {
  private zoneMaterials: Map<string, {
    metadata: TrackZoneVisualMetadata;
    instances: Filament.MaterialInstance[];
    lastQuality: MaterialQuality;
  }> = new Map();
  
  private cameraPosition: vec3 = vec3.create();
  private isHighEndDevice: boolean = true;
  
  constructor(private engine: Filament.Engine) {}
  
  /**
   * Register a zone for material management
   */
  registerZone(metadata: TrackZoneVisualMetadata): void {
    this.zoneMaterials.set(metadata.zoneId, {
      metadata,
      instances: [],
      lastQuality: MaterialQuality.HIGH
    });
  }
  
  /**
   * Add a material instance to a zone's management
   */
  addInstance(zoneId: string, instance: Filament.MaterialInstance): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (zone) {
      zone.instances.push(instance);
    }
  }
  
  /**
   * Update camera position for LOD calculations
   */
  setCameraPosition(position: vec3): void {
    vec3.copy(this.cameraPosition, position);
  }
  
  /**
   * Set device capability tier
   */
  setDeviceCapabilities(isHighEnd: boolean): void {
    this.isHighEndDevice = isHighEnd;
  }
  
  /**
   * Update all materials based on current camera position
   * Call once per frame
   */
  update(deltaTime: number): void {
    for (const [zoneId, zone] of this.zoneMaterials) {
      const distance = vec3.distance(
        this.cameraPosition, 
        zone.metadata.reflectionProbe?.position || vec3.create()
      );
      
      const optimalQuality = selectOptimalMaterialQuality(
        distance, 
        this.isHighEndDevice
      );
      
      // Only update if quality changed
      if (optimalQuality !== zone.lastQuality) {
        this.updateZoneQuality(zoneId, optimalQuality);
        zone.lastQuality = optimalQuality;
      }
      
      // Update wear simulation
      const newWearState = updateWearState(
        zone.metadata.wearState,
        DEFAULT_WEAR_CONFIG,
        deltaTime
      );
      
      zone.metadata.wearState = newWearState;
    }
  }
  
  private updateZoneQuality(zoneId: string, quality: MaterialQuality): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (!zone) return;
    
    // Create new material variant
    const newProps = createMaterialVariant(zone.metadata.material, quality);
    const wornProps = applyWearToMaterial(
      newProps, 
      zone.metadata.wearState, 
      zone.metadata.surfaceType
    );
    
    // Update all instances
    for (const instance of zone.instances) {
      if (instance) {
        instance.setParameter('roughness', wornProps.roughness);
        instance.setParameter('metallic', wornProps.metallic);
        instance.setParameter('clearCoat', wornProps.clearCoat);
      }
    }
  }
  
  /**
   * Get wear state for a specific zone
   */
  getWearState(zoneId: string): TrackWearState | null {
    return this.zoneMaterials.get(zoneId)?.metadata.wearState || null;
  }
  
  /**
   * Record marble contact for wear simulation
   */
  recordContact(
    zoneId: string, 
    count: number, 
    speed: number, 
    isSkidding: boolean = false
  ): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (!zone) return;
    
    zone.metadata.wearState = updateWearState(
      zone.metadata.wearState,
      DEFAULT_WEAR_CONFIG,
      0, // No time delta for event-based updates
      { count, speed, isSkidding }
    );
  }
  
  /**
   * Dispose all managed resources
   */
  dispose(): void {
    for (const zone of this.zoneMaterials.values()) {
      for (const instance of zone.instances) {
        // Note: Material instances are typically managed by the engine
        // Only dispose if explicitly required by your Filament setup
      }
    }
    this.zoneMaterials.clear();
  }
}

// ============================================================================
// EXPORTS FOR MAIN.JS INTEGRATION
// ============================================================================

/**
 * Quick reference integration guide for main.js:
 * 
 * 1. Import this module:
 *    import * as TrackMaterials from './visuals/agent4_track_materials.js';
 * 
 * 2. In createStaticBox, get material based on zone type:
 *    const trackMat = TrackMaterials.getTrackMaterialForZone(
 *      zoneId, 
 *      TrackMaterials.TrackSurfaceType.METAL
 *    );
 * 
 * 3. Create material instance:
 *    const matInstance = TrackMaterials.createTrackMaterial(
 *      this.engine,
 *      trackMat.properties
 *    );
 * 
 * 4. For dynamic wear, use the batch updater:
 *    this.trackMaterialUpdater = new TrackMaterials.TrackMaterialBatchUpdater(this.engine);
 *    this.trackMaterialUpdater.registerZone(zoneMetadata);
 *    this.trackMaterialUpdater.addInstance(zoneId, matInstance);
 * 
 * 5. In the update loop:
 *    this.trackMaterialUpdater.setCameraPosition(cameraPos);
 *    this.trackMaterialUpdater.update(deltaTime);
 * 
 * 6. Record contacts for wear:
 *    this.trackMaterialUpdater.recordContact(zoneId, 1, speed, isSkidding);
 */

// Default export for convenience
export default {
  TrackSurfaceType,
  SurfaceFinish,
  TrafficIntensity,
  MaterialQuality,
  BASE_TRACK_MATERIALS,
  DEFAULT_WEAR_STATE,
  DEFAULT_WEAR_CONFIG,
  DEFAULT_ZONE_PROBE,
  PREDEFINED_ZONE_CONFIGS,
  getTrackMaterialForZone,
  createTrackMaterial,
  createMainJSCompatibleMaterial,
  createZoneVisualMetadata,
  createZoneReflectionProbe,
  createMaterialVariant,
  updateWearState,
  applyWearToMaterial,
  blendReflectionProbes,
  selectOptimalMaterialQuality,
  TrackMaterialBatchUpdater
};

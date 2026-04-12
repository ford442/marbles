/**
 * Agent 4: Track Surface Materials - Types
 * Core enums and interfaces for track material system
 */

import { vec3, vec4 } from 'gl-matrix';

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

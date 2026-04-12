/**
 * Preset configurations for marble textures, circuit patterns, metal grain, and weathering
 */

import { VeinTextureConfig, MetalGrainConfig, WeatheringConfig } from './types';
import {
  PARALLAX_MAPPING_FRAGMENT_SHADER,
  VELOCITY_CIRCUIT_FRAGMENT_SHADER,
  WEATHERING_OVERLAY_FRAGMENT_SHADER,
  DEFORMATION_VERTEX_SHADER
} from './shaders';

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Preset configurations for common marble types
 */
export const MarbleTexturePresets = {
  /** Classic white marble with gray veins */
  classicWhite: {
    baseColor: [0.95, 0.95, 0.93] as [number, number, number],
    veinColor: [0.5, 0.5, 0.52] as [number, number, number],
    layers: 3,
    thickness: 0.15,
    turbulence: 0.2,
    resolution: 512
  } as VeinTextureConfig,

  /** Dark marble with gold veins */
  darkGold: {
    baseColor: [0.15, 0.15, 0.18] as [number, number, number],
    veinColor: [0.8, 0.7, 0.35] as [number, number, number],
    layers: 4,
    thickness: 0.1,
    turbulence: 0.3,
    resolution: 512
  } as VeinTextureConfig,

  /** Green marble */
  greenMarble: {
    baseColor: [0.75, 0.85, 0.75] as [number, number, number],
    veinColor: [0.3, 0.5, 0.35] as [number, number, number],
    layers: 3,
    thickness: 0.12,
    turbulence: 0.25,
    resolution: 512
  } as VeinTextureConfig
};

/**
 * Preset circuit patterns
 */
export const CircuitPatternPresets = {
  /** Neon cyan circuit */
  neonCyan: {
    gridType: 'hex' as const,
    circuitColor: [0.0, 0.9, 1.0] as [number, number, number],
    backgroundColor: [0.02, 0.02, 0.04] as [number, number, number],
    lineThickness: 0.02,
    density: 8,
    animationSpeed: 1.0,
    glowIntensity: 0.8,
    resolution: 512
  },

  /** Cyberpunk magenta */
  cyberMagenta: {
    gridType: 'square' as const,
    circuitColor: [1.0, 0.0, 0.6] as [number, number, number],
    backgroundColor: [0.05, 0.0, 0.05] as [number, number, number],
    lineThickness: 0.025,
    density: 12,
    animationSpeed: 2.0,
    glowIntensity: 1.0,
    resolution: 512
  },

  /** Radial energy core */
  radialCore: {
    gridType: 'radial' as const,
    circuitColor: [0.0, 1.0, 0.5] as [number, number, number],
    backgroundColor: [0.02, 0.05, 0.03] as [number, number, number],
    lineThickness: 0.015,
    density: 6,
    animationSpeed: 1.5,
    glowIntensity: 0.9,
    resolution: 512
  }
};

/**
 * Preset metal grain configurations
 */
export const MetalGrainPresets = {
  /** Fine brushed aluminum */
  fineBrushed: {
    direction: 0,
    scale: 2,
    anisotropy: 0.8,
    scratchIntensity: 0.2,
    resolution: 512
  } as MetalGrainConfig,

  /** Heavy brushed steel */
  heavyBrushed: {
    direction: 45,
    scale: 1,
    anisotropy: 0.9,
    scratchIntensity: 0.4,
    resolution: 512
  } as MetalGrainConfig,

  /** Circular polish pattern */
  circularPolish: {
    direction: 90,
    scale: 3,
    anisotropy: 0.6,
    scratchIntensity: 0.1,
    resolution: 512
  } as MetalGrainConfig
};

/**
 * Preset weathering configurations
 */
export const WeatheringPresets = {
  /** New/clean surface */
  newSurface: {
    wearAmount: 0.0,
    dirtLevel: 0.0,
    rustLevel: 0.0,
    scale: 1,
    resolution: 512
  } as WeatheringConfig,

  /** Slightly worn */
  slightlyWorn: {
    wearAmount: 0.2,
    dirtLevel: 0.1,
    rustLevel: 0.05,
    scale: 1,
    resolution: 512
  } as WeatheringConfig,

  /** Heavily weathered */
  heavilyWeathered: {
    wearAmount: 0.6,
    dirtLevel: 0.4,
    rustLevel: 0.3,
    scale: 2,
    resolution: 512
  } as WeatheringConfig,

  /** Ancient/rusted */
  ancient: {
    wearAmount: 0.8,
    dirtLevel: 0.6,
    rustLevel: 0.7,
    scale: 3,
    resolution: 512
  } as WeatheringConfig
};

// ============================================================================
// EXPORT SHADER COLLECTION
// ============================================================================

/**
 * All enhanced shader strings for easy import
 */
export const EnhancedShaders = {
  parallaxMapping: PARALLAX_MAPPING_FRAGMENT_SHADER,
  velocityCircuit: VELOCITY_CIRCUIT_FRAGMENT_SHADER,
  weatheringOverlay: WEATHERING_OVERLAY_FRAGMENT_SHADER,
  deformationVertex: DEFORMATION_VERTEX_SHADER
};

/**
 * All presets for easy access
 */
export const AllPresets = {
  marble: MarbleTexturePresets,
  circuit: CircuitPatternPresets,
  metalGrain: MetalGrainPresets,
  weathering: WeatheringPresets
};

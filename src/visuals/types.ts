/**
 * Common types and interfaces for the visuals module
 */

/**
 * 3D Vector interface for noise inputs
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Noise generation options
 */
export interface NoiseOptions {
  /** Number of octaves for layered noise */
  octaves?: number;
  /** Lacunarity - frequency multiplier per octave */
  lacunarity?: number;
  /** Gain - amplitude multiplier per octave */
  gain?: number;
  /** Seed for deterministic noise */
  seed?: number;
  /** Scale factor for input coordinates */
  scale?: number;
}

/**
 * Marble vein texture configuration
 */
export interface VeinTextureConfig {
  /** Base stone color */
  baseColor: [number, number, number];
  /** Vein color */
  veinColor: [number, number, number];
  /** Number of vein layers */
  layers: number;
  /** Vein thickness (0-1) */
  thickness: number;
  /** Vein turbulence/wiggle */
  turbulence: number;
  /** Texture resolution */
  resolution: number;
}

/**
 * Circuit pattern configuration
 */
export interface CircuitPatternConfig {
  /** Grid type: 'hex', 'square', or 'radial' */
  gridType: 'hex' | 'square' | 'radial';
  /** Primary circuit color */
  circuitColor: [number, number, number];
  /** Background color */
  backgroundColor: [number, number, number];
  /** Line thickness (0-1) */
  lineThickness: number;
  /** Grid density (cells per unit) */
  density: number;
  /** Animation speed (0 for static) */
  animationSpeed: number;
  /** Glow intensity */
  glowIntensity: number;
  /** Resolution */
  resolution: number;
}

/**
 * Metal grain configuration
 */
export interface MetalGrainConfig {
  /** Grain direction in degrees */
  direction: number;
  /** Grain scale/fineness */
  scale: number;
  /** Anisotropy strength (0-1) */
  anisotropy: number;
  /** Scratch intensity */
  scratchIntensity: number;
  /** Resolution */
  resolution: number;
}

/**
 * Weathering map configuration
 */
export interface WeatheringConfig {
  /** Wear amount (0-1) */
  wearAmount: number;
  /** Dirt accumulation (0-1) */
  dirtLevel: number;
  /** Rust/oxidation (0-1) */
  rustLevel: number;
  /** Pattern scale */
  scale: number;
  /** Resolution */
  resolution: number;
}

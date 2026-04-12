/**
 * Agent 2: Complexity Layer - Procedural Textures & Vertex Deformations
 * Marble Visual Overhaul Agent Swarm
 * 
 * This module provides:
 * - Advanced procedural noise functions (FBM, Simplex, Worley)
 * - Texture generators for marble veins, circuits, metal grain, weathering
 * - Vertex deformation systems for impact, rolling, and bounce effects
 * - Enhanced shader code strings with parallax mapping and velocity reactivity
 * 
 * Performance Budget: < 0.3ms per texture generation, < 0.1ms per deformation update
 * @module agent2_complexity_refinement
 */

import * as Filament from 'filament';
import { vec3, vec4, mat4, quat } from 'gl-matrix';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

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

/**
 * Vertex deformation state
 */
export interface DeformationState {
  /** Current deformation amount (0-1) */
  intensity: number;
  /** Deformation direction vector */
  direction: vec3;
  /** Decay rate per second */
  decayRate: number;
  /** Time of impact/start */
  startTime: number;
  /** Frequency for oscillation */
  frequency: number;
}

/**
 * Impact deformation parameters
 */
export interface ImpactParams {
  /** Impact force magnitude */
  force: number;
  /** Impact normal direction */
  normal: vec3;
  /** Maximum squish factor */
  maxSquish: number;
  /** Recovery time in seconds */
  recoveryTime: number;
}

/**
 * Rolling deformation parameters
 */
export interface RollParams {
  /** Angular velocity vector */
  angularVelocity: vec3;
  /** Linear velocity vector */
  linearVelocity: vec3;
  /** Maximum flattening amount */
  maxFlatten: number;
  /** Roll axis alignment factor */
  alignment: number;
}

/**
 * Bounce wobble parameters
 */
export interface BounceParams {
  /** Initial wobble intensity */
  intensity: number;
  /** Wobble frequency */
  frequency: number;
  /** Damping factor */
  damping: number;
  /** Number of harmonics */
  harmonics: number;
}

// ============================================================================
// PSEUDO-RANDOM NUMBER GENERATION
// ============================================================================

/**
 * Deterministic pseudo-random number generator for consistent noise
 */
export class SeededRandom {
  private seed: number;
  private current: number;

  constructor(seed: number = 1337) {
    this.seed = seed;
    this.current = seed;
  }

  /**
   * Get next random number in [0, 1)
   */
  next(): number {
    // Xorshift algorithm
    this.current ^= this.current << 13;
    this.current ^= this.current >>> 17;
    this.current ^= this.current << 5;
    return ((this.current >>> 0) / 4294967296);
  }

  /**
   * Get next random number in [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Reset to initial seed
   */
  reset(): void {
    this.current = this.seed;
  }

  /**
   * Generate random 2D gradient vector
   */
  gradient2D(): [number, number] {
    const angle = this.next() * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  }

  /**
   * Generate random 3D gradient vector
   */
  gradient3D(): [number, number, number] {
    const theta = this.next() * Math.PI * 2;
    const phi = Math.acos(2 * this.next() - 1);
    return [
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ];
  }
}

// ============================================================================
// PERMUTATION TABLES
// ============================================================================

/**
 * Permutation table for Simplex noise
 */
const PERMUTATION_TABLE: number[] = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];

/**
 * Get permuted value
 */
function perm(i: number): number {
  return PERMUTATION_TABLE[i & 255];
}

// ============================================================================
// SIMPLEX NOISE IMPLEMENTATION
// ============================================================================

/**
 * 3D Simplex noise corner contributions
 */
const SIMPLEX_CORNERS = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];

/**
 * Skewing factor for 3D simplex grid
 */
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

/**
 * Generate 3D Simplex noise
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param seed - Optional seed for variation
 * @returns Noise value in [-1, 1] range
 */
export function generateSimplexNoise(x: number, y: number, z: number, seed: number = 0): number {
  // Apply seed offset
  x += seed * 1.337;
  y += seed * 2.718;
  z += seed * 3.142;

  // Skew the input space to determine which simplex cell we're in
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  // Determine which simplex we are in
  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    } else if (x0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
    } else {
      i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
    }
  } else {
    if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  // Calculate the contribution from the four corners
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) {
    n0 = 0.0;
  } else {
    t0 *= t0;
    n0 = t0 * t0 * grad(perm(i + perm(j + perm(k))), x0, y0, z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) {
    n1 = 0.0;
  } else {
    t1 *= t1;
    n1 = t1 * t1 * grad(perm(i + i1 + perm(j + j1 + perm(k + k1))), x1, y1, z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) {
    n2 = 0.0;
  } else {
    t2 *= t2;
    n2 = t2 * t2 * grad(perm(i + i2 + perm(j + j2 + perm(k + k2))), x2, y2, z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) {
    n3 = 0.0;
  } else {
    t3 *= t3;
    n3 = t3 * t3 * grad(perm(i + 1 + perm(j + 1 + perm(k + 1))), x3, y3, z3);
  }

  // Add contributions from each corner to get the final noise value
  return 32.0 * (n0 + n1 + n2 + n3);
}

/**
 * Gradient function for simplex noise
 */
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// ============================================================================
// FRACTAL BROWNIAN MOTION (FBM)
// ============================================================================

/**
 * Generate 3D Fractal Brownian Motion noise
 * Combines multiple octaves of simplex noise for detailed fractal patterns
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param options - Noise generation options
 * @returns FBM noise value (typically in [-1, 1] but can vary with octaves)
 */
export function generateFBMNoise(
  x: number,
  y: number,
  z: number,
  options: NoiseOptions = {}
): number {
  const {
    octaves = 4,
    lacunarity = 2.0,
    gain = 0.5,
    seed = 0,
    scale = 1.0
  } = options;

  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += generateSimplexNoise(
      x * frequency,
      y * frequency,
      z * frequency,
      seed + i * 100
    ) * amplitude;

    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  // Normalize to [-1, 1]
  return value / maxValue;
}

/**
 * Generate ridged FBM noise (creates sharp ridges/veins)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param options - Noise generation options
 * @returns Ridged FBM noise value in [0, 1]
 */
export function generateRidgedFBM(
  x: number,
  y: number,
  z: number,
  options: NoiseOptions = {}
): number {
  const {
    octaves = 4,
    lacunarity = 2.0,
    gain = 0.5,
    seed = 0,
    scale = 1.0
  } = options;

  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    const noise = generateSimplexNoise(
      x * frequency,
      y * frequency,
      z * frequency,
      seed + i * 100
    );
    value += (1 - Math.abs(noise)) * amplitude;

    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Generate turbulent FBM noise (absolute value of noise)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param options - Noise generation options
 * @returns Turbulent FBM noise value in [0, 1]
 */
export function generateTurbulentFBM(
  x: number,
  y: number,
  z: number,
  options: NoiseOptions = {}
): number {
  const fbm = generateFBMNoise(x, y, z, options);
  return Math.abs(fbm);
}

// ============================================================================
// WORLEY (CELLULAR) NOISE
// ============================================================================

/**
 * Feature point data for Worley noise
 */
interface FeaturePoint {
  position: [number, number, number];
  id: number;
}

/**
 * Generate 3D Worley (cellular/Voronoi) noise
 * Creates organic cell-like patterns perfect for marble veins
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param seed - Random seed
 * @returns Object with distance to nearest (F1) and second nearest (F2) feature points
 */
export function generateWorleyNoise(
  x: number,
  y: number,
  z: number,
  seed: number = 0
): { f1: number; f2: number; f1Id: number; f2Id: number } {
  // Determine which cell we're in
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const cellZ = Math.floor(z);

  // Local position within cell
  const localX = x - cellX;
  const localY = y - cellY;
  const localZ = z - cellZ;

  let f1 = Infinity;
  let f2 = Infinity;
  let f1Id = 0;
  let f2Id = 0;

  // Check neighboring cells (3x3x3 grid)
  for (let zOffset = -1; zOffset <= 1; zOffset++) {
    for (let yOffset = -1; yOffset <= 1; yOffset++) {
      for (let xOffset = -1; xOffset <= 1; xOffset++) {
        const neighborCellX = cellX + xOffset;
        const neighborCellY = cellY + yOffset;
        const neighborCellZ = cellZ + zOffset;

        // Generate deterministic feature point for this cell
        const rng = new SeededRandom(
          neighborCellX * 73856093 +
          neighborCellY * 19349663 +
          neighborCellZ * 83492791 +
          seed
        );

        // Number of feature points in this cell (usually 1-3)
        const numPoints = 1 + Math.floor(rng.next() * 2);

        for (let p = 0; p < numPoints; p++) {
          const pointId = p;
          const px = xOffset + rng.next();
          const py = yOffset + rng.next();
          const pz = zOffset + rng.next();

          const dx = localX - px;
          const dy = localY - py;
          const dz = localZ - pz;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < f1) {
            f2 = f1;
            f2Id = f1Id;
            f1 = distSq;
            f1Id = pointId + neighborCellX * 1000 + neighborCellY * 100 + neighborCellZ * 10;
          } else if (distSq < f2) {
            f2 = distSq;
            f2Id = pointId + neighborCellX * 1000 + neighborCellY * 100 + neighborCellZ * 10;
          }
        }
      }
    }
  }

  return {
    f1: Math.sqrt(f1),
    f2: Math.sqrt(f2),
    f1Id,
    f2Id
  };
}

/**
 * Generate marble vein pattern using Worley noise
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param seed - Random seed
 * @returns Vein intensity in [0, 1]
 */
export function generateMarbleVeinPattern(
  x: number,
  y: number,
  z: number,
  seed: number = 0
): number {
  const worley = generateWorleyNoise(x, y, z, seed);
  
  // Create vein pattern from distance difference
  const vein = worley.f2 - worley.f1;
  
  // Add FBM turbulence for organic look
  const turbulence = generateFBMNoise(x * 2, y * 2, z * 2, {
    octaves: 3,
    gain: 0.5,
    scale: 1.0,
    seed
  }) * 0.1;
  
  return Math.max(0, Math.min(1, vein + turbulence));
}

// ============================================================================
// 2D NOISE VARIANTS (for texture generation)
// ============================================================================

/**
 * Generate 2D Simplex noise
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param seed - Random seed
 * @returns Noise value in [-1, 1]
 */
export function generateSimplexNoise2D(x: number, y: number, seed: number = 0): number {
  // Simplex skew constants for 2D
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  // Apply seed offset
  x += seed * 1.337;
  y += seed * 2.718;

  // Skew the input space
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;

  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  // Determine which simplex we are in
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  // Calculate contributions from the three corners
  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * grad2(perm(i + perm(j)), x0, y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * grad2(perm(i + i1 + perm(j + j1)), x1, y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * grad2(perm(i + 1 + perm(j + 1)), x2, y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

/**
 * 2D gradient function
 */
function grad2(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
}

/**
 * Generate 2D FBM noise
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param options - Noise options
 * @returns FBM noise value in [-1, 1]
 */
export function generateFBMNoise2D(
  x: number,
  y: number,
  options: NoiseOptions = {}
): number {
  const {
    octaves = 4,
    lacunarity = 2.0,
    gain = 0.5,
    seed = 0,
    scale = 1.0
  } = options;

  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += generateSimplexNoise2D(
      x * frequency,
      y * frequency,
      seed + i * 100
    ) * amplitude;

    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

/**
 * Generate 2D Worley (cellular) noise
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param seed - Random seed
 * @returns Object with F1, F2 distances
 */
export function generateWorleyNoise2D(
  x: number,
  y: number,
  seed: number = 0
): { f1: number; f2: number } {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const localX = x - cellX;
  const localY = y - cellY;

  let f1 = Infinity;
  let f2 = Infinity;

  for (let yOffset = -1; yOffset <= 1; yOffset++) {
    for (let xOffset = -1; xOffset <= 1; xOffset++) {
      const rng = new SeededRandom(
        (cellX + xOffset) * 73856093 +
        (cellY + yOffset) * 19349663 +
        seed
      );

      const numPoints = 1 + Math.floor(rng.next() * 2);

      for (let p = 0; p < numPoints; p++) {
        const px = xOffset + rng.next();
        const py = yOffset + rng.next();

        const dx = localX - px;
        const dy = localY - py;
        const distSq = dx * dx + dy * dy;

        if (distSq < f1) {
          f2 = f1;
          f1 = distSq;
        } else if (distSq < f2) {
          f2 = distSq;
        }
      }
    }
  }

  return {
    f1: Math.sqrt(f1),
    f2: Math.sqrt(f2)
  };
}

// ============================================================================
// TEXTURE GENERATORS
// ============================================================================

/**
 * Canvas cache for texture generation
 */
let textureCanvas: HTMLCanvasElement | null = null;
let textureContext: CanvasRenderingContext2D | null = null;
let textureCache: Map<string, ImageData> = new Map();

/**
 * Initialize texture generation canvas
 */
function initializeTextureCanvas(): void {
  if (!textureCanvas) {
    textureCanvas = document.createElement('canvas');
    textureContext = textureCanvas.getContext('2d')!;
  }
}

/**
 * Create a marble vein texture with procedural generation
 * Uses layered Worley and FBM noise for realistic marble patterns
 * 
 * @param config - Vein texture configuration
 * @returns ImageData containing the generated texture
 */
export function createMarbleVeinTexture(config: VeinTextureConfig): ImageData {
  initializeTextureCanvas();
  const { width, height } = { width: config.resolution, height: config.resolution };
  
  textureCanvas!.width = width;
  textureCanvas!.height = height;
  
  const imageData = textureContext!.createImageData(width, height);
  const data = imageData.data;
  
  const [baseR, baseG, baseB] = config.baseColor;
  const [veinR, veinG, veinB] = config.veinColor;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      
      // Multiple layers of veins
      let veinIntensity = 0;
      
      for (let layer = 0; layer < config.layers; layer++) {
        const scale = 2 + layer * 1.5;
        const offset = layer * 100;
        
        // Worley noise for cell structure
        const worley = generateWorleyNoise2D(
          u * scale,
          v * scale,
          offset
        );
        
        // FBM for turbulence
        const turbulence = generateFBMNoise2D(
          u * scale * 2,
          v * scale * 2,
          { octaves: 3, scale: 1, seed: offset }
        ) * config.turbulence;
        
        // Combine for vein pattern
        const layerVein = Math.max(0, worley.f2 - worley.f1 + turbulence);
        const threshold = 1.0 - config.thickness * (1 - layer * 0.1);
        
        veinIntensity += smoothstep(threshold - 0.1, threshold + 0.1, layerVein) 
          * Math.pow(0.7, layer);
      }
      
      // Normalize and clamp
      veinIntensity = Math.min(1, veinIntensity * 1.5);
      
      // Mix colors
      const r = lerp(baseR, veinR, veinIntensity);
      const g = lerp(baseG, veinG, veinIntensity);
      const b = lerp(baseB, veinB, veinIntensity);
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = 255;
    }
  }
  
  const cacheKey = `vein_${JSON.stringify(config)}`;
  textureCache.set(cacheKey, imageData);
  
  return imageData;
}

/**
 * Create an animated circuit pattern texture
 * Generates hexagonal, square, or radial circuit patterns
 * 
 * @param config - Circuit pattern configuration
 * @param time - Animation time in seconds
 * @returns ImageData containing the generated pattern
 */
export function createCircuitPattern(
  config: CircuitPatternConfig,
  time: number = 0
): ImageData {
  initializeTextureCanvas();
  const { width, height } = { width: config.resolution, height: config.resolution };
  
  textureCanvas!.width = width;
  textureCanvas!.height = height;
  
  const imageData = textureContext!.createImageData(width, height);
  const data = imageData.data;
  
  const [bgR, bgG, bgB] = config.backgroundColor;
  const [circuitR, circuitG, circuitB] = config.circuitColor;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      
      let circuitValue = 0;
      
      switch (config.gridType) {
        case 'hex':
          circuitValue = generateHexCircuit(u, v, config, time);
          break;
        case 'square':
          circuitValue = generateSquareCircuit(u, v, config, time);
          break;
        case 'radial':
          circuitValue = generateRadialCircuit(u, v, config, time);
          break;
      }
      
      // Apply glow
      const glow = Math.pow(circuitValue, 0.5) * config.glowIntensity;
      const finalValue = Math.min(1, circuitValue + glow * 0.3);
      
      const r = lerp(bgR, circuitR, finalValue);
      const g = lerp(bgG, circuitG, finalValue);
      const b = lerp(bgB, circuitB, finalValue);
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = 255;
    }
  }
  
  return imageData;
}

/**
 * Generate hexagonal circuit pattern
 */
function generateHexCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const hexSize = 1.0 / config.density;
  const hexW = hexSize * Math.sqrt(3);
  const hexH = hexSize * 1.5;
  
  // Hex coordinates
  const row = Math.floor(v / hexH);
  const col = Math.floor(u / hexW + (row % 2) * 0.5);
  
  // Local position in hex
  const localU = (u - col * hexW + (row % 2) * hexW * 0.5) / hexSize;
  const localV = (v - row * hexH) / hexSize;
  
  // Distance from hex center
  const dx = localU - Math.sqrt(3) / 2;
  const dy = localV - 0.5;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  // Hex edge distance
  const hexDist = Math.max(
    Math.abs(dx),
    Math.abs(dx * 0.5 + dy * Math.sqrt(3) / 2),
    Math.abs(dx * 0.5 - dy * Math.sqrt(3) / 2)
  );
  
  // Animated circuit lines
  const anim = Math.sin(time * config.animationSpeed * 2 + row * 0.5 + col * 0.3) * 0.5 + 0.5;
  const lineWidth = config.lineThickness * hexSize;
  const edgeDist = Math.abs(hexDist - (0.8 - anim * 0.3));
  
  return smoothstep(lineWidth * 2, 0, edgeDist);
}

/**
 * Generate square circuit pattern
 */
function generateSquareCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const cellSize = 1.0 / config.density;
  
  const col = Math.floor(u / cellSize);
  const row = Math.floor(v / cellSize);
  
  const localU = (u - col * cellSize) / cellSize;
  const localV = (v - row * cellSize) / cellSize;
  
  // Animated energy flow
  const flow = (time * config.animationSpeed + col * 0.1) % 1;
  
  // Grid lines
  const lineWidth = config.lineThickness;
  const hLine = smoothstep(lineWidth, 0, Math.abs(localV - 0.5));
  const vLine = smoothstep(lineWidth, 0, Math.abs(localU - 0.5));
  
  // Corner nodes
  const cornerDist = Math.min(
    Math.sqrt(localU * localU + localV * localV),
    Math.sqrt((1 - localU) * (1 - localU) + localV * localV),
    Math.sqrt(localU * localU + (1 - localV) * (1 - localV)),
    Math.sqrt((1 - localU) * (1 - localU) + (1 - localV) * (1 - localV))
  );
  const node = smoothstep(lineWidth * 3, 0, cornerDist);
  
  // Energy pulse along lines
  const pulse = Math.exp(-Math.pow((localU - flow) * 10, 2));
  
  return Math.max(hLine, vLine, node * 0.7) + pulse * 0.3;
}

/**
 * Generate radial circuit pattern
 */
function generateRadialCircuit(
  u: number,
  v: number,
  config: CircuitPatternConfig,
  time: number
): number {
  const cx = 0.5;
  const cy = 0.5;
  
  const dx = u - cx;
  const dy = v - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  const rings = config.density * 2;
  const radialLines = Math.floor(config.density * 8);
  
  // Concentric rings
  const ringDist = Math.sin(dist * Math.PI * rings * 2) * 0.5 + 0.5;
  const ringPattern = smoothstep(config.lineThickness * 2, 0, 1 - ringDist);
  
  // Radial spokes
  const spokeAngle = (angle / (Math.PI * 2) * radialLines + time * config.animationSpeed) % 1;
  const spokePattern = smoothstep(config.lineThickness, 0, Math.min(spokeAngle, 1 - spokeAngle));
  
  // Central hub
  const hub = smoothstep(0.15, 0, dist);
  
  // Data streams
  const stream = Math.sin(dist * 20 - time * config.animationSpeed * 5) * 0.5 + 0.5;
  const streamPattern = stream * smoothstep(0.4, 0, Math.abs(dist - 0.25));
  
  return Math.max(ringPattern * 0.5, spokePattern * 0.8, hub, streamPattern * 0.6);
}

/**
 * Create anisotropic metal grain texture
 * Simulates brushed metal with directional grain patterns
 * 
 * @param config - Metal grain configuration
 * @returns ImageData containing the generated texture
 */
export function createMetalGrainTexture(config: MetalGrainConfig): ImageData {
  initializeTextureCanvas();
  const { width, height } = { width: config.resolution, height: config.resolution };
  
  textureCanvas!.width = width;
  textureCanvas!.height = height;
  
  const imageData = textureContext!.createImageData(width, height);
  const data = imageData.data;
  
  const angleRad = (config.direction * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      
      // Rotate to grain direction
      const grainU = u * cosA + v * sinA;
      const grainV = -u * sinA + v * cosA;
      
      // Anisotropic grain using FBM along grain direction
      const grainNoise = generateFBMNoise2D(
        grainU * config.scale * 10,
        grainV * config.scale * 2,
        { octaves: 4, gain: 0.6, lacunarity: 2.2 }
      );
      
      // Perpendicular noise for variation
      const crossNoise = generateFBMNoise2D(
        grainU * config.scale * 2,
        grainV * config.scale * 20,
        { octaves: 3, gain: 0.5, lacunarity: 2.0 }
      ) * (1 - config.anisotropy);
      
      // Scratches perpendicular to grain
      const scratchFreq = 50;
      const scratchPos = grainV * scratchFreq + crossNoise * 0.5;
      const scratch = Math.abs(scratchPos - Math.round(scratchPos));
      const scratchValue = smoothstep(0.02 + config.scratchIntensity * 0.05, 0, scratch);
      
      // Combine grain and scratches
      const grainValue = (grainNoise * 0.5 + 0.5) * (1 - config.anisotropy * 0.3);
      const finalValue = Math.max(0.1, grainValue - scratchValue * config.scratchIntensity);
      
      // Brushed metal appearance (grayscale)
      const brightness = finalValue * 255;
      
      const idx = (y * width + x) * 4;
      data[idx] = brightness;
      data[idx + 1] = brightness;
      data[idx + 2] = brightness;
      data[idx + 3] = 255;
    }
  }
  
  return imageData;
}

/**
 * Create weathering/dirt accumulation map
 * Generates realistic wear patterns for aged surfaces
 * 
 * @param config - Weathering configuration
 * @returns ImageData containing the weathering map (R=wear, G=dirt, B=rust, A=occlusion)
 */
export function createWeatheringMap(config: WeatheringConfig): ImageData {
  initializeTextureCanvas();
  const { width, height } = { width: config.resolution, height: config.resolution };
  
  textureCanvas!.width = width;
  textureCanvas!.height = height;
  
  const imageData = textureContext!.createImageData(width, height);
  const data = imageData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      
      // Base noise patterns
      const largeNoise = generateFBMNoise2D(
        u * config.scale * 2,
        v * config.scale * 2,
        { octaves: 3, seed: 1 }
      ) * 0.5 + 0.5;
      
      const detailNoise = generateFBMNoise2D(
        u * config.scale * 8,
        v * config.scale * 8,
        { octaves: 4, seed: 2 }
      ) * 0.5 + 0.5;
      
      // Wear pattern (affects edges and high points)
      const wearNoise = generateFBMNoise2D(
        u * config.scale * 4,
        v * config.scale * 4,
        { octaves: 3, seed: 3 }
      ) * 0.5 + 0.5;
      const wear = smoothstep(1 - config.wearAmount, 1, wearNoise * largeNoise);
      
      // Dirt accumulation (settles in crevices)
      const dirtNoise = generateFBMNoise2D(
        u * config.scale * 6,
        v * config.scale * 6,
        { octaves: 3, seed: 4 }
      ) * 0.5 + 0.5;
      const dirt = smoothstep(0, config.dirtLevel, dirtNoise * (1 - detailNoise));
      
      // Rust formation (needs moisture + time)
      const rustNoise = generateFBMNoise2D(
        u * config.scale * 5,
        v * config.scale * 5,
        { octaves: 4, seed: 5 }
      ) * 0.5 + 0.5;
      const rustPattern = rustNoise * largeNoise;
      const rust = smoothstep(0.3, 0.3 + config.rustLevel * 0.7, rustPattern);
      
      // Ambient occlusion (cavities are darker)
      const occlusion = detailNoise * 0.5 + 0.5;
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.floor(wear * 255);        // R: Wear
      data[idx + 1] = Math.floor(dirt * 255);    // G: Dirt
      data[idx + 2] = Math.floor(rust * 255);    // B: Rust
      data[idx + 3] = Math.floor(occlusion * 255); // A: Occlusion
    }
  }
  
  return imageData;
}

// ============================================================================
// VERTEX DEFORMATION SYSTEMS
// ============================================================================

/**
 * Generate impact deformation - sphere squish effect
 * Creates a deformation that compresses the mesh along the impact normal
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Impact parameters
 * @param time - Current time
 * @returns Deformed position
 */
export function generateImpactDeformation(
  position: vec3,
  normal: vec3,
  params: ImpactParams,
  time: number
): vec3 {
  const age = time - (performance.now() / 1000 - params.recoveryTime);
  
  if (age > params.recoveryTime || age < 0) {
    return vec3.clone(position);
  }
  
  // Recovery curve (elastic bounce)
  const t = age / params.recoveryTime;
  const recovery = Math.exp(-t * 4) * Math.sin(t * Math.PI * 4);
  
  // Squish factor based on impact force
  const squishAmount = params.force * params.maxSquish * recovery;
  
  // Deform along impact normal
  const deformation = vec3.create();
  vec3.scale(deformation, params.normal, -squishAmount);
  
  // Bulge perpendicular to normal (volume preservation)
  const distanceFromCenter = vec3.length(position);
  const bulgeFactor = squishAmount * 0.3 * (1 - distanceFromCenter);
  
  // Project position onto plane perpendicular to impact normal
  const dotPN = vec3.dot(position, params.normal);
  const parallel = vec3.create();
  vec3.scale(parallel, params.normal, dotPN);
  
  const perpendicular = vec3.create();
  vec3.sub(perpendicular, position, parallel);
  vec3.normalize(perpendicular, perpendicular);
  vec3.scaleAndAdd(deformation, deformation, perpendicular, bulgeFactor);
  
  // Apply deformation
  const result = vec3.create();
  vec3.add(result, position, deformation);
  
  return result;
}

/**
 * Generate roll flattening deformation
 * Flattens the sphere where it contacts the ground based on angular velocity
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Roll parameters
 * @returns Deformed position
 */
export function generateRollFlattening(
  position: vec3,
  normal: vec3,
  params: RollParams
): vec3 {
  // Calculate rotation axis from angular velocity
  const angularSpeed = vec3.length(params.angularVelocity);
  if (angularSpeed < 0.01) {
    return vec3.clone(position);
  }
  
  const rollAxis = vec3.create();
  vec3.normalize(rollAxis, params.angularVelocity);
  
  // Find the "bottom" of the sphere relative to roll direction
  const linearSpeed = vec3.length(params.linearVelocity);
  const velocityDir = vec3.create();
  
  if (linearSpeed > 0.01) {
    vec3.normalize(velocityDir, params.linearVelocity);
  } else {
    vec3.set(velocityDir, 0, -1, 0);
  }
  
  // Calculate how much this vertex faces the "ground" in roll direction
  const dotWithDown = -normal[1]; // Assuming Y is up
  const dotWithVelocity = vec3.dot(normal, velocityDir);
  
  // Flattening occurs on the bottom in the direction of motion
  const flattenFactor = Math.max(0, dotWithDown) * 
    Math.max(0, dotWithVelocity) * 
    Math.min(1, angularSpeed * 0.1);
  
  // Apply flattening
  const flattenAmount = flattenFactor * params.maxFlatten;
  const result = vec3.clone(position);
  result[1] -= flattenAmount; // Flatten downward
  
  // Bulge to preserve volume
  const bulge = flattenAmount * 0.5;
  const horizontalDist = Math.sqrt(position[0] * position[0] + position[2] * position[2]);
  if (horizontalDist > 0.001) {
    result[0] += (position[0] / horizontalDist) * bulge * flattenFactor;
    result[2] += (position[2] / horizontalDist) * bulge * flattenFactor;
  }
  
  return result;
}

/**
 * Generate bounce wobble deformation
 * Creates oscillating jelly-like deformation after impact
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Bounce parameters
 * @param time - Current time
 * @returns Deformed position
 */
export function generateBounceWobble(
  position: vec3,
  normal: vec3,
  params: BounceParams,
  time: number
): vec3 {
  const distanceFromCenter = vec3.length(position);
  
  // Multiple harmonics for complex wobble
  let wobbleAmount = 0;
  
  for (let h = 1; h <= params.harmonics; h++) {
    const freq = params.frequency * h;
    const decay = Math.exp(-time * params.damping * h);
    const phase = time * freq + h * 0.5;
    
    // Spherical harmonic-like pattern
    const theta = Math.atan2(position[2], position[0]);
    const phi = Math.acos(Math.max(-1, Math.min(1, position[1] / (distanceFromCenter + 0.001))));
    
    const harmonic = Math.sin(h * theta) * Math.cos(h * phi * 0.5);
    wobbleAmount += params.intensity * decay * Math.sin(phase) * harmonic / h;
  }
  
  // Apply wobble along normal
  const result = vec3.create();
  vec3.scaleAndAdd(result, position, normal, wobbleAmount);
  
  return result;
}

/**
 * Composite deformation system
 * Combines multiple deformation effects
 */
export interface CompositeDeformation {
  impact?: { params: ImpactParams; startTime: number };
  roll?: { params: RollParams };
  wobble?: { params: BounceParams; startTime: number };
}

/**
 * Apply composite deformation to a vertex
 * @param position - Original position
 * @param normal - Vertex normal
 * @param deformations - Active deformations
 * @param time - Current time
 * @returns Final deformed position
 */
export function applyCompositeDeformation(
  position: vec3,
  normal: vec3,
  deformations: CompositeDeformation,
  time: number
): vec3 {
  let result = vec3.clone(position);
  let currentNormal = vec3.clone(normal);
  
  // Apply impact deformation
  if (deformations.impact) {
    result = generateImpactDeformation(
      result,
      currentNormal,
      deformations.impact.params,
      time
    );
  }
  
  // Apply roll flattening
  if (deformations.roll) {
    result = generateRollFlattening(result, currentNormal, deformations.roll.params);
  }
  
  // Apply bounce wobble
  if (deformations.wobble) {
    const wobbleTime = time - deformations.wobble.startTime;
    result = generateBounceWobble(result, currentNormal, deformations.wobble.params, wobbleTime);
  }
  
  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Smoothstep interpolation
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Convert ImageData to Filament Texture
 * @param engine - Filament engine
 * @param imageData - Image data to convert
 * @returns Filament texture
 */
export function imageDataToTexture(
  engine: Filament.Engine,
  imageData: ImageData
): Filament.Texture {
  const texture = new Filament.Texture.Builder()
    .width(imageData.width)
    .height(imageData.height)
    .levels(Math.floor(Math.log2(Math.max(imageData.width, imageData.height))) + 1)
    .format(Filament.PixelFormat.RGBA8)
    .sampler(Filament.TextureSamplerType.SAMPLER_2D)
    .build(engine);

  texture.setImage(0, new Uint8Array(imageData.data.buffer));
  texture.generateMipmaps();

  return texture;
}

// ============================================================================
// ENHANCED SHADER CODE STRINGS
// ============================================================================

/**
 * Enhanced fragment shader with parallax occlusion mapping
 * Provides depth illusion without tessellation
 */
export const PARALLAX_MAPPING_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D albedoTexture;
uniform sampler2D normalTexture;
uniform sampler2D heightTexture;
uniform sampler2D roughnessTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uParallaxScale;
uniform float uParallaxSteps;
uniform float uSpecularIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

// Parallax Occlusion Mapping
vec2 parallaxOcclusionMapping(vec2 uv, vec3 viewDirTangent) {
    float layerDepth = 1.0 / uParallaxSteps;
    float currentLayerDepth = 0.0;
    
    vec2 deltaUv = viewDirTangent.xy * uParallaxScale / uParallaxSteps;
    vec2 currentUv = uv;
    
    float currentDepthMapValue = texture(heightTexture, currentUv).r;
    
    // Ray march through layers
    for (int i = 0; i < 32; i++) {
        if (float(i) >= uParallaxSteps) break;
        if (currentLayerDepth >= currentDepthMapValue) break;
        
        currentUv -= deltaUv;
        currentDepthMapValue = texture(heightTexture, currentUv).r;
        currentLayerDepth += layerDepth;
    }
    
    // Interpolate between layers for smooth result
    vec2 prevUv = currentUv + deltaUv;
    float afterDepth = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = texture(heightTexture, prevUv).r - currentLayerDepth + layerDepth;
    
    float weight = afterDepth / (afterDepth - beforeDepth);
    return prevUv * weight + currentUv * (1.0 - weight);
}

// Enhanced normal mapping with parallax
mat3 getTBNMatrix() {
    vec3 N = normalize(vNormal);
    vec3 T = normalize(vTangent);
    vec3 B = normalize(vBitangent);
    return mat3(T, B, N);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Get tangent-space view direction for parallax
    mat3 TBN = getTBNMatrix();
    vec3 viewDirTangent = normalize(inverse(TBN) * viewDir);
    
    // Apply parallax occlusion mapping
    vec2 displacedUv = parallaxOcclusionMapping(vUv, viewDirTangent);
    
    // Discard if UV is out of bounds (parallax went too far)
    if (displacedUv.x > 1.0 || displacedUv.y > 1.0 || 
        displacedUv.x < 0.0 || displacedUv.y < 0.0) {
        displacedUv = vUv;
    }
    
    // Sample normal with displacement
    vec3 tangentNormal = texture(normalTexture, displacedUv).rgb * 2.0 - 1.0;
    vec3 worldNormal = normalize(TBN * tangentNormal);
    
    // Sample material properties
    vec4 albedo = texture(albedoTexture, displacedUv);
    float roughness = texture(roughnessTexture, displacedUv).r;
    float height = texture(heightTexture, displacedUv).r;
    
    // Environment reflection
    vec3 reflectDir = reflect(-viewDir, worldNormal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    
    // Fresnel
    float fresnel = pow(1.0 - abs(dot(viewDir, worldNormal)), 5.0);
    fresnel = mix(0.04, 1.0, fresnel);
    
    // Simple lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(worldNormal, lightDir), 0.0);
    
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(worldNormal, halfDir), 0.0), (1.0 - roughness) * 256.0);
    
    // Combine
    vec3 ambient = albedo.rgb * 0.1;
    vec3 diffuse = albedo.rgb * diff * 0.6;
    vec3 specular = vec3(spec) * uSpecularIntensity * fresnel;
    vec3 reflectColor = reflection * fresnel * (1.0 - roughness);
    
    vec3 finalColor = ambient + diffuse + specular + reflectColor;
    
    // Height-based occlusion
    finalColor *= (0.5 + height * 0.5);
    
    fragColor = vec4(finalColor, albedo.a);
}
`;

/**
 * Velocity-reactive circuit pattern shader
 * Circuit intensity increases with marble velocity
 */
export const VELOCITY_CIRCUIT_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D circuitTexture;
uniform sampler2D noiseTexture;
uniform samplerCube envMap;
uniform float uTime;
uniform float uVelocity;
uniform float uMaxVelocity;
uniform float uCircuitGlow;
uniform float uBaseIntensity;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;
out vec4 bloomColor;

// Hexagonal grid UV
vec2 hexGrid(vec2 uv, float scale) {
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(uv * scale, r) - h;
    vec2 b = mod(uv * scale + h, r) - h;
    return dot(a, a) < dot(b, b) ? a : b;
}

// Circuit pattern generator
float circuitPattern(vec2 uv, float velocityRatio) {
    // Base hex grid
    vec2 hexUv = hexGrid(uv, 8.0);
    float hexDist = length(hexUv);
    
    // Circuit lines along hex edges
    float circuitLine = smoothstep(0.15, 0.12, abs(hexDist - 0.25));
    
    // Velocity-reactive energy flow
    float flowSpeed = 2.0 + velocityRatio * 8.0;
    float flow = sin(hexUv.y * 20.0 + uTime * flowSpeed) * 0.5 + 0.5;
    flow *= sin(hexUv.x * 15.0 - uTime * flowSpeed * 0.7) * 0.5 + 0.5;
    
    // Data packets moving along circuits
    float packetPos = fract(uTime * flowSpeed * 0.5 + uv.x * 3.0);
    float packet = smoothstep(0.1, 0.0, abs(packetPos - 0.5));
    packet *= circuitLine;
    
    // Turbulence at high velocities
    float turbulence = texture(noiseTexture, uv * 2.0 + uTime * 0.1).r;
    turbulence = pow(turbulence, 3.0) * velocityRatio;
    
    return circuitLine + packet * (1.0 + velocityRatio) + turbulence * 0.3;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Calculate velocity ratio (0-1)
    float velocityRatio = clamp(uVelocity / uMaxVelocity, 0.0, 1.0);
    
    // Generate velocity-reactive circuit pattern
    float circuit = circuitPattern(vUv, velocityRatio);
    
    // Circuit colors
    vec3 baseColor = vec3(0.05, 0.05, 0.08);
    vec3 circuitColor = mix(
        vec3(0.0, 0.8, 1.0),    // Cyan at rest
        vec3(1.0, 0.2, 0.8),    // Magenta at high speed
        velocityRatio
    );
    
    // Intensity boost with velocity
    float intensity = uBaseIntensity + velocityRatio * uCircuitGlow * 2.0;
    
    // Pulse effect
    float pulse = sin(uTime * 3.0 + velocityRatio * 5.0) * 0.3 + 0.7;
    intensity *= pulse;
    
    // Fresnel rim for energy effect
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
    vec3 rimColor = circuitColor * fresnel * (0.5 + velocityRatio);
    
    // Combine
    vec3 finalColor = mix(baseColor, circuitColor, circuit * intensity);
    finalColor += rimColor * intensity;
    
    // Reflection
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    finalColor += reflection * 0.1 * (1.0 - circuit);
    
    // Bloom calculation - circuits glow
    vec3 bloom = circuitColor * circuit * intensity * (0.5 + velocityRatio);
    
    fragColor = vec4(finalColor, 0.95);
    bloomColor = vec4(bloom, 1.0);
}
`;

/**
 * Weathering overlay shader
 * Applies wear, dirt, and rust based on weathering map
 */
export const WEATHERING_OVERLAY_FRAGMENT_SHADER = `
#include "common_types.glsl"

uniform sampler2D albedoTexture;
uniform sampler2D normalTexture;
uniform sampler2D weatheringMap;
uniform sampler2D rustTexture;
uniform samplerCube envMap;
uniform float uWearIntensity;
uniform float uDirtIntensity;
uniform float uRustIntensity;
uniform float uTime;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vViewDirection;
in vec2 vUv;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Sample base textures
    vec3 albedo = texture(albedoTexture, vUv).rgb;
    vec3 tangentNormal = texture(normalTexture, vUv).rgb * 2.0 - 1.0;
    
    // Sample weathering map
    vec4 weathering = texture(weatheringMap, vUv);
    float wear = weathering.r * uWearIntensity;
    float dirt = weathering.g * uDirtIntensity;
    float rust = weathering.b * uRustIntensity;
    float occlusion = weathering.a;
    
    // Sample rust texture
    vec3 rustColor = texture(rustTexture, vUv * 3.0).rgb;
    rustColor = vec3(0.6, 0.3, 0.1) * rustColor.r;
    
    // Dirt color (dark brown)
    vec3 dirtColor = vec3(0.15, 0.12, 0.08);
    
    // Apply wear (lightens and roughens)
    vec3 wornAlbedo = albedo * (1.0 + wear * 0.3);
    
    // Apply dirt (darkens and tints brown)
    wornAlbedo = mix(wornAlbedo, dirtColor, dirt * 0.7);
    
    // Apply rust (orange-brown overlay)
    wornAlbedo = mix(wornAlbedo, rustColor, rust * 0.8);
    
    // Ambient occlusion from weathering
    wornAlbedo *= (0.3 + occlusion * 0.7);
    
    // Simple lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Roughness increases with wear and rust
    float roughness = 0.3 + wear * 0.4 + rust * 0.3;
    
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), (1.0 - roughness) * 128.0);
    
    // Environment reflection (reduced by rust and dirt)
    vec3 reflectDir = reflect(-viewDir, normal);
    vec3 reflection = texture(envMap, reflectDir).rgb;
    float reflectivity = (1.0 - roughness) * (1.0 - rust * 0.5) * (1.0 - dirt * 0.3);
    
    // Combine
    vec3 ambient = wornAlbedo * 0.15;
    vec3 diffuse = wornAlbedo * diff * 0.6;
    vec3 specular = vec3(spec) * (1.0 - wear * 0.5) * (1.0 - rust * 0.8);
    vec3 reflectColor = reflection * reflectivity;
    
    vec3 finalColor = ambient + diffuse + specular + reflectColor;
    
    // Subtle wetness effect for dirt
    float wetness = dirt * 0.3;
    finalColor = mix(finalColor, finalColor * 0.8, wetness);
    
    fragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Enhanced vertex shader with deformation support
 */
export const DEFORMATION_VERTEX_SHADER = `
#include "common_types.glsl"

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform float uTime;
uniform float uImpactTime;
uniform float uImpactForce;
uniform vec3 uImpactNormal;
uniform float uImpactRecovery;
uniform float uAngularVelocity;
uniform vec3 uRollAxis;
uniform float uWobbleTime;
uniform float uWobbleIntensity;

in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec3 vBitangent;
out vec3 vViewDirection;
out vec2 vUv;
out float vDeformationAmount;

// Impact squish deformation
vec3 applyImpactDeformation(vec3 pos, vec3 norm) {
    if (uImpactForce <= 0.0) return pos;
    
    float age = uTime - uImpactTime;
    if (age > uImpactRecovery || age < 0.0) return pos;
    
    float t = age / uImpactRecovery;
    float recovery = exp(-t * 4.0) * sin(t * 3.14159 * 4.0);
    float squish = uImpactForce * 0.3 * recovery;
    
    // Deform along impact normal
    vec3 deformation = -uImpactNormal * squish;
    
    // Bulge perpendicular
    float dist = length(pos);
    vec3 toCenter = normalize(-pos);
    float bulge = squish * 0.3 * (1.0 - dist);
    
    return pos + deformation + toCenter * bulge;
}

// Roll flattening deformation
vec3 applyRollDeformation(vec3 pos, vec3 norm) {
    if (uAngularVelocity <= 0.0) return pos;
    
    float flattenFactor = max(0.0, -norm.y) * uAngularVelocity * 0.05;
    flattenFactor = min(1.0, flattenFactor);
    
    vec3 result = pos;
    result.y -= flattenFactor * 0.1;
    
    // Volume preservation bulge
    float bulge = flattenFactor * 0.05;
    result.x += sign(pos.x) * bulge;
    result.z += sign(pos.z) * bulge;
    
    return result;
}

// Bounce wobble deformation
vec3 applyWobbleDeformation(vec3 pos, vec3 norm) {
    if (uWobbleIntensity <= 0.0 || uWobbleTime > 3.0) return pos;
    
    float decay = exp(-uWobbleTime * 2.0);
    float wobble = sin(uWobbleTime * 10.0) * uWobbleIntensity * decay;
    
    // Spherical harmonic wobble
    float theta = atan(pos.z, pos.x);
    float phi = acos(pos.y / (length(pos) + 0.001));
    
    float harmonic = sin(2.0 * theta) * cos(phi);
    wobble *= harmonic;
    
    return pos + norm * wobble * 0.05;
}

void main() {
    vec3 deformedPos = position;
    
    // Apply deformations in order
    deformedPos = applyImpactDeformation(deformedPos, normal);
    deformedPos = applyRollDeformation(deformedPos, normal);
    deformedPos = applyWobbleDeformation(deformedPos, normal);
    
    // Calculate deformation amount for fragment shader
    vDeformationAmount = length(deformedPos - position);
    
    // Transform to world space
    vec4 worldPosition = modelMatrix * vec4(deformedPos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate view direction
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewDirection = -viewPosition.xyz;
    
    // Transform normal basis
    vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    vTangent = normalize((normalMatrix * vec4(tangent, 0.0)).xyz);
    vBitangent = cross(vNormal, vTangent);
    
    vUv = uv;
    
    gl_Position = projectionMatrix * viewPosition;
}
`;

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

export default {
  // Noise functions
  generateSimplexNoise,
  generateFBMNoise,
  generateRidgedFBM,
  generateTurbulentFBM,
  generateWorleyNoise,
  generateMarbleVeinPattern,
  generateSimplexNoise2D,
  generateFBMNoise2D,
  generateWorleyNoise2D,
  
  // Texture generators
  createMarbleVeinTexture,
  createCircuitPattern,
  createMetalGrainTexture,
  createWeatheringMap,
  
  // Vertex deformations
  generateImpactDeformation,
  generateRollFlattening,
  generateBounceWobble,
  applyCompositeDeformation,
  
  // Utilities
  SeededRandom,
  imageDataToTexture,
  
  // Shaders
  EnhancedShaders,
  
  // Presets
  AllPresets
};

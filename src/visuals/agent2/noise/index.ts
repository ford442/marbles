/**
 * Noise generation module
 * 
 * Provides advanced procedural noise functions including:
 * - SeededRandom: Deterministic pseudo-random number generator
 * - 3D noise: Simplex, FBM, Ridged FBM, Turbulent FBM, Worley (cellular)
 * - 2D noise: Simplex, FBM, Worley
 * - Pattern generation: Marble vein patterns
 */

// Seeded random number generator
export { SeededRandom } from './seeded-random';

// 3D noise functions
export {
  generateSimplexNoise,
  generateFBMNoise,
  generateRidgedFBM,
  generateTurbulentFBM,
  generateWorleyNoise,
  generateMarbleVeinPattern,
  SIMPLEX_CORNERS,
  F3,
  G3
} from './noise-3d';

// 2D noise functions
export {
  generateSimplexNoise2D,
  generateFBMNoise2D,
  generateWorleyNoise2D
} from './noise-2d';

// Re-export types
export type { Vector3, NoiseOptions } from '../../types';

import { SeededRandom } from './seeded-random';
import { NoiseOptions } from '../../types';

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

// Export constants for potential external use
export { SIMPLEX_CORNERS, F3, G3 };

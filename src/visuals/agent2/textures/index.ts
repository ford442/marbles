/**
 * Texture generation module
 * Agent 2: Complexity Layer
 * 
 * This module provides:
 * - Marble vein texture generation
 * - Circuit pattern generation (hex, square, radial)
 * - Metal grain texture generation
 * - Weathering/dirt map generation
 * - Shared utilities for texture conversion
 */

// Shared utilities
export {
  textureCanvas,
  textureContext,
  textureCache,
  initializeTextureCanvas,
  lerp,
  smoothstep,
  imageDataToTexture
} from './shared';

// Vein texture
export { createMarbleVeinTexture } from './vein';

// Circuit patterns
export {
  createCircuitPattern,
  generateHexCircuit,
  generateSquareCircuit,
  generateRadialCircuit
} from './circuit';

// Metal grain
export { createMetalGrainTexture } from './metal-grain';

// Weathering
export { createWeatheringMap } from './weathering';

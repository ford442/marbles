/**
 * Shared utilities for texture generation
 * Agent 2: Complexity Layer
 */

import * as Filament from 'filament';

// Note: Filament types may need to be augmented for the Texture.Builder API

/**
 * Canvas cache for texture generation
 */
export let textureCanvas: HTMLCanvasElement | null = null;
export let textureContext: CanvasRenderingContext2D | null = null;
export let textureCache: Map<string, ImageData> = new Map();

/**
 * Initialize texture generation canvas
 */
export function initializeTextureCanvas(): void {
  if (!textureCanvas) {
    textureCanvas = document.createElement('canvas');
    textureContext = textureCanvas.getContext('2d')!;
  }
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Smoothstep interpolation
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
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

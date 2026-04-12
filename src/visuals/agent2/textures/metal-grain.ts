/**
 * Metal grain texture generation
 * Agent 2: Complexity Layer
 */

import { MetalGrainConfig } from '../types';
import { generateFBMNoise2D } from '../noise';
import { initializeTextureCanvas, textureCanvas, textureContext, smoothstep } from './shared';

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

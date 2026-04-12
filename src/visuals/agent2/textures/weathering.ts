/**
 * Weathering/dirt accumulation map generation
 * Agent 2: Complexity Layer
 */

import { WeatheringConfig } from '../types';
import { generateFBMNoise2D } from '../noise';
import { initializeTextureCanvas, textureCanvas, textureContext, smoothstep } from './shared';

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

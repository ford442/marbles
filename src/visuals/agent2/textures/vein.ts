/**
 * Marble vein texture generation
 * Agent 2: Complexity Layer
 */

import { VeinTextureConfig } from '../../types';
import { generateWorleyNoise2D, generateFBMNoise2D } from '../noise';
import { initializeTextureCanvas, textureCanvas, textureContext, textureCache, lerp, smoothstep } from './shared';

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

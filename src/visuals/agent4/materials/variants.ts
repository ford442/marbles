/**
 * Agent 4: Track Surface Materials - Material Variants
 * Performance-optimized material variants for LOD switching
 */

import { vec4 } from 'gl-matrix';
import { TrackMaterialProperties, MaterialQuality } from '../types';

/**
 * Material quality variants for LOD switching
 * Each variant reduces shader complexity for performance
 */
export function createMaterialVariant(
  baseMaterial: TrackMaterialProperties,
  quality: MaterialQuality
): TrackMaterialProperties {
  const variant: TrackMaterialProperties = {
    baseColor: vec4.clone(baseMaterial.baseColor),
    roughness: baseMaterial.roughness,
    metallic: baseMaterial.metallic,
    reflectance: baseMaterial.reflectance,
    clearCoat: baseMaterial.clearCoat,
    clearCoatRoughness: baseMaterial.clearCoatRoughness,
    subsurfaceScattering: baseMaterial.subsurfaceScattering,
    ambientOcclusion: baseMaterial.ambientOcclusion,
    emissive: vec4.clone(baseMaterial.emissive),
    emissiveIntensity: baseMaterial.emissiveIntensity,
    anisotropy: baseMaterial.anisotropy,
    sheen: baseMaterial.sheen,
    sheenColor: vec4.clone(baseMaterial.sheenColor)
  };

  switch (quality) {
    case MaterialQuality.ULTRA:
      // Full quality, no changes
      break;
      
    case MaterialQuality.HIGH:
      // Slightly reduced clear coat
      variant.clearCoat *= 0.8;
      variant.subsurfaceScattering *= 0.8;
      break;
      
    case MaterialQuality.MEDIUM:
      // Remove expensive effects
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering *= 0.5;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      break;
      
    case MaterialQuality.LOW:
      // Simplified PBR
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering = 0.0;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      variant.roughness = Math.max(variant.roughness, 0.3);
      break;
      
    case MaterialQuality.MINIMAL:
      // Vertex-color equivalent
      variant.clearCoat = 0.0;
      variant.subsurfaceScattering = 0.0;
      variant.anisotropy = 0.0;
      variant.sheen = 0.0;
      variant.roughness = 0.5;
      variant.metallic = 0.0;
      variant.reflectance = 0.5;
      break;
  }

  return variant;
}

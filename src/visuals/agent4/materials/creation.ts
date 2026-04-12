/**
 * Agent 4: Track Surface Materials - Material Creation
 * Material generation and main.js integration utilities
 */

import * as Filament from 'filament';
import { vec4, vec3 } from 'gl-matrix';
import {
  TrackMaterialProperties,
  TrackSurfaceType,
  MaterialQuality,
  TrackWearState,
  ProceduralTextureParams,
  SurfaceFinish,
  TrafficIntensity,
  TrackZoneVisualMetadata,
  ReflectionProbeHint
} from '../types';
import { BASE_TRACK_MATERIALS } from './base';
import { createMaterialVariant } from './variants';
import { DEFAULT_WEAR_STATE } from '../wear/state';
import { applyWearToMaterial } from '../wear/simulation';
import { createZoneReflectionProbe } from '../probes/creation';

/**
 * Creates a Filament material instance from track properties
 */
export function createTrackMaterial(
  engine: Filament.Engine,
  properties: TrackMaterialProperties,
  quality: MaterialQuality = MaterialQuality.HIGH
): Filament.MaterialInstance | null {
  try {
    // Apply quality level adjustments
    const qualityAdjusted = createMaterialVariant(properties, quality);
    
    // Create material using Filament's standard material
    // Note: In production, this would use precompiled .filamat files
    const material = Filament.Material.Builder()
      .package(createTrackMaterialPackage(qualityAdjusted))
      .build(engine);
    
    const instance = material.getDefaultInstance();
    
    // Set material parameters
    instance.setParameter('baseColor', Filament.RgbaType.sRGB, 
      Array.from(qualityAdjusted.baseColor) as [number, number, number, number]);
    instance.setParameter('roughness', qualityAdjusted.roughness);
    instance.setParameter('metallic', qualityAdjusted.metallic);
    instance.setParameter('reflectance', qualityAdjusted.reflectance);
    instance.setParameter('clearCoat', qualityAdjusted.clearCoat);
    instance.setParameter('clearCoatRoughness', qualityAdjusted.clearCoatRoughness);
    
    if (qualityAdjusted.emissiveIntensity > 0) {
      instance.setParameter('emissive', Filament.RgbaType.sRGB,
        Array.from(qualityAdjusted.emissive) as [number, number, number, number]);
    }
    
    return instance;
  } catch (e) {
    console.error('[TrackMaterials] Failed to create material:', e);
    return null;
  }
}

/**
 * Creates a placeholder material package
 * In production, this would load compiled Filament materials
 */
function createTrackMaterialPackage(props: TrackMaterialProperties): Uint8Array {
  // Placeholder - returns empty array
  // Real implementation would load precompiled .filamat data
  return new Uint8Array(0);
}

/**
 * Integration helper for main.js createStaticBox function
 * Call this before creating the static box to get appropriate material
 * 
 * @example
 * ```typescript
 * // In main.js createStaticBox:
 * const trackMaterial = getTrackMaterialForZone('track_01', TrackSurfaceType.METAL);
 * const matInstance = trackMaterial.createInstance(engine);
 * ```
 */
export function getTrackMaterialForZone(
  zoneId: string,
  surfaceType: TrackSurfaceType,
  quality?: MaterialQuality
): {
  properties: TrackMaterialProperties;
  surfaceType: TrackSurfaceType;
  quality: MaterialQuality;
  applyWear: (wearState: TrackWearState) => TrackMaterialProperties;
} {
  const baseProps = BASE_TRACK_MATERIALS[surfaceType];
  const materialQuality = quality || MaterialQuality.HIGH;
  
  return {
    properties: createMaterialVariant(baseProps, materialQuality),
    surfaceType,
    quality: materialQuality,
    applyWear: (wearState: TrackWearState) => 
      applyWearToMaterial(baseProps, wearState, surfaceType)
  };
}

/**
 * Creates a material instance suitable for main.js integration
 * Returns null if Filament is not available
 */
export function createMainJSCompatibleMaterial(
  engine: Filament.Engine | undefined,
  surfaceType: TrackSurfaceType,
  colorOverride?: [number, number, number],
  quality: MaterialQuality = MaterialQuality.HIGH
): Filament.MaterialInstance | null {
  if (!engine) {
    console.warn('[TrackMaterials] No engine provided, returning null');
    return null;
  }
  
  const baseProps = BASE_TRACK_MATERIALS[surfaceType];
  
  // Apply color override if provided
  const props: TrackMaterialProperties = {
    ...baseProps,
    baseColor: colorOverride 
      ? vec4.fromValues(colorOverride[0], colorOverride[1], colorOverride[2], 1.0)
      : vec4.clone(baseProps.baseColor)
  };
  
  return createTrackMaterial(engine, props, quality);
}

/**
 * Creates complete zone visual metadata from configuration
 */
export function createZoneVisualMetadata(
  zoneId: string,
  config: {
    displayName?: string;
    surfaceType: TrackSurfaceType;
    finish?: SurfaceFinish;
    position: vec3;
    size: vec3;
    expectedTraffic?: TrafficIntensity;
    customColor?: vec4;
  }
): TrackZoneVisualMetadata {
  const baseMaterial = BASE_TRACK_MATERIALS[config.surfaceType];
  
  // Apply custom color if provided
  const material: TrackMaterialProperties = {
    ...baseMaterial,
    baseColor: config.customColor ? vec4.clone(config.customColor) : vec4.clone(baseMaterial.baseColor)
  };
  
  // Apply finish modifications
  const finish = config.finish || SurfaceFinish.MATT;
  switch (finish) {
    case SurfaceFinish.POLISHED:
      material.roughness *= 0.3;
      material.clearCoat = Math.max(material.clearCoat, 0.8);
      break;
    case SurfaceFinish.ROUGH:
      material.roughness = Math.min(1.0, material.roughness * 1.5);
      break;
    case SurfaceFinish.WORN:
      material.roughness = Math.min(1.0, material.roughness * 1.2);
      material.clearCoat *= 0.5;
      break;
    case SurfaceFinish.WEATHERED:
      material.roughness = Math.min(1.0, material.roughness * 1.3);
      material.ambientOcclusion = Math.min(1.0, material.ambientOcclusion * 1.2);
      break;
  }
  
  // Create texture parameters based on surface type
  const textureParams: ProceduralTextureParams = {
    noiseScale: 0.1,
    noiseOctaves: 4,
    normalStrength: 1.0,
    microDetailScale: 0.01,
    wearSeed: Math.floor(Math.random() * 10000)
  };
  
  // Create reflection probe
  const reflectionProbe = createZoneReflectionProbe(
    config.surfaceType,
    config.position,
    config.size,
    zoneId
  );
  
  return {
    zoneId,
    displayName: config.displayName || zoneId,
    surfaceType: config.surfaceType,
    finish,
    material,
    textureParams,
    wearState: { ...DEFAULT_WEAR_STATE },
    expectedTraffic: config.expectedTraffic || TrafficIntensity.MEDIUM,
    reflectionProbe
  };
}

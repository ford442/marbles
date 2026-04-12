/**
 * Agent 4: Track Surface Materials - Base Materials
 * Base material configurations for all track surface types
 */

import { vec4 } from 'gl-matrix';
import { TrackSurfaceType, TrackMaterialProperties } from '../types';

/**
 * Base material configurations for all track surface types
 * These serve as starting points that can be modified by wear state
 */
export const BASE_TRACK_MATERIALS: Record<TrackSurfaceType, TrackMaterialProperties> = {
  [TrackSurfaceType.OBSIDIAN]: {
    baseColor: vec4.fromValues(0.05, 0.05, 0.07, 1.0),
    roughness: 0.15,
    metallic: 0.9,
    reflectance: 1.0,
    clearCoat: 0.4,
    clearCoatRoughness: 0.1,
    subsurfaceScattering: 0.05,
    ambientOcclusion: 0.7,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.ICE]: {
    baseColor: vec4.fromValues(0.85, 0.92, 1.0, 0.6),
    roughness: 0.05,
    metallic: 0.0,
    reflectance: 0.8,
    clearCoat: 1.0,
    clearCoatRoughness: 0.02,
    subsurfaceScattering: 0.7,
    ambientOcclusion: 0.2,
    emissive: vec4.fromValues(0.1, 0.2, 0.3, 1.0),
    emissiveIntensity: 0.1,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.RUBBER]: {
    baseColor: vec4.fromValues(0.15, 0.15, 0.15, 1.0),
    roughness: 0.85,
    metallic: 0.0,
    reflectance: 0.2,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.1,
    ambientOcclusion: 0.9,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.SAND]: {
    baseColor: vec4.fromValues(0.76, 0.70, 0.50, 1.0),
    roughness: 1.0,
    metallic: 0.0,
    reflectance: 0.0,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.VOLCANIC_ROCK]: {
    baseColor: vec4.fromValues(0.12, 0.08, 0.06, 1.0),
    roughness: 0.95,
    metallic: 0.1,
    reflectance: 0.1,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.3, 0.1, 0.0, 1.0),
    emissiveIntensity: 0.15,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.CRYSTAL]: {
    baseColor: vec4.fromValues(0.9, 0.95, 1.0, 0.4),
    roughness: 0.02,
    metallic: 0.0,
    reflectance: 0.9,
    clearCoat: 0.8,
    clearCoatRoughness: 0.05,
    subsurfaceScattering: 0.8,
    ambientOcclusion: 0.3,
    emissive: vec4.fromValues(0.2, 0.5, 0.8, 1.0),
    emissiveIntensity: 0.3,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.WOOD]: {
    baseColor: vec4.fromValues(0.4, 0.25, 0.15, 1.0),
    roughness: 0.6,
    metallic: 0.0,
    reflectance: 0.15,
    clearCoat: 0.1,
    clearCoatRoughness: 0.4,
    subsurfaceScattering: 0.05,
    ambientOcclusion: 0.8,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.METAL]: {
    baseColor: vec4.fromValues(0.72, 0.73, 0.75, 1.0),
    roughness: 0.25,
    metallic: 1.0,
    reflectance: 1.0,
    clearCoat: 0.0,
    clearCoatRoughness: 0.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 0.5,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.3,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  },
  
  [TrackSurfaceType.CONCRETE]: {
    baseColor: vec4.fromValues(0.35, 0.35, 0.37, 1.0),
    roughness: 0.9,
    metallic: 0.0,
    reflectance: 0.1,
    clearCoat: 0.0,
    clearCoatRoughness: 1.0,
    subsurfaceScattering: 0.0,
    ambientOcclusion: 1.0,
    emissive: vec4.fromValues(0.0, 0.0, 0.0, 1.0),
    emissiveIntensity: 0.0,
    anisotropy: 0.0,
    sheen: 0.0,
    sheenColor: vec4.fromValues(0.0, 0.0, 0.0, 1.0)
  }
};

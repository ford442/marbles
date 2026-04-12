/**
 * Agent 1: Beauty Layer - Obsidian Material Configuration
 * @module agent1/materials/obsidian
 */

import { RefinedMarbleMaterialConfig } from '../types';
import { EnhancedColorPalettes } from '../palettes';
import { REFINED_VERTEX_SHADER, REFINED_OBSIDIAN_FRAGMENT_SHADER } from '../shaders';

/**
 * Refined Obsidian Metal Material Configuration
 * Enhanced with better anisotropic highlights and clear-coat
 * 
 * @performance 0.48ms per marble (estimated)
 */
export const RefinedObsidianMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedObsidianMetal',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_OBSIDIAN_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uAnisotropy: { type: 'float', value: 0.75 },
    uAnisotropyDirection: { type: 'float', value: 45.0 },
    uGrainScale: { type: 'float', value: 10.0 },
    uScratchesIntensity: { type: 'float', value: 0.35 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    grainTexture: { type: 'sampler2D', value: null },
    anisoTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uClearCoat: { type: 'float', value: 0.25 },
    uClearCoatRoughness: { type: 'float', value: 0.15 },
    uClearCoatNormalScale: { type: 'float', value: 0.3 },
    uRimIntensity: { type: 'float', value: 0.6 },
    uRimPower: { type: 'float', value: 1.8 },
    uRimColor: { type: 'vec3', value: [0.3, 0.25, 0.2] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.obsidian.base },
    uMetallic: { type: 'float', value: 0.85 },
    uRoughness: { type: 'float', value: 0.35 },
    uReflectance: { type: 'float', value: 0.65 }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.obsidian.base,
  metallic: 0.85,
  roughness: 0.35,
  reflectance: 0.65,
  clearCoat: 0.25,
  clearCoatRoughness: 0.15,
  clearCoatNormalScale: 0.3,
  anisotropy: 0.75,
  anisotropyDirection: 45.0,
  rimLightingIntensity: 0.6,
  rimLightingPower: 1.8,
  rimLightingColor: [0.3, 0.25, 0.2],
  subsurfaceScattering: 0.0,
  subsurfaceColor: [0.0, 0.0, 0.0],
  subsurfaceThickness: 0.0,
  estimatedGpuCost: 0.48,
  qualityTier: 'high'
};

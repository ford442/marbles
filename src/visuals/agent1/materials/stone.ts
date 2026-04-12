/**
 * Agent 1: Beauty Layer - Stone Material Configuration
 * @module agent1/materials/stone
 */

import { RefinedMarbleMaterialConfig } from '../types';
import { EnhancedColorPalettes } from '../palettes';
import { REFINED_VERTEX_SHADER, REFINED_STONE_FRAGMENT_SHADER } from '../shaders';

/**
 * Refined Stone Vein Material Configuration
 * Enhanced with better subsurface scattering and rim lighting
 * 
 * @performance 0.38ms per marble (estimated)
 */
export const RefinedStoneMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedStoneVein',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_STONE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uSSSIntensity: { type: 'float', value: 0.55 },
    uSSSThickness: { type: 'float', value: 3.5 },
    uSSSColor: { type: 'vec3', value: EnhancedColorPalettes.stone.sssWarm },
    uSparkleDensity: { type: 'float', value: 1.25 },
    uSparkleSpeed: { type: 'float', value: 3.5 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    veinTexture: { type: 'sampler2D', value: null },
    sparkleTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uRimIntensity: { type: 'float', value: 0.35 },
    uRimPower: { type: 'float', value: 2.5 },
    uRimColor: { type: 'vec3', value: [0.95, 0.88, 0.78] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.stone.base },
    uRoughness: { type: 'float', value: 0.65 },
    uReflectance: { type: 'float', value: 0.12 }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.stone.base,
  metallic: 0.0,
  roughness: 0.65,
  reflectance: 0.12,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 0.35,
  rimLightingPower: 2.5,
  rimLightingColor: [0.95, 0.88, 0.78],
  subsurfaceScattering: 0.55,
  subsurfaceColor: EnhancedColorPalettes.stone.sssWarm,
  subsurfaceThickness: 3.5,
  estimatedGpuCost: 0.38,
  qualityTier: 'high'
};

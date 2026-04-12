/**
 * Agent 1: Beauty Layer - Glass Material Configuration
 * @module agent1/materials/glass
 */

import { RefinedMarbleMaterialConfig } from '../types';
import { EnhancedColorPalettes } from '../palettes';
import { REFINED_VERTEX_SHADER, REFINED_GLASS_FRAGMENT_SHADER } from '../shaders';

/**
 * Refined Classic Glass Material Configuration
 * Enhanced with improved clear-coat and rim lighting
 * 
 * @performance 0.45ms per marble (estimated)
 */
export const RefinedGlassMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedClassicGlass',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_GLASS_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uRefractionIndex: { type: 'float', value: 1.52 },  // Standard glass IOR
    uFresnelPower: { type: 'float', value: 2.5 },
    uCausticIntensity: { type: 'float', value: 0.55 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    materialBaseColor: { type: 'vec4', value: [0.15, 0.35, 0.55, 0.5] },
    // Enhanced PBR uniforms
    uClearCoat: { type: 'float', value: 0.35 },
    uClearCoatRoughness: { type: 'float', value: 0.08 },
    uClearCoatNormalScale: { type: 'float', value: 0.5 },
    uRimIntensity: { type: 'float', value: 0.8 },
    uRimPower: { type: 'float', value: 2.2 },
    uRimColor: { type: 'vec3', value: EnhancedColorPalettes.glass.rim },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.glass.base },
    uMetallic: { type: 'float', value: 0.0 },
    uRoughness: { type: 'float', value: 0.05 },
    uReflectance: { type: 'float', value: 0.45 }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.glass.base,
  metallic: 0.0,
  roughness: 0.05,
  reflectance: 0.45,
  clearCoat: 0.35,
  clearCoatRoughness: 0.08,
  clearCoatNormalScale: 0.5,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 0.8,
  rimLightingPower: 2.2,
  rimLightingColor: EnhancedColorPalettes.glass.rim,
  subsurfaceScattering: 0.0,
  subsurfaceColor: [0.0, 0.0, 0.0],
  subsurfaceThickness: 0.0,
  estimatedGpuCost: 0.45,
  qualityTier: 'high'
};

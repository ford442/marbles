/**
 * Agent 1: Beauty Layer - Neon Material Configuration
 * @module agent1/materials/neon
 */

import { RefinedMarbleMaterialConfig } from '../types';
import { EnhancedColorPalettes } from '../palettes';
import { REFINED_VERTEX_SHADER, REFINED_NEON_FRAGMENT_SHADER } from '../shaders';

/**
 * Refined Neon Glow Material Configuration
 * Enhanced with improved rim lighting and subsurface effects
 * 
 * @performance 0.42ms per marble (estimated)
 */
export const RefinedNeonMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'RefinedNeonGlow',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: REFINED_NEON_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.75 },
    uGlowIntensity: { type: 'float', value: 2.5 },
    uHologramSpeed: { type: 'float', value: 1.2 },
    uDistortionStrength: { type: 'float', value: 0.015 },
    hologramTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // Enhanced PBR uniforms
    uRimIntensity: { type: 'float', value: 1.2 },
    uRimPower: { type: 'float', value: 1.5 },
    uRimColor: { type: 'vec3', value: [0.0, 1.0, 0.9] },
    uBaseColor: { type: 'vec3', value: EnhancedColorPalettes.neon.core },
    uMetallic: { type: 'float', value: 0.4 },
    uRoughness: { type: 'float', value: 0.25 },
    uSubsurfaceScattering: { type: 'float', value: 0.45 },
    uSubsurfaceThickness: { type: 'float', value: 2.0 },
    uSubsurfaceColor: { type: 'vec3', value: [0.0, 0.8, 0.9] }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: EnhancedColorPalettes.neon.core,
  metallic: 0.4,
  roughness: 0.25,
  reflectance: 0.5,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.0,
  anisotropyDirection: 0.0,
  rimLightingIntensity: 1.2,
  rimLightingPower: 1.5,
  rimLightingColor: [0.0, 1.0, 0.9],
  subsurfaceScattering: 0.45,
  subsurfaceColor: [0.0, 0.8, 0.9],
  subsurfaceThickness: 2.0,
  estimatedGpuCost: 0.42,
  qualityTier: 'high'
};

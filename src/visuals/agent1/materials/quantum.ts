/**
 * Agent 1: Beauty Layer - Quantum Crystal Material Configuration
 * @module agent1/materials/quantum
 */

import { RefinedMarbleMaterialConfig } from '../types';
import { QuantumCrystalPalette } from '../palettes';
import { REFINED_VERTEX_SHADER, QUANTUM_CRYSTAL_FRAGMENT_SHADER } from '../shaders';

/**
 * NEW: Quantum Crystal Material Configuration
 * A crystalline marble with quantum interference patterns and iridescence
 * 
 * @performance 0.46ms per marble (estimated)
 */
export const QuantumCrystalMaterialConfig: RefinedMarbleMaterialConfig = {
  name: 'QuantumCrystal',
  vertexShader: REFINED_VERTEX_SHADER,
  fragmentShader: QUANTUM_CRYSTAL_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.95 },
    uGlowIntensity: { type: 'float', value: 1.8 },
    uQuantumPhase: { type: 'float', value: 0.0 },
    uDistortionStrength: { type: 'float', value: 0.008 },
    crystalTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    // PBR uniforms
    uRimIntensity: { type: 'float', value: 1.0 },
    uRimPower: { type: 'float', value: 1.6 },
    uRimColor: { type: 'vec3', value: QuantumCrystalPalette.energyCyan },
    uBaseColor: { type: 'vec3', value: QuantumCrystalPalette.coreViolet },
    uMetallic: { type: 'float', value: 0.6 },
    uRoughness: { type: 'float', value: 0.15 },
    uAnisotropy: { type: 'float', value: 0.5 },
    uAnisotropyDirection: { type: 'float', value: 30.0 },
    uSubsurfaceScattering: { type: 'float', value: 0.35 },
    uSubsurfaceColor: { type: 'vec3', value: QuantumCrystalPalette.phaseMagenta },
    uReflectance: { type: 'float', value: 0.55 }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back',
  // PBR properties
  baseColor: QuantumCrystalPalette.coreViolet,
  metallic: 0.6,
  roughness: 0.15,
  reflectance: 0.55,
  clearCoat: 0.0,
  clearCoatRoughness: 0.0,
  clearCoatNormalScale: 0.0,
  anisotropy: 0.5,
  anisotropyDirection: 30.0,
  rimLightingIntensity: 1.0,
  rimLightingPower: 1.6,
  rimLightingColor: QuantumCrystalPalette.energyCyan,
  subsurfaceScattering: 0.35,
  subsurfaceColor: QuantumCrystalPalette.phaseMagenta,
  subsurfaceThickness: 2.5,
  estimatedGpuCost: 0.46,
  qualityTier: 'ultra'
};

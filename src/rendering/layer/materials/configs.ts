/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Material Configurations
 */

import { MarbleMaterialConfig } from '../types';
import {
  MARBLE_VERTEX_SHADER,
  CLASSIC_GLASS_FRAGMENT_SHADER,
  OBSIDIAN_METAL_FRAGMENT_SHADER,
  NEON_GLOW_FRAGMENT_SHADER,
  STONE_VEIN_FRAGMENT_SHADER
} from '../shaders';

export const GlassMaterialConfig: MarbleMaterialConfig = {
  name: 'ClassicGlass',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: CLASSIC_GLASS_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uRefractionIndex: { type: 'float', value: 1.52 },  // Glass IOR
    uFresnelPower: { type: 'float', value: 2.0 },
    uCausticIntensity: { type: 'float', value: 0.4 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null },
    materialBaseColor: { type: 'vec4', value: [0.2, 0.4, 0.6, 0.5] }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back'
};

export const ObsidianMaterialConfig: MarbleMaterialConfig = {
  name: 'ObsidianMetal',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: OBSIDIAN_METAL_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uAnisotropy: { type: 'float', value: 1.5 },
    uGrainScale: { type: 'float', value: 8.0 },
    uScratchesIntensity: { type: 'float', value: 0.3 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    grainTexture: { type: 'sampler2D', value: null },
    anisoTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

export const NeonMaterialConfig: MarbleMaterialConfig = {
  name: 'NeonGlow',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: NEON_GLOW_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uIridescenceScale: { type: 'float', value: 0.6 },
    uGlowIntensity: { type: 'float', value: 2.0 },
    uHologramSpeed: { type: 'float', value: 1.0 },
    uDistortionStrength: { type: 'float', value: 0.01 },
    hologramTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'additive',
  depthWrite: false,
  cullFace: 'back'
};

export const StoneMaterialConfig: MarbleMaterialConfig = {
  name: 'StoneVein',
  vertexShader: MARBLE_VERTEX_SHADER,
  fragmentShader: STONE_VEIN_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uSSSIntensity: { type: 'float', value: 0.3 },
    uSparkleDensity: { type: 'float', value: 1.0 },
    uSparkleSpeed: { type: 'float', value: 3.0 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    veinTexture: { type: 'sampler2D', value: null },
    sparkleTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back'
};

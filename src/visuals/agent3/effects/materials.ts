/**
 * Agent 3: Advanced Rendering Layer - Material Configurations
 * 
 * Advanced material configurations for quantum, prismatic, and volcanic marbles
 * with performance annotations.
 */

import { AdvancedMaterialConfig } from '../types';
import { ADVANCED_VERTEX_SHADER } from '../shaders/vertex';
import { QUANTUM_MARBLE_FRAGMENT_SHADER } from '../shaders/quantum';
import { PRISMATIC_MARBLE_FRAGMENT_SHADER } from '../shaders/prismatic';
import { VOLCANIC_MARBLE_FRAGMENT_SHADER } from '../shaders/volcanic';

/**
 * Quantum Marble Material Configuration
 * 
 * @performance ~0.4ms GPU time (high-tier desktop)
 * @features Wave interference, probability clouds, entanglement glow
 */
export const QuantumMarbleConfig: AdvancedMaterialConfig = {
  name: 'QuantumMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: QUANTUM_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uWaveSpeed: { type: 'float', value: 3.0 },
    uProbabilityCloudDensity: { type: 'float', value: 0.8 },
    uEnergyPulseIntensity: { type: 'float', value: 1.2 },
    uEntanglementGlow: { type: 'float', value: 0.6 },
    uSuperpositionBlend: { type: 'float', value: 0.4 },
    uQuantumColorA: { type: 'vec3', value: [0.45, 0.12, 0.85] },
    uQuantumColorB: { type: 'vec3', value: [0.0, 0.95, 1.0] },
    uMetallic: { type: 'float', value: 0.4 },
    uRoughness: { type: 'float', value: 0.3 },
    uDistortionStrength: { type: 'float', value: 0.02 },
    uHeatDistortion: { type: 'float', value: 0.0 },
    uWaveAmplitude: { type: 'float', value: 0.015 },
    noiseTexture: { type: 'sampler2D', value: null },
    quantumPatternTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.4,
    qualityTier: 'high',
    textureCount: 3,
    uniformCount: 14,
    instructionEstimate: 280,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: false,
    requiresSSR: true,
    supportsInstancing: true,
    supportsLOD: true
  }
};

/**
 * Prismatic Marble Material Configuration
 * 
 * @performance ~0.45ms GPU time (high-tier desktop)
 * @features Chromatic dispersion, spectral refraction, rainbow caustics
 */
export const PrismaticMarbleConfig: AdvancedMaterialConfig = {
  name: 'PrismaticMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: PRISMATIC_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uDispersionStrength: { type: 'float', value: 0.8 },
    uIorRed: { type: 'float', value: 1.514 },
    uIorGreen: { type: 'float', value: 1.52 },
    uIorBlue: { type: 'float', value: 1.526 },
    uCausticIntensity: { type: 'float', value: 0.6 },
    uRainbowSpeed: { type: 'float', value: 2.0 },
    uSpectralShift: { type: 'float', value: 0.5 },
    uPrismaticSparkle: { type: 'float', value: 1.0 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    uHeatDistortion: { type: 'float', value: 0.0 },
    uWaveAmplitude: { type: 'float', value: 0.0 },
    dispersionTexture: { type: 'sampler2D', value: null },
    causticTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'transparent',
  depthWrite: false,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.45,
    qualityTier: 'ultra',
    textureCount: 3,
    uniformCount: 13,
    instructionEstimate: 320,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: false,
    requiresSSR: true,
    supportsInstancing: true,
    supportsLOD: true
  }
};

/**
 * Volcanic Marble Material Configuration
 * 
 * @performance ~0.5ms GPU time (high-tier desktop)
 * @features Lava glow, heat distortion, emissive cracks, magma flow
 */
export const VolcanicMarbleConfig: AdvancedMaterialConfig = {
  name: 'VolcanicMarble',
  vertexShader: ADVANCED_VERTEX_SHADER,
  fragmentShader: VOLCANIC_MARBLE_FRAGMENT_SHADER,
  uniforms: {
    uTime: { type: 'float', value: 0.0 },
    uLavaFlowSpeed: { type: 'float', value: 0.8 },
    uHeatIntensity: { type: 'float', value: 1.5 },
    uCrackEmissive: { type: 'float', value: 0.9 },
    uMagmaViscosity: { type: 'float', value: 0.7 },
    uThermalPulse: { type: 'float', value: 0.6 },
    uAshCoverage: { type: 'float', value: 0.3 },
    uLavaColor: { type: 'vec3', value: [1.0, 0.35, 0.05] },
    uAshColor: { type: 'vec3', value: [0.15, 0.12, 0.1] },
    uGlowRadius: { type: 'float', value: 1.2 },
    uDistortionStrength: { type: 'float', value: 0.0 },
    uHeatDistortion: { type: 'float', value: 0.08 },
    uWaveAmplitude: { type: 'float', value: 0.005 },
    lavaTexture: { type: 'sampler2D', value: null },
    crackTexture: { type: 'sampler2D', value: null },
    noiseTexture: { type: 'sampler2D', value: null },
    emberTexture: { type: 'sampler2D', value: null },
    envMap: { type: 'samplerCube', value: null }
  },
  blending: 'opaque',
  depthWrite: true,
  cullFace: 'back',
  
  performance: {
    estimatedGpuCost: 0.5,
    qualityTier: 'high',
    textureCount: 5,
    uniformCount: 15,
    instructionEstimate: 350,
    targetPlatform: 'desktop'
  },
  
  features: {
    requiresBloom: true,
    requiresSSS: true,
    requiresSSR: false,
    supportsInstancing: true,
    supportsLOD: true
  }
};

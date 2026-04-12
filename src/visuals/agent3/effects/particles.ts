/**
 * Agent 3: Advanced Rendering Layer - Particle Effects
 * 
 * Advanced particle systems including quantum entanglement, prismatic sparkles,
 * and volcanic ember trails.
 */

import { AdvancedParticleEffect } from '../types';

/**
 * Quantum Entanglement Particles
 * Linked particle pairs that react across distance
 * 
 * Performance: ~0.1ms per 100 particles
 */
export const QuantumEntanglementParticles: AdvancedParticleEffect = {
  name: 'QuantumEntanglement',
  maxParticles: 300,
  emissionRate: 60,
  lifetime: { min: 1.0, max: 2.5 },
  size: { start: 0.08, end: 0.02, variation: 0.5 },
  color: {
    start: [0.45, 0.12, 0.85, 0.9],
    end: [0.0, 0.95, 1.0, 0.0],
    gradient: [
      [0.45, 0.12, 0.85, 0.9],
      [0.95, 0.0, 0.65, 0.7],
      [0.0, 0.95, 1.0, 0.4],
      [0.0, 0.0, 0.0, 0.0]
    ]
  },
  velocity: {
    type: 'entangled',
    speed: 3.0,
    spread: 0.4
  },
  acceleration: [0, 0, 0],
  rotation: { start: 0, speed: 90, randomize: true },
  texture: 'particle_quantum_wisp.png',
  blending: 'additive',
  trigger: 'quantum_entangle',
  
  quantumEntanglement: {
    enabled: true,
    pairDistance: 2.0,
    syncPhase: true
  }
};

/**
 * Prismatic Sparkles
 * Rainbow sparkle effects with chromatic dispersion
 * 
 * Performance: ~0.08ms per 100 particles
 */
export const PrismaticSparkles: AdvancedParticleEffect = {
  name: 'PrismaticSparkles',
  maxParticles: 200,
  emissionRate: 0, // Speed-based emission
  lifetime: { min: 0.3, max: 0.8 },
  size: { start: 0.06, end: 0.0, variation: 0.3 },
  color: {
    start: [1.0, 1.0, 1.0, 1.0],
    end: [0.8, 0.8, 1.0, 0.0]
  },
  velocity: {
    type: 'radial',
    speed: 4.0,
    spread: 1.0
  },
  acceleration: [0, -1.5, 0],
  rotation: { start: 0, speed: 180, randomize: true },
  texture: 'particle_prismatic_sparkle.png',
  blending: 'additive',
  trigger: 'speed',
  triggerThreshold: 3.0,
  
  spectralShift: {
    enabled: true,
    speed: 5.0,
    range: 1.0
  }
};

/**
 * Volcanic Ember Trails
 * Floating ember particles with heat shimmer
 * 
 * Performance: ~0.12ms per 100 particles
 */
export const VolcanicEmberTrails: AdvancedParticleEffect = {
  name: 'VolcanicEmberTrails',
  maxParticles: 250,
  emissionRate: 45,
  lifetime: { min: 0.8, max: 1.8 },
  size: { start: 0.12, end: 0.04, variation: 0.6 },
  color: {
    start: [1.0, 0.8, 0.2, 0.9],
    end: [0.6, 0.1, 0.0, 0.0],
    gradient: [
      [1.0, 0.9, 0.3, 0.9],
      [1.0, 0.5, 0.05, 0.7],
      [0.8, 0.2, 0.0, 0.4],
      [0.3, 0.05, 0.0, 0.0]
    ]
  },
  velocity: {
    type: 'directional',
    speed: 2.5,
    spread: 0.6,
    direction: [0, 1, 0]
  },
  acceleration: [0, 1.2, 0],
  rotation: { start: 0, speed: 60, randomize: false },
  texture: 'particle_ember_glow.png',
  blending: 'additive',
  trigger: 'continuous',
  
  heatShimmer: {
    enabled: true,
    intensity: 0.15,
    speed: 3.0
  }
};

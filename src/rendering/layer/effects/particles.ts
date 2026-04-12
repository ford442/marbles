/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Particle Effects
 */

import { ParticleEffect } from '../types';

export const SpeedSparkleEffect: ParticleEffect = {
  name: 'SpeedSparkles',
  maxParticles: 100,
  emissionRate: 0,  // Emission controlled by speed
  lifetime: { min: 0.3, max: 0.8 },
  size: { start: 0.05, end: 0.0 },
  color: {
    start: [1.0, 1.0, 0.8, 0.8],
    end: [1.0, 0.6, 0.2, 0.0]
  },
  velocity: { type: 'directional', speed: 2.0, spread: 0.5 },
  acceleration: [0, -2.0, 0],  // Gravity
  texture: 'particle_sparkle.png',
  blending: 'additive',
  trigger: 'speed',
  triggerThreshold: 5.0  // Trigger when speed > 5 units/sec
};

export const ImpactBurstEffect: ParticleEffect = {
  name: 'ImpactBurst',
  maxParticles: 50,
  emissionRate: 0,  // One-shot on impact
  lifetime: { min: 0.2, max: 0.6 },
  size: { start: 0.1, end: 0.0 },
  color: {
    start: [1.0, 0.9, 0.7, 1.0],
    end: [0.8, 0.3, 0.1, 0.0]
  },
  velocity: { type: 'burst', speed: 8.0, spread: 1.0 },
  acceleration: [0, -5.0, 0],
  texture: 'particle_burst.png',
  blending: 'additive',
  trigger: 'impact',
  triggerThreshold: 3.0  // Impact force threshold
};

export const BoostFlameEffect: ParticleEffect = {
  name: 'BoostFlame',
  maxParticles: 200,
  emissionRate: 60,
  lifetime: { min: 0.1, max: 0.4 },
  size: { start: 0.15, end: 0.05 },
  color: {
    start: [0.2, 0.6, 1.0, 0.9],
    end: [0.0, 0.2, 0.8, 0.0]
  },
  velocity: { type: 'directional', speed: -10.0, spread: 0.3 },
  acceleration: [0, 0, 0],
  texture: 'particle_flame.png',
  blending: 'additive',
  trigger: 'boost'
};

export const NeonTrailEffect: ParticleEffect = {
  name: 'NeonTrail',
  maxParticles: 150,
  emissionRate: 30,
  lifetime: { min: 0.5, max: 1.0 },
  size: { start: 0.08, end: 0.0 },
  color: {
    start: [0.0, 1.0, 1.0, 0.7],
    end: [0.5, 0.0, 1.0, 0.0]
  },
  velocity: { type: 'directional', speed: 0.5, spread: 0.1 },
  acceleration: [0, 0, 0],
  texture: 'particle_trail.png',
  blending: 'additive',
  trigger: 'continuous'
};

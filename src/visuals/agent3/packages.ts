/**
 * Agent 3: Advanced Rendering Layer - Complete Rendering Packages
 * 
 * Pre-configured complete rendering packages combining materials,
 * particle effects, post-processing, and lighting configurations.
 */

import { AdvancedMarbleRenderingPackage } from './types';
import { QuantumMarbleConfig, PrismaticMarbleConfig, VolcanicMarbleConfig } from './effects/materials';
import { QuantumEntanglementParticles, PrismaticSparkles, VolcanicEmberTrails } from './effects/particles';
import { QuantumPostProcess, PrismaticPostProcess, VolcanicPostProcess } from './effects/post-process';
import { DefaultSSSSConfig, LavaSSSSConfig } from './lighting/ssss';
import { DefaultProbeBlendingConfig } from './lighting/probes';

/**
 * Quantum Marble Complete Package
 */
export const QuantumMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'QuantumMarble',
  materialConfig: QuantumMarbleConfig,
  particleEffects: [QuantumEntanglementParticles],
  postProcessConfig: QuantumPostProcess,
  ssssConfig: {
    ...DefaultSSSSConfig,
    absorptionColor: [0.7, 0.4, 0.9],
    absorptionCoefficients: { red: 0.6, green: 1.0, blue: 1.2 }
  },
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * Prismatic Marble Complete Package
 */
export const PrismaticMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'PrismaticMarble',
  materialConfig: PrismaticMarbleConfig,
  particleEffects: [PrismaticSparkles],
  postProcessConfig: PrismaticPostProcess,
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * Volcanic Marble Complete Package
 */
export const VolcanicMarblePackage: AdvancedMarbleRenderingPackage = {
  name: 'VolcanicMarble',
  materialConfig: VolcanicMarbleConfig,
  particleEffects: [VolcanicEmberTrails],
  postProcessConfig: VolcanicPostProcess,
  ssssConfig: LavaSSSSConfig,
  probeBlending: DefaultProbeBlendingConfig
};

/**
 * All advanced marble packages
 */
export const AllAdvancedMarblePackages: AdvancedMarbleRenderingPackage[] = [
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage
];

/**
 * Agent 3: Advanced Rendering Layer
 * Marble Visual Overhaul Agent Swarm
 * 
 * Next-generation custom shaders and effects including:
 * - Quantum entanglement visualization shaders
 * - Prismatic chromatic dispersion effects
 * - Volcanic lava glow with heat distortion
 * - Advanced particle systems
 * - Enhanced post-processing (DOF, vignette, film grain)
 * - Screen-space subsurface scattering
 * - Probe blending for zone transitions
 * 
 * Performance Budget: < 1.0ms per marble (high-quality shaders)
 * @module agent3_advanced_rendering
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  AdvancedParticleEffect,
  AdvancedMaterialConfig,
  EnhancedPostProcessConfig,
  SSSSConfig,
  ProbeBlendingConfig,
  ZoneTransitionConfig,
  ZoneAwareReflectionProbe,
  AdvancedMarbleRenderingPackage,
  PerformanceProfile,
  PerformanceProfiles
} from './types';

// ============================================================================
// SHADERS
// ============================================================================

export {
  ADVANCED_VERTEX_SHADER,
  QUANTUM_MARBLE_FRAGMENT_SHADER,
  PRISMATIC_MARBLE_FRAGMENT_SHADER,
  VOLCANIC_MARBLE_FRAGMENT_SHADER
} from './shaders';

// ============================================================================
// EFFECTS
// ============================================================================

// Particle effects
export {
  QuantumEntanglementParticles,
  PrismaticSparkles,
  VolcanicEmberTrails
} from './effects';

// Material configs
export {
  QuantumMarbleConfig,
  PrismaticMarbleConfig,
  VolcanicMarbleConfig
} from './effects';

// Post-process configs
export {
  QuantumPostProcess,
  PrismaticPostProcess,
  VolcanicPostProcess,
  RetroFilmPostProcess
} from './effects';

// ============================================================================
// LIGHTING
// ============================================================================

export {
  DefaultSSSSConfig,
  StoneSSSSConfig,
  LavaSSSSConfig,
  DefaultProbeBlendingConfig
} from './lighting';

export type {
  ProbeBlendingConfig,
  ZoneTransitionConfig,
  ZoneAwareReflectionProbe
} from './lighting';

// ============================================================================
// PACKAGES
// ============================================================================

export {
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  AllAdvancedMarblePackages
} from './packages';

// ============================================================================
// PERFORMANCE
// ============================================================================

export {
  PerformanceProfiles,
  getPerformanceProfile,
  estimateGpuCost
} from './performance';

// ============================================================================
// SHADER SOURCE AGGREGATE
// ============================================================================

import { ADVANCED_VERTEX_SHADER } from './shaders/vertex';
import { QUANTUM_MARBLE_FRAGMENT_SHADER } from './shaders/quantum';
import { PRISMATIC_MARBLE_FRAGMENT_SHADER } from './shaders/prismatic';
import { VOLCANIC_MARBLE_FRAGMENT_SHADER } from './shaders/volcanic';

/**
 * Shader source exports for external use
 */
export const AdvancedShaderSource = {
  vertex: ADVANCED_VERTEX_SHADER,
  quantumFragment: QUANTUM_MARBLE_FRAGMENT_SHADER,
  prismaticFragment: PRISMATIC_MARBLE_FRAGMENT_SHADER,
  volcanicFragment: VOLCANIC_MARBLE_FRAGMENT_SHADER
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

// Import for default export
import { QuantumEntanglementParticles, PrismaticSparkles, VolcanicEmberTrails } from './effects/particles';
import { QuantumMarbleConfig, PrismaticMarbleConfig, VolcanicMarbleConfig } from './effects/materials';
import { QuantumPostProcess, PrismaticPostProcess, VolcanicPostProcess, RetroFilmPostProcess } from './effects/post-process';
import { DefaultSSSSConfig, StoneSSSSConfig, LavaSSSSConfig } from './lighting/ssss';
import { QuantumMarblePackage, PrismaticMarblePackage, VolcanicMarblePackage, AllAdvancedMarblePackages } from './packages';
import { PerformanceProfiles, getPerformanceProfile, estimateGpuCost } from './performance';

/**
 * Default export containing all module exports
 */
export default {
  // Shaders
  ADVANCED_VERTEX_SHADER,
  QUANTUM_MARBLE_FRAGMENT_SHADER,
  PRISMATIC_MARBLE_FRAGMENT_SHADER,
  VOLCANIC_MARBLE_FRAGMENT_SHADER,
  
  // Particle effects
  QuantumEntanglementParticles,
  PrismaticSparkles,
  VolcanicEmberTrails,
  
  // Material configs
  QuantumMarbleConfig,
  PrismaticMarbleConfig,
  VolcanicMarbleConfig,
  
  // Post-process configs
  QuantumPostProcess,
  PrismaticPostProcess,
  VolcanicPostProcess,
  RetroFilmPostProcess,
  
  // SSSS configs
  DefaultSSSSConfig,
  StoneSSSSConfig,
  LavaSSSSConfig,
  
  // Complete packages
  QuantumMarblePackage,
  PrismaticMarblePackage,
  VolcanicMarblePackage,
  AllAdvancedMarblePackages,
  
  // Utilities
  AdvancedShaderSource,
  PerformanceProfiles,
  getPerformanceProfile,
  estimateGpuCost
};

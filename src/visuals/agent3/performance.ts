/**
 * Agent 3: Advanced Rendering Layer - Performance Profiles
 * 
 * Performance profiles and utilities for different platforms.
 */

import { PerformanceProfiles, PerformanceProfile, AdvancedMarbleRenderingPackage } from './types';

/**
 * Performance profile recommendations
 */
export const PerformanceProfiles: PerformanceProfiles = {
  mobile: {
    maxParticles: 100,
    bloomIterations: 3,
    sssSamples: 8,
    dofQuality: 'low',
    aoSamples: 8,
    useHeatDistortion: false
  },
  desktop: {
    maxParticles: 300,
    bloomIterations: 5,
    sssSamples: 16,
    dofQuality: 'high',
    aoSamples: 16,
    useHeatDistortion: true
  },
  ultra: {
    maxParticles: 500,
    bloomIterations: 7,
    sssSamples: 24,
    dofQuality: 'ultra',
    aoSamples: 32,
    useHeatDistortion: true
  }
};

/**
 * Get recommended performance profile for target platform
 */
export function getPerformanceProfile(platform: 'mobile' | 'desktop' | 'ultra'): PerformanceProfile {
  return PerformanceProfiles[platform] || PerformanceProfiles.desktop;
}

/**
 * Estimate total GPU cost for a rendering package
 */
export function estimateGpuCost(pkg: AdvancedMarbleRenderingPackage): number {
  let total = pkg.materialConfig.performance.estimatedGpuCost;
  
  // Add particle cost
  for (const effect of pkg.particleEffects) {
    total += (effect.maxParticles / 100) * 0.1;
  }
  
  // Add post-process cost
  if (pkg.postProcessConfig.bloom.enabled) {
    total += pkg.postProcessConfig.bloom.iterations * 0.05;
  }
  if (pkg.postProcessConfig.depthOfField.enabled) {
    total += 0.2;
  }
  if (pkg.postProcessConfig.ambientOcclusion.enabled) {
    total += pkg.postProcessConfig.ambientOcclusion.sampleCount * 0.01;
  }
  if (pkg.ssssConfig?.enabled) {
    total += pkg.ssssConfig.sampleCount * 0.008;
  }
  
  return total;
}

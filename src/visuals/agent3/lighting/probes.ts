/**
 * Agent 3: Advanced Rendering Layer - Probe Blending
 * 
 * Reflection probe blending configurations for smooth zone transitions.
 */

import { ProbeBlendingConfig, ZoneTransitionConfig, ZoneAwareReflectionProbe } from '../types';

/**
 * Default probe blending configuration
 */
export const DefaultProbeBlendingConfig: ProbeBlendingConfig = {
  enabled: true,
  blendDistance: 5.0,
  blendOverlap: 2.0,
  blendCurve: 1,
  usePriorityWeights: true,
  updateStrategy: 'hybrid',
  maxActiveProbes: 4,
  cullDistance: 50.0
};

// Re-export types for convenience
export { ProbeBlendingConfig, ZoneTransitionConfig, ZoneAwareReflectionProbe };

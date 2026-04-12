/**
 * Agent 4: Track Surface Materials - Probe Blending
 * Reflection probe blending utilities
 */

import { vec3 } from 'gl-matrix';
import { ReflectionProbeHint } from '../types';

/**
 * Blends multiple reflection probes based on position
 */
export function blendReflectionProbes(
  position: vec3,
  probes: ReflectionProbeHint[]
): { probe: ReflectionProbeHint; weight: number }[] {
  const weightedProbes: { probe: ReflectionProbeHint; weight: number; distance: number }[] = [];
  
  // Calculate distance-based weights
  for (const probe of probes) {
    const dist = vec3.distance(position, probe.position);
    if (dist < probe.radius) {
      // Smooth falloff based on distance
      const normalizedDist = dist / probe.radius;
      const weight = Math.pow(1.0 - normalizedDist, 2) * probe.intensity;
      weightedProbes.push({ probe, weight, distance: dist });
    }
  }
  
  // Sort by weight (descending) and normalize
  weightedProbes.sort((a, b) => b.weight - a.weight);
  
  // Normalize weights to sum to 1.0
  const totalWeight = weightedProbes.reduce((sum, wp) => sum + wp.weight, 0);
  
  return weightedProbes.map(wp => ({
    probe: wp.probe,
    weight: totalWeight > 0 ? wp.weight / totalWeight : 0
  }));
}

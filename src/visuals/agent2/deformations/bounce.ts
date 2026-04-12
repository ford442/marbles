/**
 * Bounce Wobble Deformation Module
 * 
 * Generates bounce wobble deformation
 * Creates oscillating jelly-like deformation after impact
 */

import { vec3 } from 'gl-matrix';
import { BounceParams } from '../types';

/**
 * Generate bounce wobble deformation
 * Creates oscillating jelly-like deformation after impact
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Bounce parameters
 * @param time - Current time
 * @returns Deformed position
 */
export function generateBounceWobble(
  position: vec3,
  normal: vec3,
  params: BounceParams,
  time: number
): vec3 {
  const distanceFromCenter = vec3.length(position);

  // Multiple harmonics for complex wobble
  let wobbleAmount = 0;

  for (let h = 1; h <= params.harmonics; h++) {
    const freq = params.frequency * h;
    const decay = Math.exp(-time * params.damping * h);
    const phase = time * freq + h * 0.5;

    // Spherical harmonic-like pattern
    const theta = Math.atan2(position[2], position[0]);
    const phi = Math.acos(Math.max(-1, Math.min(1, position[1] / (distanceFromCenter + 0.001))));

    const harmonic = Math.sin(h * theta) * Math.cos(h * phi * 0.5);
    wobbleAmount += params.intensity * decay * Math.sin(phase) * harmonic / h;
  }

  // Apply wobble along normal
  const result = vec3.create();
  vec3.scaleAndAdd(result, position, normal, wobbleAmount);

  return result;
}

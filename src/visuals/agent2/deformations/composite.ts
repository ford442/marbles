/**
 * Composite Deformation Module
 * 
 * Combines multiple deformation effects into a single application
 */

import { vec3 } from 'gl-matrix';
import { CompositeDeformation } from '../types';
import { generateImpactDeformation } from './impact';
import { generateRollFlattening } from './roll';
import { generateBounceWobble } from './bounce';

/**
 * Apply composite deformation to a vertex
 * @param position - Original position
 * @param normal - Vertex normal
 * @param deformations - Active deformations
 * @param time - Current time
 * @returns Final deformed position
 */
export function applyCompositeDeformation(
  position: vec3,
  normal: vec3,
  deformations: CompositeDeformation,
  time: number
): vec3 {
  let result = vec3.clone(position);
  let currentNormal = vec3.clone(normal);

  // Apply impact deformation
  if (deformations.impact) {
    result = generateImpactDeformation(
      result,
      currentNormal,
      deformations.impact.params,
      time
    );
  }

  // Apply roll flattening
  if (deformations.roll) {
    result = generateRollFlattening(result, currentNormal, deformations.roll.params);
  }

  // Apply bounce wobble
  if (deformations.wobble) {
    const wobbleTime = time - deformations.wobble.startTime;
    result = generateBounceWobble(result, currentNormal, deformations.wobble.params, wobbleTime);
  }

  return result;
}

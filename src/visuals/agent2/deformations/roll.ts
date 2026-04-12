/**
 * Roll Flattening Deformation Module
 * 
 * Generates roll flattening deformation
 * Flattens the sphere where it contacts the ground based on angular velocity
 */

import { vec3 } from 'gl-matrix';
import { RollParams } from '../types';

/**
 * Generate roll flattening deformation
 * Flattens the sphere where it contacts the ground based on angular velocity
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Roll parameters
 * @returns Deformed position
 */
export function generateRollFlattening(
  position: vec3,
  normal: vec3,
  params: RollParams
): vec3 {
  // Calculate rotation axis from angular velocity
  const angularSpeed = vec3.length(params.angularVelocity);
  if (angularSpeed < 0.01) {
    return vec3.clone(position);
  }

  const rollAxis = vec3.create();
  vec3.normalize(rollAxis, params.angularVelocity);

  // Find the "bottom" of the sphere relative to roll direction
  const linearSpeed = vec3.length(params.linearVelocity);
  const velocityDir = vec3.create();

  if (linearSpeed > 0.01) {
    vec3.normalize(velocityDir, params.linearVelocity);
  } else {
    vec3.set(velocityDir, 0, -1, 0);
  }

  // Calculate how much this vertex faces the "ground" in roll direction
  const dotWithDown = -normal[1]; // Assuming Y is up
  const dotWithVelocity = vec3.dot(normal, velocityDir);

  // Flattening occurs on the bottom in the direction of motion
  const flattenFactor = Math.max(0, dotWithDown) *
    Math.max(0, dotWithVelocity) *
    Math.min(1, angularSpeed * 0.1);

  // Apply flattening
  const flattenAmount = flattenFactor * params.maxFlatten;
  const result = vec3.clone(position);
  result[1] -= flattenAmount; // Flatten downward

  // Bulge to preserve volume
  const bulge = flattenAmount * 0.5;
  const horizontalDist = Math.sqrt(position[0] * position[0] + position[2] * position[2]);
  if (horizontalDist > 0.001) {
    result[0] += (position[0] / horizontalDist) * bulge * flattenFactor;
    result[2] += (position[2] / horizontalDist) * bulge * flattenFactor;
  }

  return result;
}

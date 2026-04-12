/**
 * Impact Deformation Module
 * 
 * Generates vertex deformation for impact/squish effects on marble surfaces
 */

import { vec3 } from 'gl-matrix';
import { ImpactParams } from '../types';

/**
 * Generate impact deformation - sphere squish effect
 * Creates a deformation that compresses the mesh along the impact normal
 * 
 * @param position - Original vertex position
 * @param normal - Vertex normal
 * @param params - Impact parameters
 * @param time - Current time
 * @returns Deformed position
 */
export function generateImpactDeformation(
  position: vec3,
  normal: vec3,
  params: ImpactParams,
  time: number
): vec3 {
  const age = time - (performance.now() / 1000 - params.recoveryTime);
  
  if (age > params.recoveryTime || age < 0) {
    return vec3.clone(position);
  }
  
  // Recovery curve (elastic bounce)
  const t = age / params.recoveryTime;
  const recovery = Math.exp(-t * 4) * Math.sin(t * Math.PI * 4);
  
  // Squish factor based on impact force
  const squishAmount = params.force * params.maxSquish * recovery;
  
  // Deform along impact normal
  const deformation = vec3.create();
  vec3.scale(deformation, params.normal, -squishAmount);
  
  // Bulge perpendicular to normal (volume preservation)
  const distanceFromCenter = vec3.length(position);
  const bulgeFactor = squishAmount * 0.3 * (1 - distanceFromCenter);
  
  // Project position onto plane perpendicular to impact normal
  const dotPN = vec3.dot(position, params.normal);
  const parallel = vec3.create();
  vec3.scale(parallel, params.normal, dotPN);
  
  const perpendicular = vec3.create();
  vec3.sub(perpendicular, position, parallel);
  vec3.normalize(perpendicular, perpendicular);
  vec3.scaleAndAdd(deformation, deformation, perpendicular, bulgeFactor);
  
  // Apply deformation
  const result = vec3.create();
  vec3.add(result, position, deformation);
  
  return result;
}

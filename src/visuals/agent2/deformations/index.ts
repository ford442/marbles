/**
 * Deformations Module
 * 
 * Vertex deformation systems for impact, rolling, and bounce effects
 * 
 * @module agent2/deformations
 */

export { generateImpactDeformation } from './impact';
export { generateRollFlattening } from './roll';
export { generateBounceWobble } from './bounce';
export { applyCompositeDeformation } from './composite';

// Re-export types from parent
export type {
  ImpactParams,
  RollParams,
  BounceParams,
  CompositeDeformation,
  DeformationState
} from '../types';

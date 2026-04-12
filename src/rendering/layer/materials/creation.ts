/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Material Creation Functions
 */

import { FilamentMaterialBuilder } from './builder';
import { AllMarbleRenderingPackages } from '../packages';

/**
 * Example: Creating materials for all marble types
 */
export function createAllMarbleMaterials(engine: any): Map<string, any> {
  const materials = new Map<string, any>();

  for (const pkg of AllMarbleRenderingPackages) {
    const builder = new FilamentMaterialBuilder(pkg.materialConfig);
    const material = builder.build(engine);
    materials.set(pkg.name, material);
  }

  return materials;
}

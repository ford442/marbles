/**
 * Agent 4: Track Surface Materials - Quality Selection
 * Material quality selection based on distance and device capabilities
 */

import { MaterialQuality } from './types';

/**
 * Performance optimizer that selects appropriate material quality
 * based on distance from camera and platform capabilities
 */
export function selectOptimalMaterialQuality(
  distanceFromCamera: number,
  isHighEndDevice: boolean = true
): MaterialQuality {
  if (!isHighEndDevice) {
    if (distanceFromCamera > 30) return MaterialQuality.MINIMAL;
    if (distanceFromCamera > 15) return MaterialQuality.LOW;
    return MaterialQuality.MEDIUM;
  }
  
  // High-end device quality selection
  if (distanceFromCamera > 60) return MaterialQuality.LOW;
  if (distanceFromCamera > 30) return MaterialQuality.MEDIUM;
  if (distanceFromCamera > 10) return MaterialQuality.HIGH;
  return MaterialQuality.ULTRA;
}

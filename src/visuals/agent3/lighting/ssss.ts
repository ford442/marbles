/**
 * Agent 3: Advanced Rendering Layer - SSSS Configurations
 * 
 * Screen-Space Subsurface Scattering configurations for various marble types.
 * Approximates light scattering within translucent materials.
 */

import { SSSSConfig } from '../types';

/**
 * Default SSSS configuration for marble materials
 */
export const DefaultSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 16,
  sampleRadius: 0.02,
  weights: [0.23, 0.21, 0.18, 0.15, 0.12, 0.11],
  distanceScale: 1.0,
  absorptionColor: [0.8, 0.6, 0.5],
  absorptionCoefficients: {
    red: 0.8,
    green: 1.2,
    blue: 1.6
  },
  bilateralFilter: true,
  downsample: 2
};

/**
 * Stone marble SSSS (warmer, stronger scattering)
 */
export const StoneSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 20,
  sampleRadius: 0.025,
  weights: [0.25, 0.22, 0.18, 0.14, 0.11, 0.10],
  distanceScale: 1.2,
  absorptionColor: [0.9, 0.75, 0.6],
  absorptionCoefficients: {
    red: 0.7,
    green: 1.0,
    blue: 1.4
  },
  bilateralFilter: true,
  downsample: 2
};

/**
 * Lava SSSS (strong emission, minimal absorption)
 */
export const LavaSSSSConfig: SSSSConfig = {
  enabled: true,
  sampleCount: 12,
  sampleRadius: 0.03,
  weights: [0.3, 0.25, 0.2, 0.12, 0.08, 0.05],
  distanceScale: 2.0,
  absorptionColor: [1.0, 0.4, 0.1],
  absorptionCoefficients: {
    red: 0.5,
    green: 1.5,
    blue: 2.0
  },
  bilateralFilter: false,
  downsample: 2
};

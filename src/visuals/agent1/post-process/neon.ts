/**
 * Agent 1: Beauty Layer - Neon Post-Processing Configuration
 * @module agent1/post-process/neon
 */

import { PostProcessConfig } from '../types';

/**
 * Refined post-processing for neon glow marbles
 */
export const RefinedNeonPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 2.5,
    threshold: 0.25,
    radius: 1.1,
    iterations: 7
  },
  motionBlur: {
    enabled: true,
    intensity: 0.45,
    samples: 12
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.025
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 56,
    stepSize: 0.055,
    thickness: 0.12
  },
  colorGrading: {
    enabled: true,
    contrast: 1.18,
    saturation: 1.35,
    tint: [1.02, 0.95, 1.08]
  }
};

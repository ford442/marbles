/**
 * Agent 1: Beauty Layer - Glass Post-Processing Configuration
 * @module agent1/post-process/glass
 */

import { PostProcessConfig } from '../types';

/**
 * Refined post-processing for glass marbles
 */
export const RefinedGlassPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.45,
    threshold: 0.75,
    radius: 0.55,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.35,
    samples: 10
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 72,
    stepSize: 0.045,
    thickness: 0.08
  },
  colorGrading: {
    enabled: true,
    contrast: 1.12,
    saturation: 1.05,
    tint: [1.0, 1.0, 1.08]
  }
};

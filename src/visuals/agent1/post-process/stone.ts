/**
 * Agent 1: Beauty Layer - Stone Post-Processing Configuration
 * @module agent1/post-process/stone
 */

import { PostProcessConfig } from '../types';

/**
 * Refined post-processing for stone vein marbles
 */
export const RefinedStonePostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.28,
    threshold: 0.85,
    radius: 0.45,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.25,
    samples: 8
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: false,
    maxSteps: 40,
    stepSize: 0.09,
    thickness: 0.18
  },
  colorGrading: {
    enabled: true,
    contrast: 1.06,
    saturation: 0.94,
    tint: [1.04, 1.0, 0.96]
  }
};

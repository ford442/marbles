/**
 * Agent 1: Beauty Layer - Obsidian Post-Processing Configuration
 * @module agent1/post-process/obsidian
 */

import { PostProcessConfig } from '../types';

/**
 * Refined post-processing for obsidian metal marbles
 */
export const RefinedObsidianPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.55,
    threshold: 0.55,
    radius: 0.75,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.55,
    samples: 14
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 88,
    stepSize: 0.035,
    thickness: 0.04
  },
  colorGrading: {
    enabled: true,
    contrast: 1.25,
    saturation: 0.82,
    tint: [0.92, 0.92, 1.0]
  }
};

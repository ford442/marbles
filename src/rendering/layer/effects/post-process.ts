/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Post-Processing Configurations
 */

import { PostProcessConfig } from '../types';

export const GlassPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.3,
    threshold: 0.8,
    radius: 0.5,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.3,
    samples: 8
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.05,
    thickness: 0.1
  },
  colorGrading: {
    enabled: true,
    contrast: 1.1,
    saturation: 1.0,
    tint: [1.0, 1.0, 1.05]  // Slight blue tint
  }
};

export const ObsidianPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.4,
    threshold: 0.6,
    radius: 0.7,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.5,
    samples: 12
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 80,
    stepSize: 0.04,
    thickness: 0.05
  },
  colorGrading: {
    enabled: true,
    contrast: 1.2,
    saturation: 0.85,
    tint: [0.95, 0.95, 1.0]
  }
};

export const NeonPostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 2.0,
    threshold: 0.3,
    radius: 1.0,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 10
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.02  // RGB split on boost
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 48,
    stepSize: 0.06,
    thickness: 0.15
  },
  colorGrading: {
    enabled: true,
    contrast: 1.15,
    saturation: 1.3,
    tint: [1.0, 0.95, 1.05]
  }
};

export const StonePostProcess: PostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.2,
    threshold: 0.9,
    radius: 0.4,
    iterations: 3
  },
  motionBlur: {
    enabled: true,
    intensity: 0.2,
    samples: 6
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.0
  },
  screenSpaceReflections: {
    enabled: false,
    maxSteps: 32,
    stepSize: 0.08,
    thickness: 0.2
  },
  colorGrading: {
    enabled: true,
    contrast: 1.05,
    saturation: 0.95,
    tint: [1.02, 1.0, 0.98]  // Slight warm tint
  }
};

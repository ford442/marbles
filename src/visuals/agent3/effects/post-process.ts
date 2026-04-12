/**
 * Agent 3: Advanced Rendering Layer - Post-Processing Configurations
 * 
 * Enhanced post-processing configs including bloom, DOF, vignette, film grain,
 * and theme-specific presets.
 */

import { EnhancedPostProcessConfig } from '../types';

/**
 * Quantum Theme Post-Processing
 * Cinematic sci-fi look with subtle effects
 */
export const QuantumPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 1.5,
    threshold: 0.35,
    radius: 0.85,
    iterations: 5
  },
  motionBlur: {
    enabled: true,
    intensity: 0.35,
    samples: 10
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.012,
    spectralShift: true
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 56,
    stepSize: 0.05,
    thickness: 0.08
  },
  colorGrading: {
    enabled: true,
    contrast: 1.15,
    saturation: 1.1,
    tint: [0.92, 0.95, 1.0] // Cool blue tint
  },
  depthOfField: {
    enabled: true,
    focusDistance: 8.0,
    focusRange: 4.0,
    blurRadius: 8.0,
    bokehShape: 'hexagonal',
    bokehIntensity: 0.6
  },
  vignette: {
    enabled: true,
    intensity: 0.35,
    smoothness: 0.75,
    color: [0.05, 0.02, 0.1], // Deep purple
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.08,
    speed: 24.0,
    size: 1.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.2,
    radius: 0.6,
    sampleCount: 16
  }
};

/**
 * Prismatic Theme Post-Processing
 * Vibrant rainbow aesthetic with colorful vignette
 */
export const PrismaticPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 1.2,
    threshold: 0.4,
    radius: 0.7,
    iterations: 4
  },
  motionBlur: {
    enabled: true,
    intensity: 0.25,
    samples: 8
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.025, // Stronger for prismatic effect
    spectralShift: true
  },
  screenSpaceReflections: {
    enabled: true,
    maxSteps: 64,
    stepSize: 0.04,
    thickness: 0.06
  },
  colorGrading: {
    enabled: true,
    contrast: 1.08,
    saturation: 1.25, // Boosted saturation
    tint: [1.0, 1.0, 1.0]
  },
  depthOfField: {
    enabled: true,
    focusDistance: 10.0,
    focusRange: 5.0,
    blurRadius: 6.0,
    bokehShape: 'circular',
    bokehIntensity: 0.8 // Stronger bokeh for sparkle
  },
  vignette: {
    enabled: true,
    intensity: 0.25,
    smoothness: 0.6,
    color: [0.1, 0.05, 0.15], // Subtle purple
    rounded: false
  },
  filmGrain: {
    enabled: false,
    intensity: 0.0,
    speed: 0.0,
    size: 0.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.0,
    radius: 0.5,
    sampleCount: 12
  }
};

/**
 * Volcanic Theme Post-Processing
 * Warm, intense look with heat distortion
 */
export const VolcanicPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 3.0, // Strong bloom for lava glow
    threshold: 0.25,
    radius: 1.2,
    iterations: 6
  },
  motionBlur: {
    enabled: true,
    intensity: 0.4,
    samples: 12
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.018,
    spectralShift: false
  },
  screenSpaceReflections: {
    enabled: false // Disabled for performance with heat distortion
  },
  colorGrading: {
    enabled: true,
    contrast: 1.25,
    saturation: 1.3,
    tint: [1.15, 0.95, 0.85] // Warm orange tint
  },
  depthOfField: {
    enabled: true,
    focusDistance: 7.0,
    focusRange: 3.0,
    blurRadius: 10.0,
    bokehShape: 'circular',
    bokehIntensity: 0.7
  },
  vignette: {
    enabled: true,
    intensity: 0.4,
    smoothness: 0.8,
    color: [0.2, 0.05, 0.0], // Warm dark red
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.12, // Heavier grain for volcanic texture
    speed: 18.0,
    size: 1.5,
    colorized: true // Warm colored grain
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.4,
    radius: 0.7,
    sampleCount: 20
  },
  heatDistortion: {
    enabled: true,
    strength: 0.05,
    speed: 2.5
  }
};

/**
 * Retro/Classic Film Post-Processing
 * Nostalgic film aesthetic
 */
export const RetroFilmPostProcess: EnhancedPostProcessConfig = {
  bloom: {
    enabled: true,
    intensity: 0.4,
    threshold: 0.7,
    radius: 0.4,
    iterations: 3
  },
  motionBlur: {
    enabled: true,
    intensity: 0.5,
    samples: 6
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.008,
    spectralShift: false
  },
  screenSpaceReflections: {
    enabled: false
  },
  colorGrading: {
    enabled: true,
    contrast: 1.3,
    saturation: 0.75, // Desaturated
    tint: [0.95, 0.9, 0.8] // Sepia-like
  },
  depthOfField: {
    enabled: true,
    focusDistance: 12.0,
    focusRange: 8.0,
    blurRadius: 12.0,
    bokehShape: 'circular',
    bokehIntensity: 0.5
  },
  vignette: {
    enabled: true,
    intensity: 0.6,
    smoothness: 0.9,
    color: [0.0, 0.0, 0.0],
    rounded: true
  },
  filmGrain: {
    enabled: true,
    intensity: 0.25, // Heavy grain
    speed: 12.0,
    size: 2.0,
    colorized: false
  },
  ambientOcclusion: {
    enabled: true,
    intensity: 1.3,
    radius: 0.8,
    sampleCount: 12
  }
};

/**
 * Marble Visual Overhaul - Advanced Rendering Layer
 * Environment Configuration
 */

import {
  RenderingQualityProfile,
  RenderingQualityProfileName,
  EnvironmentConfig
} from './types';

export const RenderingQualityProfiles: Record<RenderingQualityProfileName, RenderingQualityProfile> = {
  balanced: {
    name: 'balanced',
    maxProbeUpdatesPerFrame: 1,
    probeResolutionScale: 0.75,
    ssrStepScale: 0.75,
    bloomIterationCap: 4,
    shadowMapResolution: 1024,
    lodHysteresisMeters: 1.0
  },
  high: {
    name: 'high',
    maxProbeUpdatesPerFrame: 2,
    probeResolutionScale: 1.0,
    ssrStepScale: 1.0,
    bloomIterationCap: 5,
    shadowMapResolution: 2048,
    lodHysteresisMeters: 1.5
  },
  cinematic: {
    name: 'cinematic',
    maxProbeUpdatesPerFrame: 4,
    probeResolutionScale: 1.5,
    ssrStepScale: 1.25,
    bloomIterationCap: 7,
    shadowMapResolution: 4096,
    lodHysteresisMeters: 2.0
  }
};

export const DefaultEnvironmentConfig: EnvironmentConfig = {
  qualityProfile: 'high',
  iblIntensity: 1.0,
  iblRotation: 0.0,
  reflectionProbes: [
    {
      id: 'global_probe',
      resolution: 256,
      updateMode: 'realtime',
      updateInterval: 0.0,
      position: [0, 5, 0],
      near: 0.1,
      far: 100.0,
      cullingMask: ['marbles', 'environment'],
      intensity: 1.0,
      priority: 1
    }
  ],
  directionalLight: {
    enabled: true,
    direction: [1.0, 1.0, 0.5],
    color: [1.0, 0.97, 0.93],
    intensity: 1.0,
    castShadows: true
  },
  shadow: {
    enabled: true,
    mapResolution: 2048,
    cascadeCount: 3,
    cascadeSplits: [0.1, 0.35, 1.0],
    bias: 0.0008,
    normalBias: 0.1,
    softness: 0.7,
    maxDistance: 80.0
  },
  skybox: {
    enabled: true,
    texture: 'env_sky_cloudy.hdr',
    color: [0.5, 0.6, 0.7],
    exposure: 1.0
  }
};

/**
 * Marble Rendering Manager - Main entry point
 * Runtime system for managing materials, effects, and post-processing
 */

// Export types
export type {
  Vector3,
  Transform,
  MarbleInstance,
  Particle,
  ManagedReflectionProbe,
  RenderingManagerInitializationOptions
} from './types';

// Export main class
export { MarbleRenderingManager } from './MarbleRenderingManager';

// Export utility functions
export { createRenderingManager } from './factory';
export { resolveEnvironmentConfig } from './environment';
export { loadMarblePackage } from './loader';
export { buildTrackZoneVisualMetadataFromTrack } from './track-metadata';

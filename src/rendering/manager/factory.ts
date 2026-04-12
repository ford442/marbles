/**
 * Factory functions for creating Marble Rendering Manager instances
 */

import { MarbleRenderingManager } from './MarbleRenderingManager';
import { RenderingManagerInitializationOptions } from './types';
import { resolveEnvironmentConfig } from './environment';
import { buildTrackZoneVisualMetadataFromTrack } from './track-metadata';

export function createRenderingManager(
  engine: any,
  scene: any,
  view: any,
  camera: any,
  options?: RenderingManagerInitializationOptions
): MarbleRenderingManager {
  const manager = new MarbleRenderingManager(engine, scene, view, camera);

  manager.initializeMaterials();
  manager.initializeParticleSystems();

  const resolvedEnvironment = resolveEnvironmentConfig(options?.environmentConfig);
  manager.initializeEnvironment(resolvedEnvironment);

  if (options?.trackData) {
    const metadata = buildTrackZoneVisualMetadataFromTrack(options.trackData);
    manager.setTrackZoneVisualMetadata(metadata);
  }

  return manager;
}

/**
 * Agent 4: Track Surface Materials & Integration
 * Marble Visual Overhaul - Track Material Refinements
 * 
 * Provides track surface material definitions, procedural wear/dirt accumulation,
 * dynamic surface properties, zone-based reflection probes, and integration utilities.
 * 
 * @module agent4_track_materials
 * @requires filament
 * @requires gl-matrix
 */

// Types
export * from './types';

// Materials
export * from './materials';

// Wear simulation
export * from './wear';

// Reflection probes
export * from './probes';

// Zones
export * from './zones';

// Quality selection
export * from './quality';

// Batch updater
export * from './batch-updater';

// Re-export for backward compatibility (default export)
import { TrackSurfaceType, SurfaceFinish, TrafficIntensity, MaterialQuality } from './types';
import { BASE_TRACK_MATERIALS } from './materials';
import { DEFAULT_WEAR_STATE, DEFAULT_WEAR_CONFIG } from './wear';
import { DEFAULT_ZONE_PROBE } from './probes';
import { PREDEFINED_ZONE_CONFIGS } from './zones';
import {
  getTrackMaterialForZone,
  createTrackMaterial,
  createMainJSCompatibleMaterial,
  createZoneVisualMetadata
} from './materials';
import { createZoneReflectionProbe, blendReflectionProbes } from './probes';
import { createMaterialVariant } from './materials';
import { updateWearState, applyWearToMaterial } from './wear';
import { selectOptimalMaterialQuality } from './quality';
import { TrackMaterialBatchUpdater } from './batch-updater';

/**
 * Quick reference integration guide for main.js:
 * 
 * 1. Import this module:
 *    import * as TrackMaterials from './visuals/agent4/index.js';
 * 
 * 2. In createStaticBox, get material based on zone type:
 *    const trackMat = TrackMaterials.getTrackMaterialForZone(
 *      zoneId, 
 *      TrackMaterials.TrackSurfaceType.METAL
 *    );
 * 
 * 3. Create material instance:
 *    const matInstance = TrackMaterials.createTrackMaterial(
 *      this.engine,
 *      trackMat.properties
 *    );
 * 
 * 4. For dynamic wear, use the batch updater:
 *    this.trackMaterialUpdater = new TrackMaterials.TrackMaterialBatchUpdater(this.engine);
 *    this.trackMaterialUpdater.registerZone(zoneMetadata);
 *    this.trackMaterialUpdater.addInstance(zoneId, matInstance);
 * 
 * 5. In the update loop:
 *    this.trackMaterialUpdater.setCameraPosition(cameraPos);
 *    this.trackMaterialUpdater.update(deltaTime);
 * 
 * 6. Record contacts for wear:
 *    this.trackMaterialUpdater.recordContact(zoneId, 1, speed, isSkidding);
 */

// Default export for convenience
export default {
  TrackSurfaceType,
  SurfaceFinish,
  TrafficIntensity,
  MaterialQuality,
  BASE_TRACK_MATERIALS,
  DEFAULT_WEAR_STATE,
  DEFAULT_WEAR_CONFIG,
  DEFAULT_ZONE_PROBE,
  PREDEFINED_ZONE_CONFIGS,
  getTrackMaterialForZone,
  createTrackMaterial,
  createMainJSCompatibleMaterial,
  createZoneVisualMetadata,
  createZoneReflectionProbe,
  createMaterialVariant,
  updateWearState,
  applyWearToMaterial,
  blendReflectionProbes,
  selectOptimalMaterialQuality,
  TrackMaterialBatchUpdater
};

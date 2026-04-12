/**
 * Agent 4: Track Surface Materials - Batch Updater
 * Batch material updater for efficient LOD transitions
 */

import * as Filament from 'filament';
import { vec3 } from 'gl-matrix';
import { TrackZoneVisualMetadata, MaterialQuality } from './types';
import { createMaterialVariant } from './materials/variants';
import { updateWearState } from './wear/simulation';
import { applyWearToMaterial } from './wear/simulation';
import { DEFAULT_WEAR_CONFIG } from './wear/config';
import { selectOptimalMaterialQuality } from './quality';

/**
 * Batch material updater for efficient LOD transitions
 * Call this during the render loop to update track materials
 */
export class TrackMaterialBatchUpdater {
  private zoneMaterials: Map<string, {
    metadata: TrackZoneVisualMetadata;
    instances: Filament.MaterialInstance[];
    lastQuality: MaterialQuality;
  }> = new Map();
  
  private cameraPosition: vec3 = vec3.create();
  private isHighEndDevice: boolean = true;
  
  constructor(private engine: Filament.Engine) {}
  
  /**
   * Register a zone for material management
   */
  registerZone(metadata: TrackZoneVisualMetadata): void {
    this.zoneMaterials.set(metadata.zoneId, {
      metadata,
      instances: [],
      lastQuality: MaterialQuality.HIGH
    });
  }
  
  /**
   * Add a material instance to a zone's management
   */
  addInstance(zoneId: string, instance: Filament.MaterialInstance): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (zone) {
      zone.instances.push(instance);
    }
  }
  
  /**
   * Update camera position for LOD calculations
   */
  setCameraPosition(position: vec3): void {
    vec3.copy(this.cameraPosition, position);
  }
  
  /**
   * Set device capability tier
   */
  setDeviceCapabilities(isHighEnd: boolean): void {
    this.isHighEndDevice = isHighEnd;
  }
  
  /**
   * Update all materials based on current camera position
   * Call once per frame
   */
  update(deltaTime: number): void {
    for (const [zoneId, zone] of this.zoneMaterials) {
      const distance = vec3.distance(
        this.cameraPosition, 
        zone.metadata.reflectionProbe?.position || vec3.create()
      );
      
      const optimalQuality = selectOptimalMaterialQuality(
        distance, 
        this.isHighEndDevice
      );
      
      // Only update if quality changed
      if (optimalQuality !== zone.lastQuality) {
        this.updateZoneQuality(zoneId, optimalQuality);
        zone.lastQuality = optimalQuality;
      }
      
      // Update wear simulation
      const newWearState = updateWearState(
        zone.metadata.wearState,
        DEFAULT_WEAR_CONFIG,
        deltaTime
      );
      
      zone.metadata.wearState = newWearState;
    }
  }
  
  private updateZoneQuality(zoneId: string, quality: MaterialQuality): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (!zone) return;
    
    // Create new material variant
    const newProps = createMaterialVariant(zone.metadata.material, quality);
    const wornProps = applyWearToMaterial(
      newProps, 
      zone.metadata.wearState, 
      zone.metadata.surfaceType
    );
    
    // Update all instances
    for (const instance of zone.instances) {
      if (instance) {
        instance.setParameter('roughness', wornProps.roughness);
        instance.setParameter('metallic', wornProps.metallic);
        instance.setParameter('clearCoat', wornProps.clearCoat);
      }
    }
  }
  
  /**
   * Get wear state for a specific zone
   */
  getWearState(zoneId: string): import('../types').TrackWearState | null {
    return this.zoneMaterials.get(zoneId)?.metadata.wearState || null;
  }
  
  /**
   * Record marble contact for wear simulation
   */
  recordContact(
    zoneId: string, 
    count: number, 
    speed: number, 
    isSkidding: boolean = false
  ): void {
    const zone = this.zoneMaterials.get(zoneId);
    if (!zone) return;
    
    zone.metadata.wearState = updateWearState(
      zone.metadata.wearState,
      DEFAULT_WEAR_CONFIG,
      0, // No time delta for event-based updates
      { count, speed, isSkidding }
    );
  }
  
  /**
   * Dispose all managed resources
   */
  dispose(): void {
    for (const zone of this.zoneMaterials.values()) {
      for (const instance of zone.instances) {
        // Note: Material instances are typically managed by the engine
        // Only dispose if explicitly required by your Filament setup
      }
    }
    this.zoneMaterials.clear();
  }
}

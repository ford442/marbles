/**
 * Agent 4: Track Surface Materials - Wear Simulation
 * Track wear simulation and material application
 */

import { vec4 } from 'gl-matrix';
import { TrackWearState, TrackMaterialProperties, TrackSurfaceType } from '../types';
import { WearSimulationConfig } from './config';

/**
 * Tracks wear and dirt accumulation on track surfaces
 * Call this each frame or when marbles contact the surface
 */
export function updateWearState(
  currentState: TrackWearState,
  config: WearSimulationConfig,
  deltaTime: number,
  contactInfo?: {
    count: number;
    speed: number;
    isSkidding: boolean;
  }
): TrackWearState {
  const newState: TrackWearState = { ...currentState };
  
  // Apply time-based dirt accumulation
  newState.dirtLevel = Math.min(
    1.0,
    newState.dirtLevel + config.dirtAccumulationRate * deltaTime
  );
  
  // Heat dissipation
  newState.heatDiscoloration = Math.max(
    0.0,
    newState.heatDiscoloration - config.heatDissipationRate * deltaTime
  );
  
  // Process contact events
  if (contactInfo && contactInfo.count > 0) {
    newState.contactCount += contactInfo.count;
    
    // Wear from contacts
    const wearIncrease = config.wearPerContact * contactInfo.count;
    newState.wearAmount = Math.min(1.0, newState.wearAmount + wearIncrease);
    
    // Polishing effect in high-traffic areas
    const polishIncrease = config.polishPerContact * contactInfo.count;
    newState.polishedPathIntensity = Math.min(1.0, 
      newState.polishedPathIntensity + polishIncrease
    );
    
    // Skid marks from high speed or braking
    if (contactInfo.isSkidding || contactInfo.speed > 5.0) {
      const skidIncrease = config.skidIntensityMultiplier * 
        (contactInfo.speed / 10.0) * contactInfo.count;
      newState.skidMarkIntensity = Math.min(1.0, 
        newState.skidMarkIntensity + skidIncrease
      );
    }
    
    // Heat from friction
    const heatIncrease = config.heatPerContact * contactInfo.speed * contactInfo.count;
    newState.heatDiscoloration = Math.min(1.0, 
      newState.heatDiscoloration + heatIncrease
    );
    
    newState.lastWearTime = performance.now();
  }
  
  return newState;
}

/**
 * Applies wear state to material properties
 * Returns modified material properties reflecting wear/dirt
 */
export function applyWearToMaterial(
  baseMaterial: TrackMaterialProperties,
  wearState: TrackWearState,
  surfaceType: TrackSurfaceType
): TrackMaterialProperties {
  const wornMaterial: TrackMaterialProperties = {
    baseColor: vec4.clone(baseMaterial.baseColor),
    roughness: baseMaterial.roughness,
    metallic: baseMaterial.metallic,
    reflectance: baseMaterial.reflectance,
    clearCoat: baseMaterial.clearCoat,
    clearCoatRoughness: baseMaterial.clearCoatRoughness,
    subsurfaceScattering: baseMaterial.subsurfaceScattering,
    ambientOcclusion: baseMaterial.ambientOcclusion,
    emissive: vec4.clone(baseMaterial.emissive),
    emissiveIntensity: baseMaterial.emissiveIntensity,
    anisotropy: baseMaterial.anisotropy,
    sheen: baseMaterial.sheen,
    sheenColor: vec4.clone(baseMaterial.sheenColor)
  };
  
  // Wear increases roughness
  wornMaterial.roughness = Math.min(1.0, 
    wornMaterial.roughness + wearState.wearAmount * 0.4
  );
  
  // Polishing in traffic paths reduces roughness
  wornMaterial.roughness = Math.max(0.0,
    wornMaterial.roughness - wearState.polishedPathIntensity * 0.3
  );
  
  // Dirt darkens the surface and increases roughness
  const dirtDarken = wearState.dirtLevel * 0.3;
  wornMaterial.baseColor[0] *= (1.0 - dirtDarken);
  wornMaterial.baseColor[1] *= (1.0 - dirtDarken);
  wornMaterial.baseColor[2] *= (1.0 - dirtDarken);
  wornMaterial.roughness = Math.min(1.0, 
    wornMaterial.roughness + wearState.dirtLevel * 0.2
  );
  
  // Heat discoloration (oxidation browning for metals)
  if (wearState.heatDiscoloration > 0.1) {
    const heatTint = wearState.heatDiscoloration * 0.2;
    wornMaterial.baseColor[0] = Math.min(1.0, wornMaterial.baseColor[0] + heatTint);
    wornMaterial.baseColor[1] = Math.min(1.0, wornMaterial.baseColor[1] + heatTint * 0.5);
    wornMaterial.baseColor[2] = Math.max(0.0, wornMaterial.baseColor[2] - heatTint * 0.3);
  }
  
  // Skid marks (dark streaks)
  if (wearState.skidMarkIntensity > 0.1) {
    const skidDarken = wearState.skidMarkIntensity * 0.15;
    wornMaterial.baseColor[0] = Math.max(0.0, wornMaterial.baseColor[0] - skidDarken);
    wornMaterial.baseColor[1] = Math.max(0.0, wornMaterial.baseColor[1] - skidDarken);
    wornMaterial.baseColor[2] = Math.max(0.0, wornMaterial.baseColor[2] - skidDarken);
    wornMaterial.clearCoat = Math.max(0.0, wornMaterial.clearCoat - skidDarken * 2);
  }
  
  // Surface-specific wear effects
  switch (surfaceType) {
    case TrackSurfaceType.ICE:
      // Ice gets cloudy with wear
      wornMaterial.subsurfaceScattering = Math.max(0.0,
        wornMaterial.subsurfaceScattering - wearState.wearAmount * 0.3
      );
      break;
      
    case TrackSurfaceType.METAL:
      // Metal shows more shine when polished
      wornMaterial.metallic = Math.min(1.0,
        wornMaterial.metallic + wearState.polishedPathIntensity * 0.1
      );
      break;
      
    case TrackSurfaceType.OBSIDIAN:
      // Obsidian retains glass-like properties longer
      wornMaterial.roughness = Math.min(1.0,
        wornMaterial.roughness + wearState.wearAmount * 0.2
      );
      break;
  }
  
  return wornMaterial;
}

/**
 * Agent 4: Track Surface Materials - Probe Creation
 * Reflection probe creation utilities
 */

import { vec3 } from 'gl-matrix';
import { ReflectionProbeHint } from '../types';

/**
 * Default reflection probe for track zones
 */
export const DEFAULT_ZONE_PROBE: ReflectionProbeHint = {
  id: 'zone_default',
  position: vec3.fromValues(0, 5, 0),
  radius: 20.0,
  resolution: 128,
  updateMode: 'static',
  updateInterval: 0,
  intensity: 1.0,
  priority: 1,
  cullingMask: ['marbles', 'track', 'environment']
};

/**
 * Creates reflection probe hints for different zone types
 */
export function createZoneReflectionProbe(
  zoneType: string,
  zonePosition: vec3,
  zoneSize: vec3,
  zoneId: string
): ReflectionProbeHint {
  const probe: ReflectionProbeHint = {
    id: `probe_${zoneId}`,
    position: vec3.clone(zonePosition),
    radius: Math.max(zoneSize[0], zoneSize[2]) * 0.8,
    resolution: 128,
    updateMode: 'static',
    updateInterval: 0,
    intensity: 1.0,
    priority: 1,
    cullingMask: ['marbles', 'track', 'environment']
  };
  
  // Adjust probe position and settings based on zone type
  switch (zoneType) {
    case 'ice_cave':
      probe.position[1] += 3; // Higher for ice reflections
      probe.intensity = 1.2;
      probe.resolution = 256; // Higher res for glossy ice
      break;
      
    case 'volcano_zone':
      probe.position[1] += 5;
      probe.intensity = 0.8; // Darker environment
      probe.cullingMask.push('particles'); // Include fire particles
      break;
      
    case 'crystal_cave':
      probe.position[1] += 2;
      probe.intensity = 1.5; // Bright crystal reflections
      probe.resolution = 256;
      break;
      
    case 'boost_pad':
    case 'speed_zone':
      probe.updateMode = 'interval';
      probe.updateInterval = 0.1; // Frequent updates for fast movement
      break;
      
    case 'arena':
    case 'pinball':
      probe.radius = Math.max(zoneSize[0], zoneSize[2]);
      probe.resolution = 256;
      probe.updateMode = 'realtime';
      break;
  }
  
  return probe;
}

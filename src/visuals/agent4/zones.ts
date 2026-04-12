/**
 * Agent 4: Track Surface Materials - Zone Configurations
 * Predefined zone configurations for common track types
 */

import { TrackSurfaceType } from './types';
import { SurfaceFinish } from './types';
import { TrafficIntensity } from './types';
import { TrackZoneVisualMetadata } from './types';

/**
 * Predefined zone configurations for common track types
 */
export const PREDEFINED_ZONE_CONFIGS: Record<string, Partial<TrackZoneVisualMetadata>> = {
  'start_line': {
    surfaceType: TrackSurfaceType.RUBBER,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.EXTREME
  },
  'finish_line': {
    surfaceType: TrackSurfaceType.RUBBER,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.HEAVY
  },
  'checkpoint': {
    surfaceType: TrackSurfaceType.METAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.HEAVY
  },
  'boost_pad': {
    surfaceType: TrackSurfaceType.METAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.EXTREME
  },
  'ice_section': {
    surfaceType: TrackSurfaceType.ICE,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'volcanic_path': {
    surfaceType: TrackSurfaceType.VOLCANIC_ROCK,
    finish: SurfaceFinish.ROUGH,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'crystal_cave': {
    surfaceType: TrackSurfaceType.CRYSTAL,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.LIGHT
  },
  'obsidian_bridge': {
    surfaceType: TrackSurfaceType.OBSIDIAN,
    finish: SurfaceFinish.POLISHED,
    expectedTraffic: TrafficIntensity.MEDIUM
  },
  'sand_trap': {
    surfaceType: TrackSurfaceType.SAND,
    finish: SurfaceFinish.ROUGH,
    expectedTraffic: TrafficIntensity.LIGHT
  },
  'wooden_ramp': {
    surfaceType: TrackSurfaceType.WOOD,
    finish: SurfaceFinish.WEATHERED,
    expectedTraffic: TrafficIntensity.MEDIUM
  }
};

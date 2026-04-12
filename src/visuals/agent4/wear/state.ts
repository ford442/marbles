/**
 * Agent 4: Track Surface Materials - Wear State
 * Default wear state definition
 */

import { TrackWearState } from '../types';

/**
 * Default wear state for new track sections
 */
export const DEFAULT_WEAR_STATE: TrackWearState = {
  wearAmount: 0.0,
  dirtLevel: 0.0,
  contactCount: 0,
  lastWearTime: 0,
  polishedPathIntensity: 0.0,
  skidMarkIntensity: 0.0,
  heatDiscoloration: 0.0
};

/**
 * Track zone visual metadata builder
 */

import { TrackZoneVisualMetadata } from '../../marble_rendering_layer';

export function buildTrackZoneVisualMetadataFromTrack(track: any): TrackZoneVisualMetadata[] {
  const zones = Array.isArray(track) ? track : track?.zones;
  if (!Array.isArray(zones)) return [];

  const metadata: TrackZoneVisualMetadata[] = [];
  for (let index = 0; index < zones.length; index++) {
    const zone = zones[index];
    const surface = zone?.surface;
    if (!surface || typeof surface !== 'object') continue;

    const zoneId = zone?.props?.zone !== undefined
      ? String(zone.props.zone)
      : `zone_${index}`;

    metadata.push({
      zoneId,
      surface,
      reflectionProbeHint: zone?.reflection_probe_hint
    });
  }

  return metadata;
}

export interface TrackSurfacePreset {
    baseColor?: readonly number[];
    [key: string]: unknown;
}

export const trackSurfacePresets: Record<string, TrackSurfacePreset>;

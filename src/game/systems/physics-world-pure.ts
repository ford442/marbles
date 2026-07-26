import { trackSurfacePresets } from '../../material-system.js';

export interface SurfacePreset {
    baseColor?: readonly number[];
    [key: string]: unknown;
}

export type StaticSurfacePresetInput = string | SurfacePreset | null | undefined;

/** Aliases so callers can pass common English names that map to trackSurfacePresets keys. */
export const MATERIAL_SURFACE_ALIASES: Readonly<Record<string, string>> = {
    glass: 'crystal',
    stone: 'obsidian',
    lava: 'volcanicRock',
    volcanic: 'volcanicRock',
    dirt: 'sand',
    rock: 'obsidian',
    steel: 'metal',
    tile: 'metal',
    carpet: 'rubber',
    grass: 'sand',
};

const SURFACE_PRESETS = trackSurfacePresets as Record<string, SurfacePreset | undefined>;

/** Resolve a track surface preset from a string key or preset object. */
export function resolveStaticSurfacePreset(
    materialPreset: StaticSurfacePresetInput,
): SurfacePreset | null {
    if (typeof materialPreset === 'string') {
        const key = MATERIAL_SURFACE_ALIASES[materialPreset] ?? materialPreset;
        return SURFACE_PRESETS[key] ?? null;
    }
    return materialPreset && typeof materialPreset === 'object' ? materialPreset : null;
}

/** Stable batch-group key for static geometry with the same material/color. */
export function getStaticBatchKey(
    color: readonly number[],
    materialPreset: StaticSurfacePresetInput,
    surfacePreset: SurfacePreset | null,
): string {
    const presetKey = typeof materialPreset === 'string'
        ? `preset:${MATERIAL_SURFACE_ALIASES[materialPreset] ?? materialPreset}`
        : `preset-object:${JSON.stringify(surfacePreset ?? null)}`;
    const colorKey = surfacePreset?.baseColor
        ? 'preset-color'
        : color.map((value) => Number(value).toFixed(3)).join(',');
    return `${presetKey}|color:${colorKey}`;
}

export interface StaticBatchingContext {
    rendererType?: string;
    search?: string;
    usingSimpleRenderer?: boolean;
}

/** Whether static mesh batching is enabled for the current URL / renderer. */
export function isStaticBatchingEnabled(ctx: StaticBatchingContext = {}): boolean {
    const usingSimple = ctx.usingSimpleRenderer
        ?? (typeof window !== 'undefined' && window.usingSimpleRenderer);
    if (ctx.rendererType === 'simple-webgl' || usingSimple) return false;

    const search = ctx.search
        ?? (typeof window !== 'undefined' ? window.location.search : '');
    const params = new URLSearchParams(search);
    return !(params.get('staticBatch') === '0' || params.has('noStaticBatch') || params.has('noBatch'));
}

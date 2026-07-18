import { trackSurfacePresets } from '../../material-system.js';

/** Aliases so callers can pass common English names that map to trackSurfacePresets keys */
export const MATERIAL_SURFACE_ALIASES = {
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

/**
 * Resolve a track surface preset from a string key or preset object.
 * @param {string | object | null | undefined} materialPreset
 */
export function resolveStaticSurfacePreset(materialPreset) {
    if (typeof materialPreset === 'string') {
        const key = MATERIAL_SURFACE_ALIASES[materialPreset] || materialPreset;
        return trackSurfacePresets[key] || null;
    }
    return materialPreset && typeof materialPreset === 'object' ? materialPreset : null;
}

/**
 * Stable batch-group key for static geometry with the same material/color.
 * @param {number[]} color
 * @param {string | object | null | undefined} materialPreset
 * @param {object | null} surfacePreset
 */
export function getStaticBatchKey(color, materialPreset, surfacePreset) {
    const presetKey = typeof materialPreset === 'string'
        ? `preset:${MATERIAL_SURFACE_ALIASES[materialPreset] || materialPreset}`
        : `preset-object:${JSON.stringify(surfacePreset || null)}`;
    const colorKey = surfacePreset?.baseColor
        ? 'preset-color'
        : (color || []).map((v) => Number(v).toFixed(3)).join(',');
    return `${presetKey}|color:${colorKey}`;
}

/**
 * Whether static mesh batching is enabled for the current URL / renderer.
 * @param {{ rendererType?: string, search?: string, usingSimpleRenderer?: boolean }} [ctx]
 */
export function isStaticBatchingEnabled(ctx = {}) {
    const usingSimple = ctx.usingSimpleRenderer
        ?? (typeof window !== 'undefined' && window.usingSimpleRenderer);
    if (ctx.rendererType === 'simple-webgl' || usingSimple) return false;

    const search = ctx.search
        ?? (typeof window !== 'undefined' ? window.location.search : '');
    const params = new URLSearchParams(search);
    return !(params.get('staticBatch') === '0' || params.has('noStaticBatch') || params.has('noBatch'));
}

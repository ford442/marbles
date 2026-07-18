/** Material override keys copied from marbles_data entries onto runtime marble objects. */
const MARBLE_MATERIAL_FIELD_KEYS = [
    'roughness', 'metallic', 'reflectance', 'clearCoat', 'clearCoatRoughness',
    'bumpScale', 'bumpFrequency', 'anisotropy', 'grainScale', 'scratchesIntensity',
    'iridescenceScale', 'sparkleDensity', 'heatIntensity', 'crackGlow',
    'thickness', 'fresnelStrength', 'chromaticDispersion', 'emissiveIntensity',
];

/**
 * Extract per-marble material overrides from a marbles_data info object.
 * @param {Record<string, unknown>} info
 */
export function extractMarbleMaterialFields(info) {
    const fields = {};
    for (const key of MARBLE_MATERIAL_FIELD_KEYS) {
        if (info[key] !== undefined) fields[key] = info[key];
    }
    return fields;
}

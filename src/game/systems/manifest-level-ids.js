import manifest from '../../../assets/manifest.json' with { type: 'json' };

/** @type {ReadonlySet<string>} */
export const MANIFEST_LEVEL_IDS = new Set(Object.keys(manifest.maps));

/**
 * @param {string | null | undefined} levelId
 */
export function isManifestLevel(levelId) {
    return levelId != null && MANIFEST_LEVEL_IDS.has(levelId);
}

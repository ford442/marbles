/**
 * Resolve model references from map JSON to fetchable URLs.
 * Paths are relative to the assets/ directory (AssetRegistry convention).
 */

/**
 * @param {string | undefined | null} modelRef
 * @returns {string | null}
 */
export function resolveAssetModelPath(modelRef) {
    if (!modelRef || typeof modelRef !== 'string') return null;
    if (
        modelRef.startsWith('http://') ||
        modelRef.startsWith('https://') ||
        modelRef.startsWith('/') ||
        modelRef.startsWith('data:') ||
        modelRef.startsWith('blob:')
    ) {
        return modelRef;
    }
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
    const normalizedBase = base ? (base.endsWith('/') ? base : `${base}/`) : '';
    const normalized = modelRef.replace(/^\.?\/?(assets\/)?/, '');
    return `${normalizedBase}assets/${normalized}`;
}

/**
 * Parent directory URL for glTF external resource resolution.
 * @param {string} modelUrl
 */
export function modelBasePath(modelUrl) {
    if (modelUrl.startsWith('data:') || modelUrl.startsWith('blob:')) return '';
    const slash = modelUrl.lastIndexOf('/');
    if (slash < 0) return `${document.location}`;
    return modelUrl.slice(0, slash + 1);
}

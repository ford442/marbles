/**
 * Client-side GLB import for the map editor: turns a user-picked .glb File
 * into a placeable "model" zone stamp. Reuses the existing GLB->Rapier
 * trimesh pipeline in assets/gltf-track-loader.js unchanged — the imported
 * model is referenced by a data: URL, which resolveAssetModelPath() and
 * fetch() both already support.
 */

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Pure builder: given a file name + already-read data URL, produce the
 * editor stamp descriptor. Kept separate from readFileAsDataUrl so it can
 * be unit tested without a browser FileReader.
 * @param {string} fileName
 * @param {string} dataUrl
 * @param {number} uniqueId
 * @returns {{ id: string, label: string, type: 'model', icon: string, defaults: object }}
 */
export function buildImportedGlbStamp(fileName, dataUrl, uniqueId) {
    if (!fileName.toLowerCase().endsWith('.glb')) {
        throw new Error('Only .glb files are supported for import');
    }
    const label = fileName.replace(/\.glb$/i, '');
    return {
        id: `imported_${uniqueId}`,
        label,
        type: 'model',
        icon: '📦',
        defaults: {
            model: dataUrl,
            collider: 'trimesh',
        },
    };
}

/**
 * Build an editor stamp for a user-imported GLB file.
 * @param {File} file
 * @param {number} uniqueId
 * @returns {Promise<{ id: string, label: string, type: 'model', icon: string, defaults: object }>}
 */
export async function createImportedGlbStamp(file, uniqueId) {
    const dataUrl = await readFileAsDataUrl(file);
    return buildImportedGlbStamp(file.name, dataUrl, uniqueId);
}

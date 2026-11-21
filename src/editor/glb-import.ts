/**
 * Client-side GLB import for the map editor: turns a user-picked .glb File
 * into a placeable "model" zone stamp. Reuses the existing GLB->Rapier
 * trimesh pipeline in assets/gltf-track-loader.js unchanged — the imported
 * model is referenced by a data: URL, which resolveAssetModelPath() and
 * fetch() both already support.
 */
import type { EditorStamp } from './stamps.ts';

/** A user-imported GLB palette entry (a `model` stamp backed by a data: URL). */
export type ImportedGlbStamp = EditorStamp & {
    type: 'model';
    defaults: { model: string; collider: 'trimesh' };
};

export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // readAsDataURL() always yields a string result.
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Pure builder: given a file name + already-read data URL, produce the
 * editor stamp descriptor. Kept separate from readFileAsDataUrl so it can
 * be unit tested without a browser FileReader.
 */
export function buildImportedGlbStamp(fileName: string, dataUrl: string, uniqueId: number): ImportedGlbStamp {
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
 */
export async function createImportedGlbStamp(file: File, uniqueId: number): Promise<ImportedGlbStamp> {
    const dataUrl = await readFileAsDataUrl(file);
    return buildImportedGlbStamp(file.name, dataUrl, uniqueId);
}

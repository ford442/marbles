/**
 * GLB track catalog for the map editor model stamp picker.
 */

export const TRACK_CATALOG = [
    {
        id: 'neon_showcase',
        label: 'Neon Showcase',
        model: 'tracks/neon_showcase.glb',
        collider: 'trimesh',
        materialPreset: 'neon',
        lod: [{ model: 'tracks/neon_showcase_lod1.glb', distance: 45 }],
    },
];

/** @type {Record<string, typeof TRACK_CATALOG[number]>} */
export const TRACK_BY_ID = Object.fromEntries(TRACK_CATALOG.map((t) => [t.id, t]));

/**
 * Discover additional tracks via Vite glob (dev/build time).
 * @returns {typeof TRACK_CATALOG}
 */
export function getTrackCatalog() {
    const entries = [...TRACK_CATALOG];
    const seen = new Set(entries.map((e) => e.model));

    try {
        const glob = import.meta.glob('/assets/tracks/*.glb', { eager: false, query: '?url', import: 'default' });
        for (const path of Object.keys(glob)) {
            const model = path.replace(/^\//, '').replace(/^assets\//, '');
            if (seen.has(model)) continue;
            seen.add(model);
            const id = model.replace(/^tracks\//, '').replace(/\.glb$/, '');
            entries.push({
                id,
                label: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                model,
                collider: 'trimesh',
            });
        }
    } catch {
        // Node test environment — static catalog only
    }

    return entries;
}

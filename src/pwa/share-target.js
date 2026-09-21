/**
 * Handles the manifest's `share_target` (see public/manifest.webmanifest):
 * when the OS share sheet sends a workshop level URL to the app, the browser
 * navigates here with `?shared_workshop_url=<url>`. We fetch it, parse it as
 * a workshop package, and drop it into the same "Community Levels" collection
 * the map editor's own import flow uses, so it shows up on the level-select
 * screen without any extra UI.
 */

const SHARE_PARAM = 'shared_workshop_url';

/**
 * @returns {Promise<boolean>} true if a shared level was imported.
 */
export async function importSharedWorkshopLevel() {
    if (typeof window === 'undefined') return false;

    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get(SHARE_PARAM);
    if (!sharedUrl) return false;

    // Strip the param immediately so a reload/retry doesn't re-import.
    params.delete(SHARE_PARAM);
    const cleanQuery = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (cleanQuery ? `?${cleanQuery}` : ''));

    try {
        const res = await fetch(sharedUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const { importWorkshopPackage } = await import('../editor/workshop-export.js');
        const { saveWorkshopLevel } = await import('../levels/workshop-store.js');

        const { mapDef } = await importWorkshopPackage(text);
        saveWorkshopLevel(mapDef);
        return true;
    } catch (err) {
        console.warn('[PWA] Shared workshop level import failed:', err);
        return false;
    }
}

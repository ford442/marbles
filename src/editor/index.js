export { MapEditor, bootMapEditor } from './map-editor.js';
export {
    createEmptyMap,
    mapDefToLevel,
    serializeMap,
    serializeMapJson,
    parseMapJson,
    syncGoalsFromZones,
    downloadMapJson,
    saveDraft,
    loadDraft,
    PLAYTEST_LEVEL_ID,
    DRAFT_STORAGE_KEY,
} from './map-document.js';
export { validateMap, validateAgainstSchema } from './map-validator.js';
export { EDITOR_STAMPS, STAMP_BY_ID, createZoneFromStamp } from './stamps.js';

/**
 * @returns {boolean}
 */
export function isEditorMode() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('editor') || params.get('mode') === 'editor';
}

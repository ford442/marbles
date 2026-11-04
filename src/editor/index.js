export { MapEditor, bootMapEditor } from './map-editor.js';
export {
    MapDocument,
    createEmptyMap,
    mapDefToLevel,
    serializeMap,
    serializeMapJson,
    parseMapJson,
    syncGoalsFromZones,
    syncCheckpointsFromZones,
    recountCollectiblesTotal,
    downloadMapJson,
    saveDraft,
    loadDraft,
    PLAYTEST_LEVEL_ID,
    DRAFT_STORAGE_KEY,
} from './map-document.js';
export { validateMap, collectWarnings } from './map-validator.js';
export {
    EDITOR_STAMPS,
    EDITOR_GAMEPLAY_STAMPS,
    EDITOR_PRIMITIVE_STAMPS,
    STAMP_BY_ID,
    createZoneFromStamp,
} from './stamps.js';

export { isEditorMode } from './mode.js';

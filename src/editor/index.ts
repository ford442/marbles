export { MapEditor, bootMapEditor } from './map-editor.ts';
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
} from './map-document.ts';
export { validateMap, collectWarnings } from './map-validator.ts';
export {
    EDITOR_STAMPS,
    EDITOR_GAMEPLAY_STAMPS,
    EDITOR_PRIMITIVE_STAMPS,
    STAMP_BY_ID,
    createZoneFromStamp,
} from './stamps.ts';

export { isEditorMode } from './mode.js';

// @ts-check
/**
 * localStorage-backed "Community Levels" collection: maps imported from a
 * workshop JSON/ZIP package (see src/editor/workshop-export.ts) so they
 * survive reloads and show up on the level-select screen.
 */

/** @typedef {import('../types/map.ts').MapDefinition} MapDefinition */

export const WORKSHOP_STORAGE_KEY = 'marbles3d_workshop_levels';

/**
 * @typedef {object} WorkshopLevelEntry
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} mapJson
 * @property {string} importedAt
 */

/**
 * @returns {WorkshopLevelEntry[]}
 */
export function listWorkshopLevels() {
    try {
        const raw = localStorage.getItem(WORKSHOP_STORAGE_KEY);
        if (!raw) return [];
        /** @type {unknown} */
        const parsed = JSON.parse(raw);
        // Written only by writeWorkshopLevels(), so a stored array is trusted.
        return Array.isArray(parsed) ? /** @type {WorkshopLevelEntry[]} */ (parsed) : [];
    } catch {
        return [];
    }
}

/**
 * @param {WorkshopLevelEntry[]} entries
 */
function writeWorkshopLevels(entries) {
    try {
        localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // private mode / quota exceeded — nothing more we can do client-side
    }
}

/**
 * Save (or overwrite) an imported map as a community level.
 * @param {MapDefinition} mapDef
 * @returns {WorkshopLevelEntry}
 */
export function saveWorkshopLevel(mapDef) {
    const entries = listWorkshopLevels().filter((e) => e.id !== mapDef.id);
    /** @type {WorkshopLevelEntry} */
    const entry = {
        id: mapDef.id,
        name: mapDef.name || mapDef.id,
        description: mapDef.description || '',
        mapJson: JSON.stringify(mapDef),
        importedAt: new Date().toISOString(),
    };
    entries.unshift(entry);
    writeWorkshopLevels(entries);
    return entry;
}

/**
 * @param {string} id
 */
export function deleteWorkshopLevel(id) {
    writeWorkshopLevels(listWorkshopLevels().filter((e) => e.id !== id));
}

/**
 * @param {string} id
 * @returns {MapDefinition | null}
 */
export function getWorkshopLevel(id) {
    const entry = listWorkshopLevels().find((e) => e.id === id);
    // mapJson is a map saveWorkshopLevel() serialized after editor/import validation.
    return entry ? /** @type {MapDefinition} */ (JSON.parse(entry.mapJson)) : null;
}

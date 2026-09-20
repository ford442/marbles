/**
 * localStorage-backed "Community Levels" collection: maps imported from a
 * workshop JSON/ZIP package (see src/editor/workshop-export.js) so they
 * survive reloads and show up on the level-select screen.
 */

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
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
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
 * @param {import('../types/map.ts').MapDefinition} mapDef
 * @returns {WorkshopLevelEntry}
 */
export function saveWorkshopLevel(mapDef) {
    const entries = listWorkshopLevels().filter((e) => e.id !== mapDef.id);
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
 * @returns {import('../types/map.ts').MapDefinition | null}
 */
export function getWorkshopLevel(id) {
    const entry = listWorkshopLevels().find((e) => e.id === id);
    return entry ? JSON.parse(entry.mapJson) : null;
}

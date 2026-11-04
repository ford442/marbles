// @ts-check
/**
 * Marble selection, unlock gating and the per-level spawn roster.
 *
 * Pure helpers over the generated catalog (`src/marbles_data.js`): the picker
 * UI (marble-picker.js) and MarbleRegistry both go through `selectMarble` /
 * `getSelectedMarbleId`, so a locked or premium-not-granted marble can never
 * become the player marble, whatever the UI shows.
 */
import { DEFAULT_MARBLE_ID } from './catalog-format.js';

/** @typedef {import('./catalog-format.js').MarbleInfo & Record<string, unknown>} MarbleInfo */
/** @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void }} KeyValueStorage */

export const SELECTED_MARBLE_STORAGE_KEY = 'marbles3d_selected_marble';

/** Maps may race the player against at most this many rivals (map-schema `rivals`). */
export const MAX_RIVALS = 6;

/**
 * Spawn slots relative to the level spawn: the player at the origin, rivals
 * in a staggered grid beside and behind it (x across, z along the track).
 */
export const SPAWN_SLOTS = Object.freeze([
    { x: 0, y: 0, z: 0 },
    { x: -1.6, y: 0, z: -0.8 },
    { x: 1.6, y: 0, z: -0.8 },
    { x: -3.2, y: 0, z: -1.6 },
    { x: 3.2, y: 0, z: -1.6 },
    { x: -1.6, y: 0, z: -2.8 },
    { x: 1.6, y: 0, z: -2.8 },
]);

/**
 * Selectable for this player? Default marbles always are; campaign and
 * premium marbles only once their id is in `unlockedIds`.
 * @param {Pick<MarbleInfo, 'id' | 'unlock' | 'premium'> | undefined} info
 * @param {readonly string[]} unlockedIds
 */
export function isMarbleUnlocked(info, unlockedIds) {
    if (!info) return false;
    const unlock = info.unlock ?? (info.premium ? 'premium' : 'default');
    if (unlock === 'default' && !info.premium) return true;
    return unlockedIds.includes(info.id);
}

/** @param {KeyValueStorage | undefined | null} storage @param {string} key */
function readStorage(storage, key) {
    try {
        return storage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

/** @returns {KeyValueStorage | null} */
function defaultStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * The persisted selection if it is still valid and unlocked, else the default
 * marble (or the first unlocked one).
 * @param {{ catalog: readonly MarbleInfo[], unlockedIds: readonly string[], storage?: KeyValueStorage | null }} ctx
 * @returns {string}
 */
export function getSelectedMarbleId({ catalog, unlockedIds, storage = defaultStorage() }) {
    const stored = readStorage(storage, SELECTED_MARBLE_STORAGE_KEY);
    const pick = stored ? catalog.find((m) => m.id === stored) : undefined;
    if (pick && isMarbleUnlocked(pick, unlockedIds)) return pick.id;
    const fallback = catalog.find((m) => m.id === DEFAULT_MARBLE_ID)
        ?? catalog.find((m) => isMarbleUnlocked(m, unlockedIds));
    return fallback?.id ?? DEFAULT_MARBLE_ID;
}

/**
 * Select (and persist) the player marble. Refuses unknown and locked ids.
 * @param {string} id
 * @param {{ catalog: readonly MarbleInfo[], unlockedIds: readonly string[], storage?: KeyValueStorage | null }} ctx
 * @returns {{ ok: true, id: string } | { ok: false, reason: 'unknown' | 'locked' }}
 */
export function selectMarble(id, { catalog, unlockedIds, storage = defaultStorage() }) {
    const info = catalog.find((m) => m.id === id);
    if (!info) return { ok: false, reason: 'unknown' };
    if (!isMarbleUnlocked(info, unlockedIds)) return { ok: false, reason: 'locked' };
    try {
        storage?.setItem(SELECTED_MARBLE_STORAGE_KEY, id);
    } catch {
        // Private mode / blocked storage: the selection still applies this session.
    }
    return { ok: true, id };
}

/**
 * Marbles to spawn for a level: the player's marble first (index 0), then
 * the level's rivals — known ids only, no duplicates of the player, at most
 * MAX_RIVALS. Rivals may be marbles the player hasn't unlocked.
 * @param {{ catalog: readonly MarbleInfo[], playerId: string, rivals?: readonly string[] }} args
 * @returns {MarbleInfo[]}
 */
export function resolveSpawnRoster({ catalog, playerId, rivals = [] }) {
    const byId = new Map(catalog.map((m) => [m.id, m]));
    const player = byId.get(playerId) ?? byId.get(DEFAULT_MARBLE_ID) ?? catalog[0];
    if (!player) return [];
    /** @type {MarbleInfo[]} */
    const roster = [player];
    for (const id of rivals) {
        if (roster.length > MAX_RIVALS) break;
        const info = byId.get(id);
        if (info && !roster.includes(info)) roster.push(info);
    }
    return roster;
}

/**
 * Append registry marbles (manifest entries loaded at runtime, e.g. future
 * workshop marbles) that the generated catalog doesn't already contain.
 * Matched by id only: two marbles may never share an id, and a name clash is
 * a catalog error caught by the generator, not a reason to drop one.
 * @param {{ getAllMarbles(): any[], convertMarbleToGameFormat(def: any): MarbleInfo }} registry
 * @param {MarbleInfo[]} catalog mutated in place
 * @returns {number} how many were appended
 */
export function mergeRegistryMarbles(registry, catalog) {
    let added = 0;
    for (const def of registry.getAllMarbles()) {
        if (!def?.id || catalog.some((m) => m.id === def.id)) continue;
        catalog.push(registry.convertMarbleToGameFormat(def));
        added++;
    }
    return added;
}

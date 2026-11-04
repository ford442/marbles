// @ts-check
import { mapToRuntimeLevel } from './map-normalize.js';

/** @typedef {import('../types/map.ts').MapDefinition} MapDefinition */
/** @typedef {import('../types/map.ts').RuntimeLevel} RuntimeLevel */
/** @typedef {{ getAllMaps(): MapDefinition[], convertMapToLevel(map: MapDefinition): RuntimeLevel }} MapCatalogRegistry */

/** @type {Record<string, RuntimeLevel>} */
export let LEVELS = {};

/** Maps loaded exclusively from JSON (manifest-driven). */
export const JSON_LEVEL_IDS = new Set();

/** @returns {boolean} */
export function isDevLevelsEnabled() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('devLevels') || params.get('dev') === '1';
}

/**
 * Build the runtime level catalog from AssetRegistry maps. Dev-only code
 * levels are added separately by `loadDevLevels()` so their zone code stays
 * out of the main chunk.
 * @param {MapCatalogRegistry} registry
 * @returns {Record<string, RuntimeLevel>}
 */
export function initLevelCatalog(registry) {
  LEVELS = {};
  JSON_LEVEL_IDS.clear();

  for (const mapDef of registry.getAllMaps()) {
    LEVELS[mapDef.id] = registry.convertMapToLevel(mapDef);
    JSON_LEVEL_IDS.add(mapDef.id);
  }

  return LEVELS;
}

/**
 * Merge `DEV_LEVELS` (src/levels.ts) into the catalog when `?devLevels=1`.
 * A dynamic import, so normal play never downloads the dev level table or
 * the zone modules it references.
 * @param {{ force?: boolean }} [options] force: load regardless of the URL (tests, harness)
 * @returns {Promise<string[]>} ids that were added
 */
export async function loadDevLevels({ force = false } = {}) {
  if (!force && !isDevLevelsEnabled()) return [];
  const { DEV_LEVELS } = await import('../levels.ts');
  /** @type {string[]} */
  const added = [];
  for (const [id, level] of Object.entries(DEV_LEVELS)) {
    if (!LEVELS[id]) {
      LEVELS[id] = /** @type {RuntimeLevel} */ ({ ...level, source: 'code' });
      added.push(id);
    }
  }
  return added;
}

/**
 * @param {string} levelId
 * @returns {RuntimeLevel | undefined}
 */
export function getLevel(levelId) {
  return LEVELS[levelId];
}

/** @returns {string[]} */
export function getOrderedLevelIds() {
  return Object.keys(LEVELS);
}

/**
 * Register a runtime-only level (editor playtest, imported drafts).
 * @param {MapDefinition} mapDef
 * @returns {string}
 */
export function registerCustomLevel(mapDef) {
  LEVELS[mapDef.id] = mapToRuntimeLevel(mapDef, 'editor');
  return mapDef.id;
}

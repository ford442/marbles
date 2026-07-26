// @ts-check
import { DEV_LEVELS } from '../levels.js';
import { mapDefToLevel } from '../editor/map-document.js';

/** @typedef {import('../types/map.js').MapDefinition} MapDefinition */
/** @typedef {import('../types/map.js').RuntimeLevel} RuntimeLevel */
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
 * Build the runtime level catalog from AssetRegistry maps plus optional dev-only levels.
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

  if (isDevLevelsEnabled()) {
    for (const [id, level] of Object.entries(DEV_LEVELS)) {
      if (!LEVELS[id]) {
        LEVELS[id] = /** @type {RuntimeLevel} */ ({ ...level, source: 'code' });
      }
    }
  }

  return LEVELS;
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
  LEVELS[mapDef.id] = /** @type {RuntimeLevel} */ (mapDefToLevel(mapDef));
  return mapDef.id;
}

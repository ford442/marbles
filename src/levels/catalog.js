import { DEV_LEVELS } from '../levels.js';
import { mapDefToLevel } from '../editor/map-document.js';

/** @type {Record<string, object>} */
export let LEVELS = {};

/** Maps loaded exclusively from JSON (manifest-driven). */
export const JSON_LEVEL_IDS = new Set();

export function isDevLevelsEnabled() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('devLevels') || params.get('dev') === '1';
}

/**
 * Build the runtime level catalog from AssetRegistry maps plus optional dev-only levels.
 * @param {import('../assets/AssetRegistry.js').AssetRegistry} registry
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
        LEVELS[id] = { ...level, source: 'code' };
      }
    }
  }

  return LEVELS;
}

export function getLevel(levelId) {
  return LEVELS[levelId];
}

export function getOrderedLevelIds() {
  return Object.keys(LEVELS);
}

/**
 * Register a runtime-only level (editor playtest, imported drafts).
 * @param {import('../types/map.js').MapDefinition} mapDef
 */
export function registerCustomLevel(mapDef) {
  LEVELS[mapDef.id] = mapDefToLevel(mapDef);
  return mapDef.id;
}

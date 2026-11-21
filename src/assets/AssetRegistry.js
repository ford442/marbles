// @ts-check
/**
 * Central loader for JSON game assets declared in assets/manifest.json.
 */

import { mapToRuntimeLevel, structuralErrors } from '../levels/map-normalize.js';
import { marbleDefToGameInfo } from '../marbles/catalog-format.js';

/** @typedef {import('../types/map.ts').MapDefinition} MapDefinition */
/** @typedef {import('../types/map.ts').RuntimeLevel} RuntimeLevel */
/** @typedef {import('../types/generated/marble-schema.ts').MarbleSchema} MarbleDefinition */
/** @typedef {import('../types/generated/sound-schema.ts').SoundSchema} SoundDefinition */

/**
 * One `assets/manifest.json` section entry (`maps.tutorial`, ...). Only `file`
 * is read by the loader; the rest is display metadata.
 * @typedef {{ file?: string, name?: string, difficulty?: string }} ManifestEntry
 */

/**
 * `assets/manifest.json` (the repo's own file, checked by
 * scripts/validate-assets.cjs; the loader still guards each section).
 * @typedef {{
 *   version?: string,
 *   description?: string,
 *   maps?: Record<string, ManifestEntry>,
 *   marbles?: Record<string, ManifestEntry>,
 *   sounds?: Record<string, ManifestEntry>,
 * }} AssetManifest
 */

/** @typedef {{ _manifestMeta: ManifestEntry }} ManifestMeta */
/** A loaded map file (passed the required-field and structural checks). @typedef {MapDefinition & ManifestMeta} MapAsset */
/** A loaded marble file (passed the required-field check). @typedef {MarbleDefinition & ManifestMeta} MarbleAsset */
/** A loaded sound file (passed the required-field check). @typedef {SoundDefinition & ManifestMeta} SoundAsset */

const REQUIRED_MAP_FIELDS = ['id', 'name', 'version', 'zones', 'spawn'];
const REQUIRED_MARBLE_FIELDS = ['id', 'name', 'version', 'appearance', 'physics'];
const REQUIRED_SOUND_FIELDS = ['id', 'name', 'version', 'files'];

/**
 * @param {unknown} filePath path relative to assets/ (or an absolute http(s) URL)
 * @returns {string} '' for a missing / non-string path
 */
export function resolveAssetUrl(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const normalizedBase = base ? (base.endsWith('/') ? base : `${base}/`) : '';
  if (normalizedBase && filePath.startsWith(normalizedBase)) return filePath;
  const clean = filePath.replace(/^\.?\/?(assets\/)?/, '');
  return `${normalizedBase}assets/${clean}`;
}

export class AssetRegistry {
  constructor() {
    /** @type {AssetManifest | null} */
    this.manifest = null;
    /** @type {Map<string, MapAsset>} */
    this.maps = new Map();
    /** @type {Map<string, MarbleAsset>} */
    this.marbles = new Map();
    /** @type {Map<string, SoundAsset>} */
    this.sounds = new Map();
    this.loaded = false;
    /** @type {string[]} */
    this.loadErrors = [];
  }

  async loadAll() {
    console.log('[AssetRegistry] Loading manifest...');
    this.loadErrors = [];

    const manifestUrl = resolveAssetUrl('manifest.json');
    const manifest = await this.fetchJson(manifestUrl);
    if (!manifest) {
      throw new Error(`[AssetRegistry] Failed to load game assets. Check ${manifestUrl}.`);
    }

    this.manifest = /** @type {AssetManifest} */ (manifest);

    await Promise.all([
      this.loadManifestSection(this.manifest.maps, 'map', this.maps, REQUIRED_MAP_FIELDS),
      this.loadManifestSection(this.manifest.marbles, 'marble', this.marbles, REQUIRED_MARBLE_FIELDS),
      this.loadManifestSection(this.manifest.sounds, 'sound', this.sounds, REQUIRED_SOUND_FIELDS),
    ]);

    this.loaded = true;
    console.log('[AssetRegistry] Assets loaded');
    console.log(`  - Maps: ${this.maps.size}`);
    console.log(`  - Marbles: ${this.marbles.size}`);
    console.log(`  - Sounds: ${this.sounds.size}`);

    if (this.loadErrors.length > 0) {
      console.warn('[AssetRegistry] Load warnings:', this.loadErrors);
    }
  }

  /**
   * Fetch every file listed in one manifest section into `store`. A file that
   * fails to fetch or lacks a required field is skipped and recorded in
   * `loadErrors`; maps must also pass `structuralErrors`.
   * @template {ManifestMeta} T
   * @param {Record<string, ManifestEntry> | undefined} section
   * @param {'map' | 'marble' | 'sound'} label
   * @param {Map<string, T>} store
   * @param {readonly string[]} requiredFields
   * @returns {Promise<void>}
   */
  async loadManifestSection(section, label, store, requiredFields) {
    if (!section || typeof section !== 'object') return;

    for (const [entryId, entry] of Object.entries(section)) {
      const filePath = entry?.file;
      if (!filePath) {
        this.loadErrors.push(`${label} "${entryId}": missing file path in manifest`);
        continue;
      }

      const url = filePath.startsWith('assets/') ? filePath : `assets/${filePath}`;
      const asset = /** @type {Record<string, unknown> | null} */ (await this.fetchJson(url));
      if (!asset) {
        this.loadErrors.push(`${label} "${entryId}": failed to fetch ${url}`);
        continue;
      }

      if (asset.id && asset.id !== entryId) {
        console.warn(
          `[AssetRegistry] ${label} manifest id "${entryId}" differs from asset id "${asset.id}"`
        );
      }

      if (!this.validateRequired(asset, requiredFields, label, entryId)) {
        continue;
      }

      if (label === 'map') {
        const problems = structuralErrors(asset);
        if (problems.length > 0) {
          this.loadErrors.push(`map "${entryId}": ${problems.join('; ')}`);
          continue;
        }
      }

      const id = typeof asset.id === 'string' && asset.id ? asset.id : entryId;
      // Passed the required-field (and, for maps, structural) checks above.
      store.set(id, /** @type {T} */ ({ ...asset, _manifestMeta: entry }));
      console.log(`[AssetRegistry] Loaded ${label}: ${id}`);
    }
  }

  /**
   * @param {object} asset
   * @param {readonly string[]} requiredFields
   * @param {string} label
   * @param {string} entryId
   * @returns {boolean}
   */
  validateRequired(asset, requiredFields, label, entryId) {
    for (const field of requiredFields) {
      if (!(field in asset)) {
        this.loadErrors.push(`${label} "${entryId}": missing required field "${field}"`);
        return false;
      }
    }
    return true;
  }

  /**
   * @param {string} url
   * @returns {Promise<unknown>} parsed JSON, or null on HTTP / network / parse failure
   */
  async fetchJson(url) {
    const resolvedUrl = resolveAssetUrl(url);
    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        console.warn(`[AssetRegistry] HTTP ${response.status} for ${resolvedUrl}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[AssetRegistry] Failed to fetch ${resolvedUrl}:`, error);
      return null;
    }
  }

  /** @param {string} id */
  getMap(id) {
    return this.maps.get(id);
  }

  getAllMaps() {
    if (!this.manifest?.maps) {
      return Array.from(this.maps.values());
    }

    /** @type {MapAsset[]} */
    const ordered = [];
    for (const id of Object.keys(this.manifest.maps)) {
      const map = this.maps.get(id);
      if (map) ordered.push(map);
    }
    return ordered;
  }

  /** @param {string} id */
  getMarble(id) {
    return this.marbles.get(id);
  }

  getAllMarbles() {
    return Array.from(this.marbles.values());
  }

  /** @param {string} id */
  getSound(id) {
    return this.sounds.get(id);
  }

  getAllSounds() {
    return Array.from(this.sounds.values());
  }

  /**
   * @param {MapDefinition} mapDef
   * @returns {RuntimeLevel}
   */
  convertMapToLevel(mapDef) {
    return mapToRuntimeLevel(mapDef, 'json');
  }

  /**
   * Same conversion the build-time generator uses (src/marbles/catalog-format.js).
   * @param {MarbleDefinition} marbleDef
   */
  convertMarbleToGameFormat(marbleDef) {
    return { ...marbleDefToGameInfo(marbleDef), source: 'json' };
  }
}

export const assetRegistry = new AssetRegistry();
export default assetRegistry;

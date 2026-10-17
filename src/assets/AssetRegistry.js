/**
 * Central loader for JSON game assets declared in assets/manifest.json.
 */

import { mapToRuntimeLevel, structuralErrors } from '../levels/map-normalize.js';
import { marbleDefToGameInfo } from '../marbles/catalog-format.js';

const REQUIRED_MAP_FIELDS = ['id', 'name', 'version', 'zones', 'spawn'];
const REQUIRED_MARBLE_FIELDS = ['id', 'name', 'version', 'appearance', 'physics'];
const REQUIRED_SOUND_FIELDS = ['id', 'name', 'version', 'files'];

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
    this.manifest = null;
    this.maps = new Map();
    this.marbles = new Map();
    this.sounds = new Map();
    this.loaded = false;
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

    this.manifest = manifest;

    await Promise.all([
      this.loadManifestSection(manifest.maps, 'map', this.maps, REQUIRED_MAP_FIELDS),
      this.loadManifestSection(manifest.marbles, 'marble', this.marbles, REQUIRED_MARBLE_FIELDS),
      this.loadManifestSection(manifest.sounds, 'sound', this.sounds, REQUIRED_SOUND_FIELDS),
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

  async loadManifestSection(section, label, store, requiredFields) {
    if (!section || typeof section !== 'object') return;

    for (const [entryId, entry] of Object.entries(section)) {
      const filePath = entry?.file;
      if (!filePath) {
        this.loadErrors.push(`${label} "${entryId}": missing file path in manifest`);
        continue;
      }

      const url = filePath.startsWith('assets/') ? filePath : `assets/${filePath}`;
      const asset = await this.fetchJson(url);
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

      const id = asset.id || entryId;
      store.set(id, { ...asset, _manifestMeta: entry });
      console.log(`[AssetRegistry] Loaded ${label}: ${id}`);
    }
  }

  validateRequired(asset, requiredFields, label, entryId) {
    for (const field of requiredFields) {
      if (!(field in asset)) {
        this.loadErrors.push(`${label} "${entryId}": missing required field "${field}"`);
        return false;
      }
    }
    return true;
  }

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

  getMap(id) {
    return this.maps.get(id);
  }

  getAllMaps() {
    if (!this.manifest?.maps) {
      return Array.from(this.maps.values());
    }

    const ordered = [];
    for (const id of Object.keys(this.manifest.maps)) {
      const map = this.maps.get(id);
      if (map) ordered.push(map);
    }
    return ordered;
  }

  getMarble(id) {
    return this.marbles.get(id);
  }

  getAllMarbles() {
    return Array.from(this.marbles.values());
  }

  getSound(id) {
    return this.sounds.get(id);
  }

  getAllSounds() {
    return Array.from(this.sounds.values());
  }

  convertMapToLevel(mapDef) {
    return mapToRuntimeLevel(mapDef, 'json');
  }

  /** Same conversion the build-time generator uses (src/marbles/catalog-format.js). */
  convertMarbleToGameFormat(marbleDef) {
    return { ...marbleDefToGameInfo(marbleDef), source: 'json' };
  }
}

export const assetRegistry = new AssetRegistry();
export default assetRegistry;

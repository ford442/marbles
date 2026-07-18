/**
 * Central loader for JSON game assets declared in assets/manifest.json.
 */

const REQUIRED_MAP_FIELDS = ['id', 'name', 'version', 'zones', 'spawn', 'goals'];
const REQUIRED_MARBLE_FIELDS = ['id', 'name', 'version', 'appearance', 'physics'];
const REQUIRED_SOUND_FIELDS = ['id', 'name', 'version', 'files'];

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

    const manifest = await this.fetchJson('assets/manifest.json');
    if (!manifest) {
      throw new Error('[AssetRegistry] Failed to load assets/manifest.json');
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
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[AssetRegistry] HTTP ${response.status} for ${url}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[AssetRegistry] Failed to fetch ${url}:`, error);
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
    return {
      name: mapDef.name,
      description: mapDef.description || '',
      difficulty: mapDef.difficulty,
      zones: mapDef.zones,
      spawn: mapDef.spawn,
      goals: mapDef.goals,
      checkpoints: mapDef.checkpoints,
      camera: mapDef.camera || { mode: 'orbit', angle: 0, height: 10, radius: 25 },
      nightMode: mapDef.nightMode,
      backgroundColor: mapDef.backgroundColor,
      environment: mapDef.environment,
      colorGrade: mapDef.colorGrade,
      abilities: mapDef.abilities,
      medals: mapDef.medals,
      collectiblesTotal: mapDef.collectiblesTotal,
      chapter: mapDef.chapter,
      behaviors: mapDef.behaviors,
      source: 'json',
    };
  }

  convertMarbleToGameFormat(marbleDef) {
    const appearance = marbleDef.appearance || {};
    const physics = marbleDef.physics || {};
    const color = appearance.color || { r: 0.5, g: 0.5, b: 0.5 };
    const emissive = appearance.emissive;

    const info = {
      id: marbleDef.id,
      name: marbleDef.name,
      color: [color.r, color.g, color.b],
      offset: { x: 0, y: 0, z: 0 },
      radius: physics.radius ?? 0.5,
      friction: physics.friction,
      restitution: physics.restitution,
      density: physics.density,
      roughness: appearance.roughness,
      metallic: appearance.metallic,
      linearDamping: physics.linearDamping,
      angularDamping: physics.angularDamping,
      gravityScale: physics.gravityScale,
      clearCoat: appearance.clearCoat,
      clearCoatRoughness: appearance.clearCoatRoughness,
      source: 'json',
    };

    if (emissive) {
      info.emissive = true;
      info.lightColor = [emissive.r, emissive.g, emissive.b];
      info.lightIntensity = (emissive.intensity ?? 1) * 10000;
    }

    if (appearance.materialType) {
      info.materialType = appearance.materialType;
    }

    return info;
  }
}

export const assetRegistry = new AssetRegistry();
export default assetRegistry;

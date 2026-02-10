/**
 * Asset Registry - Manages loading and registration of game assets
 * 
 * This module provides a centralized system for:
 * - Loading map definitions from assets/maps/
 * - Loading marble definitions from assets/marbles/
 * - Loading sound definitions from assets/sounds/
 * - Validating assets against schemas
 */

class AssetRegistry {
  constructor() {
    this.maps = new Map();
    this.marbles = new Map();
    this.sounds = new Map();
    this.materials = new Map();
    this.loaded = false;
  }

  /**
   * Load all assets from the assets directory
   */
  async loadAll() {
    console.log('[AssetRegistry] Loading all assets...');
    
    await Promise.all([
      this.loadMaps(),
      this.loadMarbles(),
      this.loadSounds()
    ]);
    
    this.loaded = true;
    console.log('[AssetRegistry] All assets loaded');
    console.log(`  - Maps: ${this.maps.size}`);
    console.log(`  - Marbles: ${this.marbles.size}`);
    console.log(`  - Sounds: ${this.sounds.size}`);
  }

  /**
   * Load all map definitions from assets/maps/
   */
  async loadMaps() {
    try {
      // In a real implementation, this would scan the directory
      // For now, we'll load known maps
      const mapFiles = [
        'tutorial.json',
        'volcano_run.json'
      ];

      for (const file of mapFiles) {
        try {
          const response = await fetch(`assets/maps/${file}`);
          if (response.ok) {
            const map = await response.json();
            if (this.validateMap(map)) {
              this.maps.set(map.id, map);
              console.log(`[AssetRegistry] Loaded map: ${map.id}`);
            }
          }
        } catch (e) {
          console.warn(`[AssetRegistry] Failed to load map ${file}:`, e);
        }
      }
    } catch (e) {
      console.error('[AssetRegistry] Error loading maps:', e);
    }
  }

  /**
   * Load all marble definitions from assets/marbles/
   */
  async loadMarbles() {
    try {
      const marbleFiles = [
        'classic_red.json',
        'volcanic_magma.json',
        'shadow_ninja.json',
        'cosmic_nebula.json'
      ];

      for (const file of marbleFiles) {
        try {
          const response = await fetch(`assets/marbles/${file}`);
          if (response.ok) {
            const marble = await response.json();
            if (this.validateMarble(marble)) {
              this.marbles.set(marble.id, marble);
              console.log(`[AssetRegistry] Loaded marble: ${marble.id}`);
            }
          }
        } catch (e) {
          console.warn(`[AssetRegistry] Failed to load marble ${file}:`, e);
        }
      }
    } catch (e) {
      console.error('[AssetRegistry] Error loading marbles:', e);
    }
  }

  /**
   * Load all sound definitions from assets/sounds/
   */
  async loadSounds() {
    try {
      const soundFiles = [
        'collision_metal.json'
      ];

      for (const file of soundFiles) {
        try {
          const response = await fetch(`assets/sounds/${file}`);
          if (response.ok) {
            const sound = await response.json();
            if (this.validateSound(sound)) {
              this.sounds.set(sound.id, sound);
              console.log(`[AssetRegistry] Loaded sound: ${sound.id}`);
            }
          }
        } catch (e) {
          console.warn(`[AssetRegistry] Failed to load sound ${file}:`, e);
        }
      }
    } catch (e) {
      console.error('[AssetRegistry] Error loading sounds:', e);
    }
  }

  /**
   * Validate a map definition
   */
  validateMap(map) {
    const required = ['id', 'name', 'version', 'zones', 'spawn', 'goals'];
    for (const field of required) {
      if (!(field in map)) {
        console.warn(`[AssetRegistry] Map missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Validate a marble definition
   */
  validateMarble(marble) {
    const required = ['id', 'name', 'version', 'appearance', 'physics'];
    for (const field of required) {
      if (!(field in marble)) {
        console.warn(`[AssetRegistry] Marble missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Validate a sound definition
   */
  validateSound(sound) {
    const required = ['id', 'name', 'version', 'files'];
    for (const field of required) {
      if (!(field in sound)) {
        console.warn(`[AssetRegistry] Sound missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Get a map by ID
   */
  getMap(id) {
    return this.maps.get(id);
  }

  /**
   * Get all maps
   */
  getAllMaps() {
    return Array.from(this.maps.values());
  }

  /**
   * Get a marble by ID
   */
  getMarble(id) {
    return this.marbles.get(id);
  }

  /**
   * Get all marbles
   */
  getAllMarbles() {
    return Array.from(this.marbles.values());
  }

  /**
   * Get a sound by ID
   */
  getSound(id) {
    return this.sounds.get(id);
  }

  /**
   * Get all sounds
   */
  getAllSounds() {
    return Array.from(this.sounds.values());
  }

  /**
   * Convert a map definition to the game's level format
   */
  convertMapToLevel(mapDef) {
    return {
      name: mapDef.name,
      description: mapDef.description,
      zones: mapDef.zones,
      spawn: mapDef.spawn,
      goals: mapDef.goals,
      camera: mapDef.camera || { mode: 'orbit', angle: 0, height: 10, radius: 25 }
    };
  }

  /**
   * Convert a marble definition to the game's marble format
   */
  convertMarbleToGameFormat(marbleDef) {
    return {
      color: [
        marbleDef.appearance.color.r,
        marbleDef.appearance.color.g,
        marbleDef.appearance.color.b
      ],
      radius: marbleDef.physics.radius,
      friction: marbleDef.physics.friction,
      restitution: marbleDef.physics.restitution,
      density: marbleDef.physics.density,
      roughness: marbleDef.appearance.roughness,
      metallic: marbleDef.appearance.metallic
    };
  }
}

// Singleton instance
export const assetRegistry = new AssetRegistry();
export default assetRegistry;

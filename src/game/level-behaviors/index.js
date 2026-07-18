/**
 * Per-level behavior modules referenced by map JSON `behaviors: ["id"]`.
 */
import { BEHAVIOR_REGISTRY } from './registry.js';
import './storm-peak-ambient.js';

/** @type {string[]} */
let activeBehaviorIds = [];

/**
 * @param {object} game
 * @param {string[]} [behaviorIds]
 * @param {{ level?: object, levelId?: string }} [meta]
 */
export function loadLevelBehaviors(game, behaviorIds = [], meta = {}) {
  unloadLevelBehaviors(game);

  if (!behaviorIds?.length) return;

  const ctx = {
    level: meta.level || {},
    levelId: meta.levelId || game.currentLevel || '',
  };

  activeBehaviorIds = [...behaviorIds];

  for (const id of activeBehaviorIds) {
    const behavior = BEHAVIOR_REGISTRY.get(id);
    if (!behavior) {
      console.warn(`[BEHAVIOR] Unknown behavior id: ${id}`);
      continue;
    }
    try {
      behavior.onLoad?.(game, ctx);
    } catch (err) {
      console.warn(`[BEHAVIOR] onLoad failed for ${id}:`, err);
    }
  }
}

/**
 * @param {object} game
 * @param {number} dt
 */
export function tickLevelBehaviors(game, dt) {
  for (const id of activeBehaviorIds) {
    const behavior = BEHAVIOR_REGISTRY.get(id);
    if (!behavior?.onTick) continue;
    try {
      behavior.onTick(game, dt);
    } catch (err) {
      console.warn(`[BEHAVIOR] onTick failed for ${id}:`, err);
    }
  }
}

/** @param {object} game */
export function unloadLevelBehaviors(game) {
  for (const id of activeBehaviorIds) {
    const behavior = BEHAVIOR_REGISTRY.get(id);
    if (!behavior?.onUnload) continue;
    try {
      behavior.onUnload(game);
    } catch (err) {
      console.warn(`[BEHAVIOR] onUnload failed for ${id}:`, err);
    }
  }
  activeBehaviorIds = [];
}

export function getActiveBehaviorIds() {
  return [...activeBehaviorIds];
}

export { registerBehavior } from './registry.js';

/**
 * Level behavior registry (no side-effect imports).
 */

/** @typedef {{ onLoad?: (game: object, ctx: object) => void, onTick?: (game: object, dt: number) => void, onUnload?: (game: object) => void }} LevelBehavior */

/** @type {Map<string, LevelBehavior>} */
export const BEHAVIOR_REGISTRY = new Map();

/**
 * @param {string} id
 * @param {LevelBehavior} behavior
 */
export function registerBehavior(id, behavior) {
  BEHAVIOR_REGISTRY.set(id, behavior);
}

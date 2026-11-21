// @ts-check
/**
 * Level behavior registry (no side-effect imports).
 */

/**
 * What a level behavior may read on the game: the ambient-effect services.
 * @typedef {Pick<import('../../types/engine-context.ts').EngineContext, 'particleSystem' | 'volumetricLights'>
 *   & Pick<import('../../types/game-state.ts').LevelState, 'currentLevel'>} LevelBehaviorHost
 */

/**
 * @typedef {object} LevelBehaviorContext
 * @property {Partial<import('../../types/map.ts').RuntimeLevel>} level the runtime level (`{}` when none was passed)
 * @property {string} levelId
 */

/**
 * @typedef {object} LevelBehavior
 * @property {(game: LevelBehaviorHost, ctx: LevelBehaviorContext) => void} [onLoad]
 * @property {(game: LevelBehaviorHost, dt: number) => void} [onTick]
 * @property {(game: LevelBehaviorHost) => void} [onUnload]
 */

/** @type {Map<string, LevelBehavior>} */
export const BEHAVIOR_REGISTRY = new Map();

/**
 * @param {string} id
 * @param {LevelBehavior} behavior
 */
export function registerBehavior(id, behavior) {
  BEHAVIOR_REGISTRY.set(id, behavior);
}

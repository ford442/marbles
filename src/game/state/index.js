import { createPhysicsState } from './physics-state.js';
import { createAbilityState } from './ability-state.js';
import { createLevelState } from './level-state.js';
import { createCameraState } from './camera-state.js';
import { createInputState } from './input-state.js';
import { createHudState } from './hud-state.js';
import { createRenderState } from './render-state.js';

/**
 * @param {{ canvas?: HTMLCanvasElement | null, doc?: Document }} [options]
 */
export function createGameState(options = {}) {
    const doc = options.doc ?? (typeof document !== 'undefined' ? document : null);

    return {
        canvas: options.canvas ?? doc?.getElementById('canvas') ?? null,
        physics: createPhysicsState(),
        abilities: createAbilityState(doc),
        level: createLevelState(),
        camera: createCameraState(),
        input: createInputState(),
        hud: createHudState(doc),
        render: createRenderState(),
    };
}

/**
 * Attach grouped state to MarblesGame and mirror fields onto `this.*` for mixin compatibility.
 * @param {object} game
 * @param {ReturnType<typeof createGameState>} state
 */
export function bindGameState(game, state) {
    game.state = state;
    game.physics = state.physics;
    game.abilities = state.abilities;
    game.level = state.level;
    game.camera = state.camera;
    game.input = state.input;
    game.hud = state.hud;
    game.render = state.render;

    game.canvas = state.canvas;
    Object.assign(game, state.physics);
    Object.assign(game, state.abilities);
    Object.assign(game, state.level);
    Object.assign(game, state.camera);
    Object.assign(game, state.input);
    Object.assign(game, state.hud);
    Object.assign(game, state.render);
}

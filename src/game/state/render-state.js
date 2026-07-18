// @ts-check
/** Filament / engine handles (populated during init). */

/** @returns {import('../../types/game-state.js').RenderState} */
export function createRenderState() {
    return {
        Filament: null,
        material: null,
        cubeMesh: null,
        cueInst: null,
    };
}

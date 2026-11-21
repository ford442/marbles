// @ts-check
/**
 * Held-key movement impulse per 60 Hz step, by level `movementModel`.
 *
 *  1 (default, legacy): a flat impulse, so acceleration ∝ 1/mass — light
 *    marbles accelerate much harder than heavy ones.
 *  2: the impulse is scaled by mass / REFERENCE_MASS, giving every marble the
 *    reference marble's acceleration. For the reference marble (classic_red,
 *    what recorded `solution`s replay with) models 1 and 2 are identical, so
 *    opting a map into model 2 never invalidates its solution.
 *
 * Shared by game-loop/frame-input.ts and the headless harness.
 */

/** Legacy impulse per 1/60 s step for a held movement key. */
export const BASE_MOVE_IMPULSE = 0.5;

/** Mass of the reference marble (radius 0.5, density 1.5): ρ·4/3·π·r³. */
export const REFERENCE_MASS = 1.5 * (4 / 3) * Math.PI * 0.5 ** 3;

/**
 * @param {number | undefined} movementModel level.movementModel
 * @param {number} mass the marble body's mass
 * @returns {number} impulse magnitude per 1/60 s step
 */
export function moveImpulsePerStep(movementModel, mass) {
    if (movementModel === 2 && Number.isFinite(mass) && mass > 0) {
        return BASE_MOVE_IMPULSE * (mass / REFERENCE_MASS);
    }
    return BASE_MOVE_IMPULSE;
}

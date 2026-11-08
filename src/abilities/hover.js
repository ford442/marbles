// @ts-check
/**
 * Hover (registry `hover`, held on H): `press` / `release` toggle the hold;
 * `tick` runs once per **fixed physics step** (`AbilitySystem.tickFixedStep`,
 * driven from the same `FixedStepClock` as `PhysicsWorld.step` and the worker),
 * so energy, gravity scale and lift are identical at any display refresh rate
 * and on both physics backends.
 *
 * Forces are accelerations (m/s²) applied with `applyAcceleration`, i.e.
 * `Δv = a·dt` regardless of marble mass. Nothing here reads a velocity every
 * tick, because the worker proxy only sees the last published snapshot, one
 * step stale. The single `linvel()` read is the one-off fall arrest when the
 * hover engages.
 *
 * The HUD bar is the registry `hudSlot` (`mode: 'energy'` on `hoverEnergy`),
 * painted by `AbilitySystem.tickHudBars` through `HudController`.
 */
import { audio } from '../audio.js';
import { applyAcceleration, applyVelocityChange } from '../game/systems/body-impulse.ts';

/** Fraction of the marble's gravity that remains while hovering. */
export const HOVER_GRAVITY_FACTOR = 0.1;
/** Upward acceleration (m/s²) on top of the reduced gravity: a slow rise. */
export const HOVER_LIFT_ACCEL = 5.0;
/** Energy spent per second of hovering (of `maxHoverEnergy`; 100 → ~2 s). */
export const HOVER_DRAIN_PER_SEC = 50;
/** Energy regained per second while not hovering (empty → full in ~3 s). */
export const HOVER_REGEN_PER_SEC = 100 / 3;
/** Least energy that can start a hover (so a sliver of charge can't be re-spammed). */
export const HOVER_MIN_START_ENERGY = 25;

/**
 * Game fields hover reads and writes. Deliberately no index signature: a field
 * missing here is a type error, not a silent `undefined`.
 * @typedef {object} HoverHost
 * @property {import('../types/mixin-host.ts').MixinMarble | null} playerMarble
 * @property {boolean} hoverActive - held and engaged
 * @property {number} hoverEnergy - 0..`maxHoverEnergy`; also read by the HUD icon
 * @property {number} maxHoverEnergy
 * @property {number | null} hoverSavedGravity - gravity scale to restore; non-null once engaged
 * @property {{ markAbilityUsed(id: string): void } | null} [hudManager]
 * @property {unknown} [effectPool]
 * @property {(pos: import('../types/geometry.ts').Vec3, linvel: import('../types/geometry.ts').Vec3) => void} [spawnJetpackExhaust]
 */

/**
 * Registry `press`: start a hold if there is a marble and enough energy. The
 * gravity change and fall arrest happen on the next fixed step (`tickHover`).
 * @param {HoverHost} game
 */
export function pressHover(game) {
    if (!game.playerMarble || game.hoverActive) return;
    if (!(game.hoverEnergy >= HOVER_MIN_START_ENERGY)) return;
    game.hoverActive = true;
    game.hudManager?.markAbilityUsed('hover');
}

/**
 * Registry `release` (and energy exhaustion, respawn): drop the hold and
 * restore the gravity scale that hovering replaced.
 * @param {HoverHost} game
 */
export function releaseHover(game) {
    game.hoverActive = false;
    const saved = game.hoverSavedGravity;
    game.hoverSavedGravity = null;
    if (saved !== null && game.playerMarble) {
        game.playerMarble.rigidBody.setGravityScale(saved, true);
    }
}

/**
 * Registry `tick`: one fixed physics step of `dt` seconds.
 * @param {HoverHost} game
 * @param {number} dt - simulated seconds (`FixedStepClock.step`)
 */
export function tickHover(game, dt) {
    if (!(dt > 0)) return;
    const marble = game.playerMarble;

    if (!game.hoverActive || !marble) {
        // A held hover whose marble vanished (level clear) is just over.
        if (game.hoverActive) releaseHover(game);
        game.hoverEnergy = Math.min(game.maxHoverEnergy, game.hoverEnergy + HOVER_REGEN_PER_SEC * dt);
        return;
    }

    const rb = marble.rigidBody;

    if (game.hoverSavedGravity === null) {
        // Engage: reduce gravity (sign kept, so flipped gravity hovers too) and
        // stop any fall once, so the float starts from rest rather than dropping.
        const scale = rb.gravityScale();
        game.hoverSavedGravity = scale;
        rb.setGravityScale(scale * HOVER_GRAVITY_FACTOR, true);
        const vy = rb.linvel().y;
        if ((scale >= 0 && vy < 0) || (scale < 0 && vy > 0)) {
            applyVelocityChange(rb, { x: 0, y: -vy, z: 0 });
        }
        audio.playBoost?.();
    }

    game.hoverEnergy = Math.max(0, game.hoverEnergy - HOVER_DRAIN_PER_SEC * dt);
    if (game.hoverEnergy <= 0) {
        releaseHover(game);
        return;
    }

    const up = rb.gravityScale() < 0 ? -1 : 1;
    applyAcceleration(rb, { x: 0, y: HOVER_LIFT_ACCEL * up, z: 0 }, dt);

    // Visual only; one puff per fixed step is ~60/s at any frame rate.
    if (game.effectPool && game.spawnJetpackExhaust) game.spawnJetpackExhaust(rb.translation(), rb.linvel());
}

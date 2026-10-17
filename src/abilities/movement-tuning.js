// @ts-check
/**
 * Jump-family tuning, expressed as velocity changes (m/s) so every marble
 * jumps the same height regardless of mass (marble masses span ~0.05 to
 * ~140 000). Applied through `applyVelocityChange` in body-impulse.ts.
 */

/** Ground jump Δv when released uncharged. */
export const JUMP_DV_MIN = 4.0;
/** Ground jump Δv at full charge. */
export const JUMP_DV_MAX = 10.0;
/** Mid-air double jump Δv (added after cancelling any fall speed). */
export const DOUBLE_JUMP_DV = 6.0;
/** Wall launch: up along gravity, out along the wall normal, forward along aim. */
export const WALL_LAUNCH_DV = { up: 7.0, push: 6.0, forward: 4.0 };

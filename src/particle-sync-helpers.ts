/**
 * Per-frame cadence helpers for pooled visual particles (`game.visualParticles`).
 *
 * The particle fields read here are all optional: visual particles are spawned
 * from loosely-shaped configs, and a missing field keeps the historical JS
 * result (e.g. a missing colour channel sums to NaN, so the update is not skipped).
 */

/** Minimum RGB channel sum before skipping color writes on fading particles. */
export const PARTICLE_COLOR_FADE_THRESHOLD = 0.08;

/** The visual-particle fields the cadence helpers read. */
export interface ParticleCadenceFields {
    /** Lifetime in ms. */
    duration?: number;
    pos?: { x: number; y: number; z: number };
    /** Last RGB written by `setColor3IfChanged` (`game-loop/helpers.ts`). */
    _lastBaseColor?: readonly number[] | null;
    _emissiveOnly?: boolean;
}

/**
 * Distance-tiered and age-based particle update cadence.
 * Near particles update every frame; far / nearly-expired skip frames.
 */
export function shouldUpdateParticle(
    p: ParticleCadenceFields,
    timeAlive: number,
    distanceSq: number,
    frameIndex: number,
): boolean {
    const duration = p.duration;
    const progress = duration !== undefined && duration > 0 ? timeAlive / duration : 1;
    if (progress >= 0.88) return frameIndex % 3 === 0;

    if (distanceSq > 70 * 70) return frameIndex % 3 === 0;
    if (distanceSq > 40 * 40) return frameIndex % 2 === 0;
    return true;
}

/** Squared distance from the particle to the camera eye; 0 when either is unknown. */
export function particleDistanceSq(
    p: ParticleCadenceFields | null | undefined,
    eye: readonly number[] | null | undefined,
): number {
    if (!p?.pos || !eye) return 0;
    // A short `eye` yields NaN, as the untyped version did.
    const dx = p.pos.x - (eye[0] ?? NaN);
    const dy = p.pos.y - (eye[1] ?? NaN);
    const dz = p.pos.z - (eye[2] ?? NaN);
    return dx * dx + dy * dy + dz * dz;
}

export function shouldSkipParticleColorUpdate(
    p: ParticleCadenceFields | null | undefined,
    timeAlive: number,
): boolean {
    if (!p?.duration) return false;
    const progress = timeAlive / p.duration;
    if (progress >= 0.92) return true;
    const last = p._lastBaseColor;
    if (last && (last[0] ?? NaN) + (last[1] ?? NaN) + (last[2] ?? NaN) < PARTICLE_COLOR_FADE_THRESHOLD) return true;
    return false;
}

/** Distant particles use emissive-only representation (no paired lights). */
export function useEmissiveOnlyParticle(p: ParticleCadenceFields, distanceSq: number): boolean {
    return distanceSq > 55 * 55 || Boolean(p._emissiveOnly);
}

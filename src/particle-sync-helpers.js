/** Minimum RGB channel sum before skipping color writes on fading particles. */
export const PARTICLE_COLOR_FADE_THRESHOLD = 0.08;

/**
 * Distance-tiered and age-based particle update cadence.
 * Near particles update every frame; far / nearly-expired skip frames.
 */
export function shouldUpdateParticle(p, timeAlive, distanceSq, frameIndex) {
    const progress = p.duration > 0 ? timeAlive / p.duration : 1;
    if (progress >= 0.88) return frameIndex % 3 === 0;

    if (distanceSq > 70 * 70) return frameIndex % 3 === 0;
    if (distanceSq > 40 * 40) return frameIndex % 2 === 0;
    return true;
}

export function particleDistanceSq(p, eye) {
    if (!p?.pos || !eye) return 0;
    const dx = p.pos.x - eye[0];
    const dy = p.pos.y - eye[1];
    const dz = p.pos.z - eye[2];
    return dx * dx + dy * dy + dz * dz;
}

export function shouldSkipParticleColorUpdate(p, timeAlive) {
    if (!p?.duration) return false;
    const progress = timeAlive / p.duration;
    if (progress >= 0.92) return true;
    const last = p._lastBaseColor;
    if (last && last[0] + last[1] + last[2] < PARTICLE_COLOR_FADE_THRESHOLD) return true;
    return false;
}

/** Distant particles use emissive-only representation (no paired lights). */
export function useEmissiveOnlyParticle(p, distanceSq) {
    return distanceSq > 55 * 55 || Boolean(p._emissiveOnly);
}

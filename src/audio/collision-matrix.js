/**
 * Marble material × surface material → sound bank entry + pitch variance.
 */

const SURFACE_ALIASES = {
    rock: 'concrete',
    stone: 'concrete',
    obsidian: 'glass',
    crystal: 'glass',
    ice: 'glass',
    sand: 'concrete',
    volcanic: 'concrete',
    volcanicRock: 'concrete',
    rubber: 'rubber',
};

const MARBLE_ALIASES = {
    classic_red: 'glass',
    classic_blue: 'glass',
    classic_green: 'glass',
    volcanic_magma: 'metal',
    shadow_ninja: 'metal',
    cosmic_nebula: 'glass',
    neon_glow: 'glass',
};

/**
 * @param {object | null} matrix
 * @param {string} marbleMaterial
 * @param {string} surfaceMaterial
 */
export function resolveCollisionSound(matrix, marbleMaterial, surfaceMaterial) {
    const marble = MARBLE_ALIASES[marbleMaterial] || marbleMaterial || 'glass';
    const surface = SURFACE_ALIASES[surfaceMaterial] || surfaceMaterial || 'concrete';

    if (matrix?.entries) {
        let best = null;
        let bestScore = -1;

        for (const entry of matrix.entries) {
            const marbleOk = entry.marble === '*' || entry.marble === marble;
            const surfaceOk = entry.surface === '*' || entry.surface === surface;
            if (!marbleOk || !surfaceOk) continue;

            const score =
                (entry.marble === marble ? 2 : 0) +
                (entry.surface === surface ? 2 : 0);
            if (score > bestScore) {
                bestScore = score;
                best = entry;
            }
        }

        if (best) {
            return {
                soundId: best.sound,
                pitchMin: best.pitchMin ?? 0.92,
                pitchMax: best.pitchMax ?? 1.08,
            };
        }
    }

    const soundId = `collision_${surface}`;
    return {
        soundId,
        pitchMin: marble === 'metal' ? 0.85 : 0.92,
        pitchMax: marble === 'glass' ? 1.15 : 1.08,
    };
}

/**
 * @param {string} surfaceMaterial
 */
export function resolveRollingSound(surfaceMaterial) {
    const surface = SURFACE_ALIASES[surfaceMaterial] || surfaceMaterial || 'concrete';
    return `roll_${surface}`;
}

/**
 * Marble material × surface material → sound bank entry + pitch variance.
 */

/** One `assets/audio/collision_matrix.json` rule; `'*'` matches any material. */
export interface CollisionMatrixEntry {
    marble: string;
    surface: string;
    sound: string;
    pitchMin?: number;
    pitchMax?: number;
}

/** Parsed `assets/audio/collision_matrix.json`. */
export interface CollisionMatrix {
    version?: string;
    default?: string;
    entries?: readonly CollisionMatrixEntry[];
}

export interface ResolvedCollisionSound {
    soundId: string;
    pitchMin: number;
    pitchMax: number;
}

const SURFACE_ALIASES: Readonly<Partial<Record<string, string>>> = {
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

const MARBLE_ALIASES: Readonly<Partial<Record<string, string>>> = {
    classic_red: 'glass',
    classic_blue: 'glass',
    classic_green: 'glass',
    volcanic_magma: 'metal',
    shadow_ninja: 'metal',
    cosmic_nebula: 'glass',
    neon_glow: 'glass',
};

export function resolveCollisionSound(
    matrix: CollisionMatrix | null | undefined,
    marbleMaterial: string,
    surfaceMaterial: string,
): ResolvedCollisionSound {
    const marble = MARBLE_ALIASES[marbleMaterial] || marbleMaterial || 'glass';
    const surface = SURFACE_ALIASES[surfaceMaterial] || surfaceMaterial || 'concrete';

    if (matrix?.entries) {
        let best: CollisionMatrixEntry | null = null;
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

export function resolveRollingSound(surfaceMaterial: string): string {
    const surface = SURFACE_ALIASES[surfaceMaterial] || surfaceMaterial || 'concrete';
    return `roll_${surface}`;
}

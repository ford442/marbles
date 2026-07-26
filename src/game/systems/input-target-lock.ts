import type { Vec3 } from '../../types/geometry.js';

export interface LockOnRigidBody {
    translation(): Vec3;
}

export interface LockOnTarget {
    rigidBody: LockOnRigidBody;
    name?: string;
}

/** Pick the nearest marble to the player for target lock-on (pure — no Rapier). */
export function findBestLockOnTarget<T extends LockOnTarget>(
    marbles: readonly T[],
    playerMarble: T | null | undefined,
): T | null {
    if (!playerMarble || marbles.length === 0) return null;

    const pPos = playerMarble.rigidBody.translation();
    let best: T | null = null;
    let bestDistSq = Infinity;

    for (const marble of marbles) {
        if (marble === playerMarble) continue;
        const position = marble.rigidBody.translation();
        const dx = position.x - pPos.x;
        const dy = position.y - pPos.y;
        const dz = position.z - pPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = marble;
        }
    }

    return best;
}

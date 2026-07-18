/**
 * Pick the nearest marble to the player for target lock-on (pure — no Rapier).
 * @param {Array<{ rigidBody?: { translation(): { x: number, y: number, z: number } }, name?: string }>} marbles
 * @param {object | null | undefined} playerMarble
 */
export function findBestLockOnTarget(marbles, playerMarble) {
    if (!playerMarble || !marbles?.length) return null;

    const pPos = playerMarble.rigidBody.translation();

    let best = null;
    let bestDistSq = Infinity;

    for (const m of marbles) {
        if (m === playerMarble) continue;
        const mPos = m.rigidBody.translation();
        const dx = mPos.x - pPos.x;
        const dy = mPos.y - pPos.y;
        const dz = mPos.z - pPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            best = m;
        }
    }

    return best;
}

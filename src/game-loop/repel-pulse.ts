import type RAPIER from '@dimforge/rapier3d-compat';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';

/** Reused across frames so the repel pulse doesn't allocate per body. */
const _repelBodies: (RAPIER.RigidBody | null)[] = [];

/** What `applyRepelPulse` uses on the game. */
export type RepelPulseHost = Pick<FrameState, 'playerMarble' | 'dynamicBodies'> & Pick<FrameExtras, '_forceBatchBuffers'>;

/**
 * Pushes every dynamic body within `radius` of the player straight away from
 * it with a constant impulse of `force * mass` (plus `yPop` on y). Shared by
 * the Shield and Violet Light abilities.
 *
 * Above FORCE_BATCH_THRESHOLD targets this goes through
 * `computeForceFieldsBatch` with falloffExp = 0 (pow(d, 0) = 1, so the
 * magnitude is just the per-body strength) and a negative strength, since the
 * kernel's direction is field − body.
 */
export function applyRepelPulse(game: RepelPulseHost, radius: number, force: number, yPop: number): void {
    // Callers (Shield / Violet Light in `logic.js`) only pulse with a player marble.
    if (!game.playerMarble) return
    const playerRb = game.playerMarble.rigidBody
    const playerPos = playerRb.translation()
    const radiusSq = radius * radius

    if (!game._forceBatchBuffers) game._forceBatchBuffers = new PhysicsBatchBuffers(128)
    const buf = game._forceBatchBuffers
    buf.ensure(game.dynamicBodies.size)

    let count = 0
    for (const body of game.dynamicBodies) {
        if (body === playerRb) continue

        const bodyPos = body.translation()
        const dx = bodyPos.x - playerPos.x
        const dy = bodyPos.y - playerPos.y
        const dz = bodyPos.z - playerPos.z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq >= radiusSq || distSq <= 0.001) continue

        const base = count * 3
        buf.positions[base] = bodyPos.x
        buf.positions[base + 1] = bodyPos.y
        buf.positions[base + 2] = bodyPos.z
        buf.strengths[count] = -force * body.mass()
        _repelBodies[count] = body
        count++
    }

    if (count > FORCE_BATCH_THRESHOLD) {
        getMarblePhysics().computeForceFieldsBatch(
            buf.positions, buf.strengths, buf.forces, count,
            playerPos.x, playerPos.y, playerPos.z,
            0, 0, radius, 0
        )
    } else {
        for (let i = 0; i < count; i++) {
            const base = i * 3
            const dx = (buf.positions[base] ?? 0) - playerPos.x
            const dy = (buf.positions[base + 1] ?? 0) - playerPos.y
            const dz = (buf.positions[base + 2] ?? 0) - playerPos.z
            const scale = -(buf.strengths[i] ?? 0) / Math.sqrt(dx * dx + dy * dy + dz * dz)
            buf.forces[base] = dx * scale
            buf.forces[base + 1] = dy * scale
            buf.forces[base + 2] = dz * scale
        }
    }

    for (let i = 0; i < count; i++) {
        const base = i * 3
        _repelBodies[i]?.applyImpulse({
            x: buf.forces[base] ?? 0,
            y: (buf.forces[base + 1] ?? 0) + yPop,
            z: buf.forces[base + 2] ?? 0
        }, true)
        _repelBodies[i] = null
    }
}

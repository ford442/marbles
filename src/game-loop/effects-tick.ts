import type RAPIER from '@dimforge/rapier3d-compat';
import { quaternionToMat4 } from '../math.ts';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import {
    getCachedTransformInstance,
    transformChanged,
    scaledTransform,
    setColor3IfChanged,
} from './helpers.ts';

import type { AbilityBomb } from '../abilities/bomb.ts';
import type { AbilityMissiles } from '../abilities/missiles.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { Vec3 } from '../types/geometry.ts';

/** What `tickActiveProjectiles` (black holes, missiles, bombs) uses on the game. */
export type GameLoopEffectsTickHost =
    & Pick<FrameState, 'activeBlackHoles' | 'activeMissiles' | 'activeBombs' | 'dynamicBodies' | 'playerMarble'>
    & Pick<EngineContext, 'engine' | 'world' | 'Filament' | 'effectPool' | 'cullingManager'>
    & Pick<FrameExtras, 'simDt' | '_forceBatchBuffers'>
    & Pick<InputSystemHost, 'physicsQueries'>
    & Pick<AbilityMissiles, 'explodeMissile'>
    & Pick<AbilityBomb, 'explodeBomb'>;

export class GameLoopEffectsTick {
    declare game: GameLoopEffectsTickHost;

    constructor(game: GameLoopEffectsTickHost) {
        this.game = game;
    }

    tickActiveProjectiles(now: number): void {
        const tcm = this.game.engine.getTransformManager()
        // Black-hole pull is tuned per 1/60 s step; scale by simulated time.
        const simDt = this.game.simDt ?? 1 / 60
        const step = simDt * 60
                // Handle Active Black Holes lifecycle
                if (this.game.activeBlackHoles && this.game.activeBlackHoles.length > 0) {
                for (let i = this.game.activeBlackHoles.length - 1; i >= 0; i--) {
                    const bh = this.game.activeBlackHoles[i]
                    if (!bh) continue
                    const timeAlive = now - bh.spawnTime
        
                    if (timeAlive > bh.duration) {
                        this.game.dynamicBodies.delete(bh.rigidBody)
                        this.game.world.removeRigidBody(bh.rigidBody)
                        this.game.effectPool?.releaseProjectile(bh)
        
                        this.game.activeBlackHoles.splice(i, 1)
                    } else {
                        const pos = bh.rigidBody.translation()
                        const radius = 25.0
                        const radiusSq = radius * radius  // pre-computed to avoid repeated multiplication in the loop
                        const attractionForce = 20.0
        
                        // Attract dynamic bodies using the MarblePhysics WASM module
                        // (automatically falls back to a pure-JS implementation when
                        // the WASM binary has not been built yet).
                        const physics = getMarblePhysics()
                        const bhRb = bh.rigidBody
                        const playerRb = this.game.playerMarble ? this.game.playerMarble.rigidBody : null
                        const targets: { body: RAPIER.RigidBody; pos: Vec3; strength: number }[] = []
        
                        for (const body of this.game.dynamicBodies) {
                            if (body === bhRb) continue
                            if (body === playerRb) continue
        
                            const bodyPos = body.translation()
                            if (physics.vec3DistanceSq(
                                    pos.x, pos.y, pos.z,
                                    bodyPos.x, bodyPos.y, bodyPos.z) > radiusSq) continue
        
                            targets.push({
                                body,
                                pos: bodyPos,
                                strength: attractionForce * body.mass()
                            })
                        }
        
                        if (targets.length > FORCE_BATCH_THRESHOLD) {
                            if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(128)
                            const buf = this.game._forceBatchBuffers
                            buf.ensure(targets.length)
        
                            for (const [i, t] of targets.entries()) {
                                const base = i * 3
                                buf.positions[base] = t.pos.x
                                buf.positions[base + 1] = t.pos.y
                                buf.positions[base + 2] = t.pos.z
                                buf.strengths[i] = t.strength
                            }
        
                            physics.computeForceFieldsBatch(
                                buf.positions, buf.strengths, buf.forces, targets.length,
                                pos.x, pos.y, pos.z,
                                1.0, 0.5, radius, 0
                            )
        
                            for (const [i, { body }] of targets.entries()) {
                                const base = i * 3
                                body.applyImpulse({
                                    x: (buf.forces[base] ?? 0) * step,
                                    y: ((buf.forces[base + 1] ?? 0) + body.mass() * 0.2) * step,
                                    z: (buf.forces[base + 2] ?? 0) * step
                                }, true)
                            }
                        } else {
                            if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(16)
                            const scalarBuf = this.game._forceBatchBuffers.forces
                            for (const { body, pos: bodyPos, strength } of targets) {
                                physics.computeForceFieldInto(
                                    scalarBuf,
                                    pos.x, pos.y, pos.z,
                                    bodyPos.x, bodyPos.y, bodyPos.z,
                                    strength,
                                    1.0, 0.5, radius, 0
                                )
                                body.applyImpulse({
                                    x: (scalarBuf[0] ?? 0) * step,
                                    y: ((scalarBuf[1] ?? 0) + body.mass() * 0.2) * step,
                                    z: (scalarBuf[2] ?? 0) * step
                                }, true)
                            }
                        }
        
                        const r = bh.rigidBody.rotation()
                        const pulse = 1.0 + Math.sin(timeAlive * 0.01) * 0.1
                        const s = 1.5 * pulse // Adjust visual size
                        const visualVisible = this.game.cullingManager?.isVisible(`black-hole:${bh.entity}`, [pos.x, pos.y, pos.z], s, 'dynamic') ?? true
                        this.game.cullingManager?.setEntityVisible(bh.entity, visualVisible, `black-hole:${bh.entity}`)
                        if (bh.lightEntity) this.game.cullingManager?.setEntityVisible(bh.lightEntity, visualVisible, `black-hole-light:${bh.lightEntity}`)
        
                        if (!visualVisible) {
                            bh._forceTransformSync = true
                            if (bh.lightEntity) {
                                bh._lightSync = bh._lightSync || {}
                                bh._lightSync._forceTransformSync = true
                            }
                            continue
                        }
        
                        if (transformChanged(bh, pos, r, s)) {
                            const mat = scaledTransform(pos, r, { x: s, y: s, z: s })
                            tcm.setTransform(getCachedTransformInstance(tcm, bh, bh.entity), mat)
                        }
        
                        if (bh.lightEntity) {
                            bh._lightSync = bh._lightSync || {}
                            if (transformChanged(bh._lightSync, pos, { x: 0, y: 0, z: 0, w: 1 })) {
                                const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                                tcm.setTransform(getCachedTransformInstance(tcm, bh._lightSync, bh.lightEntity), lightMat)
                            }
                        }
                    }
                }
                }
        
                // Handle Active Missiles lifecycle
                for (let i = this.game.activeMissiles.length - 1; i >= 0; i--) {
                    const m = this.game.activeMissiles[i]
                    if (!m) continue
                    const timeAlive = now - m.spawnTime
        
                    const pos = m.rigidBody.translation()
                    const vel = m.rigidBody.linvel()
                    const speed = Math.hypot(vel.x, vel.y, vel.z)
        
                    // Impact detection: raycast ahead for the distance the next
                    // frame's steps will cover (the body itself has CCD, so it
                    // stops at thin walls rather than tunnelling).
                    let hitTarget = false
                    let hitPos: Vec3 = pos
                    if (speed > 0.1) {
                        const dir = { x: vel.x / speed, y: vel.y / speed, z: vel.z / speed }
                        // Plus a little extra for radius
                        const rayDist = speed * Math.max(simDt, 1 / 60) + 0.2
                        const hit = this.game.physicsQueries.castRay(pos, dir, rayDist, {
                            excludeBody: m.rigidBody,
                            excludeSensors: true,
                        })

                        // Ignore the player who fired it
                        const firedBy = this.game.playerMarble?.rigidBody.handle
                        if (hit && hit.bodyHandle !== firedBy) {
                            hitTarget = true
                            hitPos = hit.point
                        }
                    }
        
                    if (hitTarget || timeAlive > m.duration) {
                        if (hitTarget) {
                            this.game.explodeMissile(hitPos)
                        }
                        this.game.dynamicBodies.delete(m.rigidBody)
                        this.game.world.removeRigidBody(m.rigidBody)
                        this.game.effectPool?.releaseProjectile(m)
        
                        this.game.activeMissiles.splice(i, 1)
                    } else {
                        const r = m.rigidBody.rotation()
                        const s = 0.4
                        const visualVisible = this.game.cullingManager?.isVisible(`missile:${m.entity}`, [pos.x, pos.y, pos.z], s, 'dynamic') ?? true
                        this.game.cullingManager?.setEntityVisible(m.entity, visualVisible, `missile:${m.entity}`)
                        if (m.lightEntity) this.game.cullingManager?.setEntityVisible(m.lightEntity, visualVisible, `missile-light:${m.lightEntity}`)
        
                        if (!visualVisible) {
                            m._forceTransformSync = true
                            if (m.lightEntity) {
                                m._lightSync = m._lightSync || {}
                                m._lightSync._forceTransformSync = true
                            }
                            continue
                        }
        
                        if (transformChanged(m, pos, r, s)) {
                            const mat = scaledTransform(pos, r, { x: s, y: s, z: s })
                            tcm.setTransform(getCachedTransformInstance(tcm, m, m.entity), mat)
                        }
        
                        if (m.lightEntity) {
                            m._lightSync = m._lightSync || {}
                            if (transformChanged(m._lightSync, pos, { x: 0, y: 0, z: 0, w: 1 })) {
                                const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                                tcm.setTransform(getCachedTransformInstance(tcm, m._lightSync, m.lightEntity), lightMat)
                            }
                        }
                    }
                }
        
                // Handle Active Bombs lifecycle
                for (let i = this.game.activeBombs.length - 1; i >= 0; i--) {
                    const b = this.game.activeBombs[i]
                    if (!b) continue
                    const timeAlive = now - b.spawnTime
        
                    if (timeAlive > b.duration) {
                        this.game.explodeBomb(b)
                        this.game.dynamicBodies.delete(b.rigidBody)
                        this.game.world.removeRigidBody(b.rigidBody)
                        this.game.effectPool?.releaseProjectile(b)
        
                        this.game.activeBombs.splice(i, 1)
                    } else {
                        const timeLeft = b.duration - timeAlive
                        const blinkRate = Math.max(50, timeLeft / 5) // Speeds up as it gets closer
                        const blink = Math.floor(now / blinkRate) % 2 === 0
        
                        const color = blink ? [1.0, 0.2, 0.0] : [0.2, 0.2, 0.2]
                        setColor3IfChanged(this.game, b, b.matInstance, color, now, 40)
        
                        // Sync Filament transform to Rapier rigid body
                        const t = b.rigidBody.translation()
                        const r = b.rigidBody.rotation()
                        const s = 0.8
                        const visualVisible = this.game.cullingManager?.isVisible(`bomb:${b.entity}`, [t.x, t.y, t.z], s, 'dynamic') ?? true
                        this.game.cullingManager?.setEntityVisible(b.entity, visualVisible, `bomb:${b.entity}`)
                        if (b.lightEntity) this.game.cullingManager?.setEntityVisible(b.lightEntity, visualVisible, `bomb-light:${b.lightEntity}`)
        
                        if (!visualVisible) {
                            b._forceTransformSync = true
                            if (b.lightEntity) {
                                b._lightSync = b._lightSync || {}
                                b._lightSync._forceTransformSync = true
                            }
                            continue
                        }
        
                        if (transformChanged(b, t, r, s)) {
                            const mat = scaledTransform(t, r, { x: s, y: s, z: s })
                            tcm.setTransform(getCachedTransformInstance(tcm, b, b.entity), mat)
                        }
        
                        if (b.lightEntity) {
                            b._lightSync = b._lightSync || {}
                            if (transformChanged(b._lightSync, t, { x: 0, y: 0, z: 0, w: 1 })) {
                                const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                                tcm.setTransform(getCachedTransformInstance(tcm, b._lightSync, b.lightEntity), lightMat)
                            }
                        }
                    }
                }
    }
}

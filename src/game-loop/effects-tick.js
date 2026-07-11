import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.js';
import { getLevel } from '../levels/catalog.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import { getDofConfig } from '../rendering/post-fx-presets.js';
import {
    getCachedTransformInstance,
    transformChanged,
    scaledTransform,
    setColor3IfChanged,
    DOF_CAMERA_MODES,
    DOF_UPDATE_THRESHOLD,
} from './helpers.js';

export class GameLoopEffectsTick {
    tickActiveProjectiles(now) {
        const tcm = this.engine.getTransformManager()
                // Handle Active Black Holes lifecycle
                if (this.activeBlackHoles && this.activeBlackHoles.length > 0) {
                for (let i = this.activeBlackHoles.length - 1; i >= 0; i--) {
                    const bh = this.activeBlackHoles[i]
                    const timeAlive = now - bh.spawnTime
        
                    if (timeAlive > bh.duration) {
                        this.dynamicBodies.delete(bh.rigidBody)
                        this.world.removeRigidBody(bh.rigidBody)
                        this.effectPool?.releaseProjectile(bh)
        
                        this.activeBlackHoles.splice(i, 1)
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
                        const playerRb = this.playerMarble ? this.playerMarble.rigidBody : null
                        const targets = []
        
                        for (const body of this.dynamicBodies) {
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
                            if (!this._forceBatchBuffers) this._forceBatchBuffers = new PhysicsBatchBuffers(128)
                            const buf = this._forceBatchBuffers
                            buf.ensure(targets.length)
        
                            for (let i = 0; i < targets.length; i++) {
                                const base = i * 3
                                const t = targets[i]
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
        
                            for (let i = 0; i < targets.length; i++) {
                                const base = i * 3
                                const body = targets[i].body
                                body.applyImpulse({
                                    x: buf.forces[base],
                                    y: buf.forces[base + 1] + body.mass() * 0.2,
                                    z: buf.forces[base + 2]
                                }, true)
                            }
                        } else {
                            for (const { body, pos: bodyPos, strength } of targets) {
                                const force = physics.computeForceField(
                                    pos.x, pos.y, pos.z,
                                    bodyPos.x, bodyPos.y, bodyPos.z,
                                    strength,
                                    1.0, 0.5, radius, 0
                                )
                                body.applyImpulse({
                                    x: force.x,
                                    y: force.y + body.mass() * 0.2,
                                    z: force.z
                                }, true)
                            }
                        }
        
                        const r = bh.rigidBody.rotation()
                        const pulse = 1.0 + Math.sin(timeAlive * 0.01) * 0.1
                        const s = 1.5 * pulse // Adjust visual size
                        const visualVisible = this.cullingManager?.isVisible(`black-hole:${bh.entity}`, [pos.x, pos.y, pos.z], s, 'dynamic') ?? true
                        this.cullingManager?.setEntityVisible(bh.entity, visualVisible, `black-hole:${bh.entity}`)
                        if (bh.lightEntity) this.cullingManager?.setEntityVisible(bh.lightEntity, visualVisible, `black-hole-light:${bh.lightEntity}`)
        
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
                for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
                    const m = this.activeMissiles[i]
                    const timeAlive = now - m.spawnTime
        
                    const pos = m.rigidBody.translation()
                    const vel = m.rigidBody.linvel()
                    const speed = Math.hypot(vel.x, vel.y, vel.z)
        
                    // CCD via raycast
                    let hitTarget = false
                    let hitPos = pos
                    if (speed > 0.1) {
                        const dir = { x: vel.x / speed, y: vel.y / speed, z: vel.z / speed }
                        // Raycast ahead for the distance it will travel next frame (approx 1/60th of speed)
                        // Plus a little extra for radius
                        const rayDist = (speed * (1/60)) + 0.2
                        const ray = new RAPIER.Ray(pos, dir)
                        // Filter out the missile's rigidBody. castRay args: ray, maxToi, solid, collisionGroups, filterIntersection, filterHit, filterExcludeCollider, filterExcludeRigidBody
                        const hit = this.world.castRay(ray, rayDist, true, 0xffffffff, undefined, undefined, undefined, m.rigidBody)
        
                        if (hit) {
                            // Check if it hit the player who fired it
                            const otherBody = hit.collider.parent()
                            if (!(otherBody && this.playerMarble && otherBody.handle === this.playerMarble.rigidBody.handle)) {
                                 hitTarget = true
                                 hitPos = {
                                     x: pos.x + dir.x * hit.toi,
                                     y: pos.y + dir.y * hit.toi,
                                     z: pos.z + dir.z * hit.toi
                                 }
                            }
                        }
                    }
        
                    if (hitTarget || timeAlive > m.duration) {
                        if (hitTarget) {
                            this.explodeMissile(hitPos)
                        }
                        this.dynamicBodies.delete(m.rigidBody)
                        this.world.removeRigidBody(m.rigidBody)
                        this.effectPool?.releaseProjectile(m)
        
                        this.activeMissiles.splice(i, 1)
                    } else {
                        const r = m.rigidBody.rotation()
                        const s = 0.4
                        const visualVisible = this.cullingManager?.isVisible(`missile:${m.entity}`, [pos.x, pos.y, pos.z], s, 'dynamic') ?? true
                        this.cullingManager?.setEntityVisible(m.entity, visualVisible, `missile:${m.entity}`)
                        if (m.lightEntity) this.cullingManager?.setEntityVisible(m.lightEntity, visualVisible, `missile-light:${m.lightEntity}`)
        
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
                for (let i = this.activeBombs.length - 1; i >= 0; i--) {
                    const b = this.activeBombs[i]
                    const timeAlive = now - b.spawnTime
        
                    if (timeAlive > b.duration) {
                        this.explodeBomb(b)
                        this.dynamicBodies.delete(b.rigidBody)
                        this.world.removeRigidBody(b.rigidBody)
                        this.effectPool?.releaseProjectile(b)
        
                        this.activeBombs.splice(i, 1)
                    } else {
                        const timeLeft = b.duration - timeAlive
                        const blinkRate = Math.max(50, timeLeft / 5) // Speeds up as it gets closer
                        const blink = Math.floor(now / blinkRate) % 2 === 0
        
                        const color = blink ? [1.0, 0.2, 0.0] : [0.2, 0.2, 0.2]
                        setColor3IfChanged(this, b, b.matInstance, color, now, 40)
        
                        // Sync Filament transform to Rapier rigid body
                        const t = b.rigidBody.translation()
                        const r = b.rigidBody.rotation()
                        const s = 0.8
                        const visualVisible = this.cullingManager?.isVisible(`bomb:${b.entity}`, [t.x, t.y, t.z], s, 'dynamic') ?? true
                        this.cullingManager?.setEntityVisible(b.entity, visualVisible, `bomb:${b.entity}`)
                        if (b.lightEntity) this.cullingManager?.setEntityVisible(b.lightEntity, visualVisible, `bomb-light:${b.lightEntity}`)
        
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

export function applyGameLoopEffectsTick(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopEffectsTick.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopEffectsTick.prototype[name];
        }
    }
}

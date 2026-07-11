import { quaternionToMat4, quatFromEuler } from '../math.js';
import {
    shouldUpdateParticle,
    shouldSkipParticleColorUpdate,
    particleDistanceSq,
} from '../particle-sync-helpers.js';
import {
    updateMarbleMaterialTiers,
    updateMarbleDynamicMaterialEffects,
} from '../marble-material-tier.js';

const IDENTITY_QUAT = { x: 0, y: 0, z: 0, w: 1 }
const TRANSFORM_POS_EPS_SQ = 0.000001
const TRANSFORM_ROT_EPS_SQ = 0.000001
const COLOR_EPS = 1 / 255
const PARTICLE_COLOR_INTERVAL_MS = 50
const RAINBOW_COLOR_INTERVAL_MS = 50

function getCachedTransformInstance(tcm, owner, entity, perfCounts) {
    if (owner._transformEntity !== entity || owner._transformInst === undefined) {
        owner._transformEntity = entity
        owner._transformInst = tcm.getInstance(entity)
        if (perfCounts) perfCounts.transformInstanceCacheMisses += 1
    }
    return owner._transformInst
}

function transformChanged(owner, t, r, scaleKey = 1) {
    if (owner._forceTransformSync) {
        owner._forceTransformSync = false
        return true
    }

    const last = owner._lastTransformSync
    if (last &&
        last.scaleKey === scaleKey &&
        ((t.x - last.x) * (t.x - last.x) + (t.y - last.y) * (t.y - last.y) + (t.z - last.z) * (t.z - last.z)) < TRANSFORM_POS_EPS_SQ &&
        ((r.x - last.rx) * (r.x - last.rx) + (r.y - last.ry) * (r.y - last.ry) + (r.z - last.rz) * (r.z - last.rz) + (r.w - last.rw) * (r.w - last.rw)) < TRANSFORM_ROT_EPS_SQ) {
        return false
    }

    owner._lastTransformSync = { x: t.x, y: t.y, z: t.z, rx: r.x, ry: r.y, rz: r.z, rw: r.w, scaleKey }
    return true
}

function colorChanged(owner, color, now, minIntervalMs, key = '_lastBaseColor') {
    const last = owner[key]
    const lastAt = owner[`${key}At`] || 0
    if (last && (now - lastAt) < minIntervalMs) return false

    if (last &&
        Math.abs(color[0] - last[0]) < COLOR_EPS &&
        Math.abs(color[1] - last[1]) < COLOR_EPS &&
        Math.abs(color[2] - last[2]) < COLOR_EPS) {
        owner[`${key}At`] = now
        return false
    }

    owner[key] = [color[0], color[1], color[2]]
    owner[`${key}At`] = now
    return true
}

function setColor3IfChanged(game, owner, matInstance, color, minIntervalMs = PARTICLE_COLOR_INTERVAL_MS, key = '_lastBaseColor') {
    if (!matInstance || !colorChanged(owner, color, game._syncNow || performance.now(), minIntervalMs, key)) return false
    matInstance.setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, color)
    return true
}

function setScaledTransformIfChanged(tcm, owner, entity, pos, quat, scale, perfCounts) {
    if (!transformChanged(owner, pos, quat, scale)) {
        perfCounts.transformsSkipped += 1
        return false
    }

    const mat = quaternionToMat4(pos, quat)
    if (typeof scale === 'number') {
        mat[0] *= scale; mat[1] *= scale; mat[2] *= scale
        mat[4] *= scale; mat[5] *= scale; mat[6] *= scale
        mat[8] *= scale; mat[9] *= scale; mat[10] *= scale
    } else if (scale) {
        mat[0] *= scale.x; mat[1] *= scale.x; mat[2] *= scale.x
        mat[4] *= scale.y; mat[5] *= scale.y; mat[6] *= scale.y
        mat[8] *= scale.z; mat[9] *= scale.z; mat[10] *= scale.z
    }
    tcm.setTransform(getCachedTransformInstance(tcm, owner, entity, perfCounts), mat)
    perfCounts.transformsSet += 1
    return true
}

export class GameLoopSyncMethods {
    syncTransformsAndRender(now) {
        this._syncNow = now
        this._effectFrameIndex = (this._effectFrameIndex || 0) + 1
        this.effectPool?.beginFrame()
        const perfSyncStart = performance.now()
        const perfCounts = {
            visualParticlesStart: this.visualParticles?.length || 0,
            visualParticlesCulled: 0,
            temporaryPlatforms: this.temporaryPlatforms?.length || 0,
            marbles: this.marbles?.length || 0,
            dynamicObjects: this.dynamicObjects?.length || 0,
            cueVisible: this.cueInst ? 1 : 0,
            activeMarbleLight: this.activeMarbleLightEntity ? 1 : 0,
            physicsStepMs: 0,
            renderMs: 0,
            renderedFrame: false,
            transformsSet: 0,
            transformsSkipped: 0,
            transformInstanceCacheMisses: 0,
            materialUpdatesSkipped: 0,
            marbleDynamicFxUpdates: 0,
            marbleDynamicFxSkipped: 0,
        }
        // Cache transform manager once per frame to avoid repeated WASM boundary crossings
        const tcm = this.engine.getTransformManager()
        this.cullingManager?.updateStaticBatches()
        this.marbleLodManager?.updateMarbles(now)
        updateMarbleMaterialTiers(this, now)

        // Handle visual particles lifecycle
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            const p = this.visualParticles[i]
            const timeAlive = now - p.spawnTime

            if (timeAlive > p.duration) {
                this.effectPool?.releaseVisualParticle(p)
                this.visualParticles.splice(i, 1)
            } else {
                const particleCenter = p.pos ? [p.pos.x, p.pos.y, p.pos.z] : null
                const particleRadius = p.maxRadius || p.scale || 1
                const particleVisible = this.cullingManager?.isVisible(`particle:${p.entity}`, particleCenter, particleRadius, 'particle') ?? true
                this.cullingManager?.setEntityVisible(p.entity, particleVisible, `particle:${p.entity}`)
                if (!particleVisible) {
                    perfCounts.visualParticlesCulled += 1
                    continue
                }

                const distSq = particleDistanceSq(p, this._cameraState?.eye)
                if (!shouldUpdateParticle(p, timeAlive, distSq, this._effectFrameIndex)) {
                    perfCounts.transformsSkipped += 1
                    continue
                }
                const skipColor = shouldSkipParticleColorUpdate(p, timeAlive)
                if (p.isEMPRing) {
                    // EMP shockwave ring effect
                    const progress = timeAlive / p.duration
                    
                    // Expand from start radius to max radius
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    p.scale = currentRadius / p.startRadius
                    
                    // Fade opacity as it expands - cyan to transparent
                    const opacity = 1.0 - progress
                    const r = 0.0
                    const g = 0.8 + progress * 0.2  // Slight color shift as it fades
                    const b = 1.0
                    
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    // Scale XZ for the expanding ring, Y stays thin
                    const sXZ = currentRadius
                    const sY = 0.05 * (1.0 - progress * 0.5)  // Gets slightly thinner
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isEMPSpark) {
                    // EMP spark particle effect
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016

                    // Sparks shrink and fade quickly
                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress * progress)  // Quadratic fade

                    const r = 0.2 * (1.0 - progress)
                    const g = 0.9 * (1.0 - progress * 0.5)
                    const b = 1.0
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    const s = 0.2 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isRing) {
                    const progress = timeAlive / p.duration
                    p.scale = 1.0 + progress * 20.0

                    const r = 1.0 - progress
                    const g = 0.2 - progress * 0.2
                    const b = 0.0
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    const sXZ = 0.1 * p.scale
                    const sY = 0.1 * (1.0 - progress)
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isGoalParticle) {
                    // Goal fountain particle - rises then fades
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Add gravity slowdown
                    p.vel.y *= 0.98
                    p.vel.x += (Math.random() - 0.5) * 0.02
                    p.vel.z += (Math.random() - 0.5) * 0.02

                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress * progress)

                    const r = 1.0
                    const g = 0.9 - progress * 0.5
                    const b = 0.3 - progress * 0.3
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCheckpointParticle) {
                    // Checkpoint burst particle - upward burst with gravity
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Apply gravity
                    p.vel.y -= 9.81 * 0.016 * 0.3 // Reduced gravity for slower fall
                    
                    // Slow expansion
                    p.vel.x *= 0.98
                    p.vel.z *= 0.98

                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress)

                    const fade = 1.0 - progress
                    const r = progress * 0.5
                    const g = 0.6 + progress * 0.4 * fade
                    const b = 0.8 + progress * 0.2 * fade
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCheckpointRing) {
                    // Checkpoint expanding ring pulse
                    const progress = timeAlive / p.duration
                    
                    // Expand from start radius to max radius
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    p.scale = currentRadius / p.startRadius
                    
                    // Fade opacity as it expands - cyan to transparent
                    const fade = 1.0 - progress
                    const r = 0.0
                    const g = 0.9 * fade
                    const b = 1.0 * fade
                    
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    // Scale XZ for the expanding ring, Y stays very thin
                    const sXZ = currentRadius
                    const sY = 0.05 * fade // Gets thinner as it fades
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCollectionParticle) {
                    // Collection burst particle - sparkles with gravity
                    const progress = timeAlive / p.duration
                    
                    // Apply physics with gravity
                    p.vel.y -= 4.0 * 0.016  // Gravity
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Particles shrink and fade
                    p.scale = Math.max(0, 1.0 - progress * progress)
                    
                    // Color brightens then fades
                    const brightness = 1.0 - progress * 0.5
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [brightness, brightness * 0.9, brightness * 0.5])) perfCounts.materialUpdatesSkipped += 1
                    
                    // Add rotation
                    const rotY = (p.rotationSpeed || 0) * timeAlive * 0.01
                    const mat = quaternionToMat4(p.pos, quatFromEuler(0, rotY, 0))
                    
                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s
                    
                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCollectionRing) {
                    // Collection ring - expands outward with fade
                    const progress = timeAlive / p.duration
                    
                    // Expand ring
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    
                    // Fade color to transparent
                    const opacity = 1.0 - progress
                    const r = p.color.r * opacity + 1.0 * (1.0 - opacity)
                    const g = p.color.g * opacity + 1.0 * (1.0 - opacity)
                    const b = p.color.b * opacity + 1.0 * (1.0 - opacity)
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1
                    
                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)
                    
                    // Scale ring outward, getting thinner
                    const sXZ = currentRadius
                    const sY = 0.05 * (1.0 - progress)
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ
                    
                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCollectionRay) {
                    // Collection rays - shoot outward
                    const progress = timeAlive / p.duration
                    
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Rays stretch and fade
                    p.scale = 1.0 - progress
                    
                    const brightness = 1.0 - progress * 0.5
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [1.0, 1.0, brightness])) perfCounts.materialUpdatesSkipped += 1
                    
                    // Orient ray along velocity direction
                    const yaw = p.angle
                    const mat = quaternionToMat4(p.pos, quatFromEuler(0, yaw, 0))
                    
                    const sXZ = 0.03 * p.scale
                    const sY = 0.03 * p.scale
                    const sZ = 0.4 * p.scale * (1.0 + progress)  // Stretch as it moves
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sZ; mat[9] *= sZ; mat[10] *= sZ
                    
                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else if (p.isCollectionFlash) {
                    // Collection flash - quick expand and fade
                    const progress = timeAlive / p.duration
                    
                    // Rapid expansion
                    const scale = p.maxScale * (1.0 - Math.pow(progress, 2))
                    
                    // Quick fade
                    const brightness = 1.0 - progress
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [brightness, brightness * 0.9, brightness * 0.5])) perfCounts.materialUpdatesSkipped += 1
                    
                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)
                    
                    mat[0] *= scale; mat[1] *= scale; mat[2] *= scale
                    mat[4] *= scale; mat[5] *= scale; mat[6] *= scale
                    mat[8] *= scale; mat[9] *= scale; mat[10] *= scale
                    
                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                } else {
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016

                    p.scale = Math.max(0, 1.0 - (timeAlive / p.duration))

                    const progress = timeAlive / p.duration
                    const r = 1.0 - progress * 0.8
                    const g = 0.6 - progress * 0.6
                    const b = 0.0
                    if (skipColor || !setColor3IfChanged(this, p, p.matInstance, [r, g, b])) perfCounts.materialUpdatesSkipped += 1

                    const mat = quaternionToMat4(p.pos, IDENTITY_QUAT)

                    const s = 0.2 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity, perfCounts), mat)
                    perfCounts.transformsSet += 1
                }
            }
        }

        // Handle temporary platforms lifecycle
        for (let i = this.temporaryPlatforms.length - 1; i >= 0; i--) {
            const p = this.temporaryPlatforms[i]
            const timeAlive = now - p.spawnTime
            const maxDuration = p.duration || this.holoDuration

            if (timeAlive > maxDuration) {
                this.world.removeRigidBody(p.rigidBody)
                this.effectPool?.releaseHoloPlatform(p)
                this.temporaryPlatforms.splice(i, 1)
            } else {
                const timeLeft = maxDuration - timeAlive
                if (timeLeft < 1000) {
                    const blink = Math.floor(now / 100) % 2 === 0
                    if (p.matInstance && !p.duration) {
                        const color = blink ? [1.0, 0.0, 0.0] : [0.0, 1.0, 1.0]
                        if (!setColor3IfChanged(this, p, p.matInstance, color, 80, '_lastBlinkColor')) perfCounts.materialUpdatesSkipped += 1
                    } else if (p.matInstance && p.duration) {
                        const color = blink ? [1.0, 1.0, 1.0] : [0.5, 0.9, 1.0]
                        if (!setColor3IfChanged(this, p, p.matInstance, color, 80, '_lastBlinkColor')) perfCounts.materialUpdatesSkipped += 1
                    }
                }
            }
        }

        // Skip physics and game logic when paused
        if (!this.isPaused) {
            const physicsStart = performance.now()
            this.world.step()
            perfCounts.physicsStepMs = performance.now() - physicsStart
            this.processCollisionEvents()
            this.checkGameLogic()
        }

        for (const m of this.marbles) {
            const t = m.rigidBody.translation()
            const r = m.rigidBody.rotation()
            const mat = quaternionToMat4(t, r)

            if (m.scale && m.scale !== 1.0) {
                mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale
                mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale
                mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale
            }

            if (transformChanged(m, t, r, m.scale || 1)) {
                tcm.setTransform(getCachedTransformInstance(tcm, m, m.entity, perfCounts), mat)
                perfCounts.transformsSet += 1
            } else {
                perfCounts.transformsSkipped += 1
            }

            if (m.rainbow) {
                const time = now * 0.002
                const r = Math.sin(time) * 0.5 + 0.5
                const g = Math.sin(time + 2.094) * 0.5 + 0.5
                const b = Math.sin(time + 4.188) * 0.5 + 0.5
                if (colorChanged(m, [r, g, b], now, RAINBOW_COLOR_INTERVAL_MS, '_lastRainbowColor')) {
                    const rcm = this._renderableManager || (this._renderableManager = this.engine.getRenderableManager())
                    if (m._renderEntity !== m.entity || m._renderInst === undefined) {
                        m._renderEntity = m.entity
                        m._renderInst = rcm.getInstance(m.entity)
                        m._renderMatInstance = rcm.getMaterialInstanceAt(m._renderInst, 0)
                    }
                    m._renderMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                } else {
                    perfCounts.materialUpdatesSkipped += 1
                }
            }

            if (m === this.playerMarble && this.activeMarbleLightEntity) {
                const lightOwner = this._activeMarbleLightSync || (this._activeMarbleLightSync = {})
                setScaledTransformIfChanged(tcm, lightOwner, this.activeMarbleLightEntity, t, IDENTITY_QUAT, 1, perfCounts)
            }
        }

        updateMarbleDynamicMaterialEffects(this, now, perfCounts)

        for (const obj of this.dynamicObjects) {
            const t = obj.rigidBody.translation()
            const r = obj.rigidBody.rotation()
            const mat = quaternionToMat4(t, r)

            if (obj.halfExtents) {
                const sx = obj.halfExtents.x * 2
                const sy = obj.halfExtents.y * 2
                const sz = obj.halfExtents.z * 2
                mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
                mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
                mat[8] *= sz; mat[9] *= sz; mat[10] *= sz
            }

            const scaleKey = obj.halfExtents
                ? `${obj.halfExtents.x},${obj.halfExtents.y},${obj.halfExtents.z}`
                : 1
            if (transformChanged(obj, t, r, scaleKey)) {
                tcm.setTransform(getCachedTransformInstance(tcm, obj, obj.entity, perfCounts), mat)
                perfCounts.transformsSet += 1
            } else {
                perfCounts.transformsSkipped += 1
            }
        }

        if (this.cameraMode === 'follow' && this.playerMarble && this.charging && this.cueInst) {
            const cosP = Math.cos(this.pitchAngle)
            const sinP = Math.sin(this.pitchAngle)
            const dirX = Math.sin(this.aimYaw) * cosP
            const dirY = sinP
            const dirZ = Math.cos(this.aimYaw) * cosP
            const length = 0.5 + this.chargePower * 2.5
            const r = this.playerMarble.scale * 0.5 || 0.5
            const marbleT = this.playerMarble.rigidBody.translation()
            const cuePos = {
                x: marbleT.x - dirX * (r + 0.2),
                y: marbleT.y - dirY * (r + 0.2),
                z: marbleT.z - dirZ * (r + 0.2)
            }
            const quat = quatFromEuler(this.aimYaw, this.pitchAngle, 0)
            const mat = quaternionToMat4(cuePos, quat)
            const thin = 0.04
            mat[0] *= thin; mat[1] *= thin; mat[2] *= thin
            mat[4] *= thin; mat[5] *= thin; mat[6] *= thin
            mat[8] *= length; mat[9] *= length; mat[10] *= length
            tcm.setTransform(this.cueInst, mat)
            this._cueHidden = false
            perfCounts.transformsSet += 1
        } else if (this.cueInst) {
            if (!this._cueZeroMat) {
                this._cueZeroMat = new Float32Array(16)
                this._cueZeroMat[15] = 1
            }
            if (!this._cueHidden) {
                tcm.setTransform(this.cueInst, this._cueZeroMat)
                this._cueHidden = true
                perfCounts.transformsSet += 1
            } else {
                perfCounts.transformsSkipped += 1
            }
        }

        // Update particle system
        if (this.particleSystem) {
            const frameDeltaSec = this._lastSyncTime ? (now - this._lastSyncTime) / 1000 : 1 / 60
            this.particleSystem.update(frameDeltaSec)
        }
        
        // Update animated lighting
        this.lightingBudget?.update()
        if (this.lightingSystem) {
            const frameDeltaSec = this._lastSyncTime ? (now - this._lastSyncTime) / 1000 : 1 / 60
            this.lightingSystem.update(frameDeltaSec)
        }

        // Update volumetric light shafts and caustics
        if (this.volumetricLights && this._cameraState) {
            const frameDeltaSec = this._lastSyncTime ? (now - this._lastSyncTime) / 1000 : 1 / 60
            const aspect = (this.canvas?.width || window.innerWidth) / (this.canvas?.height || window.innerHeight)
            this.volumetricLights.update(frameDeltaSec, this._cameraState, this.activeFov || this.currentFov || 45, aspect)
        }

        this._lastSyncTime = now

        // Render speed lines overlay
if (this.renderSpeedLines) {
            this.renderSpeedLines();
        }

        if (this.renderer && this.swapChain && this.view) {
            const renderStart = performance.now()
            try {
                // === MODERN / RECOMMENDED FILAMENT PATTERN ===
                if (this.renderer.beginFrame(this.swapChain)) {
                    this.renderer.render(this.swapChain, this.view);
                    this.renderer.endFrame();
                    perfCounts.renderedFrame = true

                    // First-frame handling (loading screen)
                    if (!this._firstFrameRendered) {
                        this._firstFrameRendered = true;
                        console.log('[RENDER] First frame rendered successfully');

                        if (typeof window.hideLoadingScreen === 'function') {
                            window.hideLoadingScreen();
                        } else {
                            const loading = document.getElementById('loading');
                            if (loading) {
                                loading.classList.add('hidden');
                                setTimeout(() => { loading.style.display = 'none'; }, 500);
                            }
                        }
                    }
                }
            } catch (renderErr) {
                if (!this._renderFailLogged) {
                    this._renderFailLogged = true;
                    console.error('[RENDER] renderer.render() failed:', renderErr);
                }
            }
            perfCounts.renderMs = performance.now() - renderStart
            this.perfMonitor?.recordRenderTiming(perfCounts.renderMs, perfCounts.renderedFrame)

            this.engine.execute();
        } 
        else if (!this._renderGuardLogged) {
            this._renderGuardLogged = true;
            console.error('[RENDER] Render guard failed — renderer:', !!this.renderer, 
                         'swapChain:', !!this.swapChain, 'view:', !!this.view);
        }
        perfCounts.syncMs = performance.now() - perfSyncStart
        perfCounts.estimatedTransformSets =
            (perfCounts.visualParticlesStart - perfCounts.visualParticlesCulled) +
            perfCounts.temporaryPlatforms +
            perfCounts.marbles +
            perfCounts.dynamicObjects +
            perfCounts.cueVisible +
            perfCounts.activeMarbleLight
        perfCounts.estimatedGetInstanceCalls = perfCounts.transformInstanceCacheMisses
        perfCounts.cachedTransformInstanceUses =
            Math.max(0, perfCounts.transformsSet + perfCounts.transformsSkipped - perfCounts.transformInstanceCacheMisses)
        this.perfMonitor?.recordSyncWork(perfCounts)
        this._syncNow = 0
    }
}

export function applyGameLoopSync(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopSyncMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopSyncMethods.prototype[name];
        }
    }
}

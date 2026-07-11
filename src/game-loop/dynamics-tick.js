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

export class GameLoopDynamics {
    tickSceneDynamics(now) {
                let culledPowerUps = 0
                let culledCollectibles = 0
                this.cullingManager?.beginFrame()
        
                // Update Moving Platforms
                // If time stop is active, we don't advance the timeSec for moving platforms
                if (this.timeStopActive) {
                    if (!this.lastTimeStopSavedTime) {
                        this.lastTimeStopSavedTime = now
                    }
                } else {
                    if (this.lastTimeStopSavedTime) {
                        // Adjust a global offset to keep platforms smooth after unpausing
                        if (!this.timeStopOffset) this.timeStopOffset = 0
                        this.timeStopOffset += (now - this.lastTimeStopSavedTime)
                        this.lastTimeStopSavedTime = null
                    }
                }
        
                const timeSec = (now - (this.timeStopOffset || 0)) / 1000
        
                // Cache transform manager once for platform/object/collectible updates
                const tcm = this.engine.getTransformManager()
        
                for (const p of this.movingPlatforms) {
                    let x = p.initialPos.x
                    let y = p.initialPos.y
                    let z = p.initialPos.z
        
                    const offset = Math.sin(timeSec * p.speed) * p.amplitude
        
                    if (p.type === 'horizontal') x = p.center + offset
                    if (p.type === 'vertical') y = p.center + offset
                    if (p.type === 'depth') z = p.center + offset
        
                    const t = { x, y, z }
                    p.rigidBody.setNextKinematicTranslation(t)
        
                    const sx = p.halfExtents.x * 2
                    const sy = p.halfExtents.y * 2
                    const sz = p.halfExtents.z * 2
                    const radius = Math.hypot(p.halfExtents.x, p.halfExtents.y, p.halfExtents.z)
                    const visible = this.cullingManager?.isVisible(`moving-platform:${p.entity}`, [x, y, z], radius, 'dynamic') ?? true
                    this.cullingManager?.setEntityVisible(p.entity, visible, `moving-platform:${p.entity}`)
                    if (!visible) {
                        p._forceTransformSync = true
                        continue
                    }
        
                    const r = p.rigidBody.rotation()
                    const scaleKey = `${sx},${sy},${sz}`
                    if (transformChanged(p, t, r, scaleKey)) {
                        const mat = scaledTransform(t, r, { x: sx, y: sy, z: sz })
                        tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity), mat)
                    }
                }
        
                for (const p of this.rotatingPlatforms) {
                    if (!this.timeStopActive) {
                        p.angle += p.speed
                    }
                    // Assuming Y axis rotation for now as per createRotatingBox
                    const q = quatFromEuler(0, p.angle, 0)
        
                    p.rigidBody.setNextKinematicRotation(q)
        
                    const sx = p.halfExtents.x * 2
                    const sy = p.halfExtents.y * 2
                    const sz = p.halfExtents.z * 2
                    const t = p.rigidBody.translation()
                    const radius = Math.hypot(p.halfExtents.x, p.halfExtents.y, p.halfExtents.z)
                    const visible = this.cullingManager?.isVisible(`rotating-platform:${p.entity}`, [t.x, t.y, t.z], radius, 'dynamic') ?? true
                    this.cullingManager?.setEntityVisible(p.entity, visible, `rotating-platform:${p.entity}`)
                    if (!visible) {
                        p._forceTransformSync = true
                        continue
                    }
        
                    const scaleKey = `${sx},${sy},${sz}`
                    if (transformChanged(p, t, q, scaleKey)) {
                        const mat = scaledTransform(t, q, { x: sx, y: sy, z: sz })
                        tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity), mat)
                    }
                }
        
                this.updateGrapple()
        
                // Update PowerUps
                for (const p of this.powerUps) {
                    const powerVisible = this.cullingManager?.isVisible(`powerup:${p.entity}`, [p.pos.x, p.baseY, p.pos.z], 1, 'dynamic') ?? true
                    this.cullingManager?.setEntityVisible(p.entity, powerVisible, `powerup:${p.entity}`)
                    if (!powerVisible) {
                        culledPowerUps += 1
                        p._forceTransformSync = true
                        if (!this.timeStopActive) p.rotation += 0.05
                        continue
                    }
        
                    if (!this.timeStopActive) {
                        p.rotation += 0.05
                    }
                    const q = quatFromEuler(p.rotation, Math.PI / 4, 0)
                    const bob = this.timeStopActive ? 0 : Math.sin(timeSec * 3) * 0.2
                    const t = { x: p.pos.x, y: p.baseY + bob, z: p.pos.z }
        
                    if (transformChanged(p, t, q, 0.5)) {
                        const mat = scaledTransform(t, q, { x: 0.5, y: 0.5, z: 0.5 })
                        tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity), mat)
                    }
                }
        
                // Update Collectibles
                if (!this.timeStopActive) {
                    this.collectibleRotation += 0.05
                }
                if (this.collectibles && this.collectibles.length > 0) {
                    for (let i = this.collectibles.length - 1; i >= 0; i--) {
                        const c = this.collectibles[i]
                        const bobOffset = this.timeStopActive ? 0 : Math.sin(this.collectibleRotation * 2) * 0.2
                        const newY = c.baseY + bobOffset
        
                        if (this.playerMarble) {
                            const pt = this.playerMarble.rigidBody.translation()
                            const dx = pt.x - c.pos.x
                            const dy = pt.y - newY
                            const dz = pt.z - c.pos.z
                            const distSq = dx*dx + dy*dy + dz*dz
                            if (distSq < 2.25) {
                                if (audio.playCollect) audio.playCollect()
        
                                // Combo Logic
                                this.combo = Math.min(10, this.combo + 1)
                                this.comboTimer = now
                                if (this.comboEl) {
                                    this.comboEl.style.display = 'block'
                                    this.comboEl.textContent = `Combo: x${this.combo}`
                                    this.comboEl.style.transform = 'scale(1.2)'
                                    setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
                                }
                                if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'
        
                                // Trigger collection burst effect
                                const collectionPos = { x: c.pos.x, y: newY, z: c.pos.z }
                                const scoreValue = 10
                                const collectibleType = c.type || 'coin'
                                if (typeof this.triggerCollectionEffect === 'function') {
                                    this.triggerCollectionEffect(collectionPos, scoreValue, collectibleType)
                                }
        
                                this.score += 10 * this.combo
                                this.scoreEl.textContent = 'Score: ' + this.score
                                this.collectiblesCollected = (this.collectiblesCollected || 0) + 1
                                this.scene.remove(c.entity)
                                this.engine.destroyEntity(c.entity)
                                this.collectibles.splice(i, 1)
                                continue
                            }
                        }
        
                        const collectibleVisible = this.cullingManager?.isVisible(`collectible:${c.entity}`, [c.pos.x, newY, c.pos.z], 1, 'dynamic') ?? true
                        this.cullingManager?.setEntityVisible(c.entity, collectibleVisible, `collectible:${c.entity}`)
                        if (!collectibleVisible) {
                            culledCollectibles += 1
                            c._forceTransformSync = true
                            continue
                        }
        
                        const q = quatFromEuler(this.collectibleRotation, 0, Math.PI / 4)
                        const t = { x: c.pos.x, y: newY, z: c.pos.z }
        
                        if (transformChanged(c, t, q, 0.5)) {
                            const mat = scaledTransform(t, q, { x: 0.5, y: 0.5, z: 0.5 })
                            tcm.setTransform(getCachedTransformInstance(tcm, c, c.entity), mat)
                        }
                    }
                }
        
                // Combo Timer Logic
                let comboTimeElapsed = now - this.comboTimer
        
                // Adrenaline pauses combo decay if high
                if (this.adrenaline && this.adrenaline > 80) {
                    this.comboTimer = now // Keep resetting it so it never expires
                    comboTimeElapsed = 0
                }
                if (comboTimeElapsed > this.maxComboTime && this.combo > 1) {
                    this.combo = 1
                    if (this.comboEl) {
                        this.comboEl.style.display = 'none'
                        this.comboEl.textContent = `Combo: x${this.combo}`
                    }
                    if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'none'
                    if (this.combobarEl) this.combobarEl.style.width = '0%'
                } else if (this.combo > 1 && this.combobarEl) {
                    const timeRemaining = Math.max(0, this.maxComboTime - comboTimeElapsed)
                    const pct = (timeRemaining / this.maxComboTime) * 100
                    this.combobarEl.style.width = `${pct}%`
                }
        return { culledPowerUps, culledCollectibles }
    }
}

export function applyGameLoopDynamics(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopDynamics.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopDynamics.prototype[name];
        }
    }
}

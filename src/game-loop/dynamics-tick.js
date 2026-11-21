// @ts-check
/** @typedef {import('../types/frame-host.ts').FrameHost} FrameHost */
import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.ts';
import { getLevel } from '../levels/catalog.js';
import { setPrimitiveTransform } from '../zone-setup/primitive-host.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import { getDofConfig } from '../rendering/post-fx-presets.js';
import {
    getCachedTransformInstance,
    transformChanged,
    scaledTransform,
    setColor3IfChanged,
    DOF_CAMERA_MODES,
    DOF_UPDATE_THRESHOLD,
} from './helpers.ts';

export class GameLoopDynamics {
    /** @param {FrameHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {number} now - wall-clock ms
     */
    tickSceneDynamics(now) {
                let culledPowerUps = 0
                let culledCollectibles = 0
                this.game.cullingManager?.beginFrame()
        
                // Update Moving Platforms
                // If time stop is active, we don't advance the timeSec for moving platforms
                if (this.game.timeStopActive) {
                    if (!this.game.lastTimeStopSavedTime) {
                        this.game.lastTimeStopSavedTime = now
                    }
                } else {
                    if (this.game.lastTimeStopSavedTime) {
                        // Adjust a global offset to keep platforms smooth after unpausing
                        if (!this.game.timeStopOffset) this.game.timeStopOffset = 0
                        this.game.timeStopOffset += (now - this.game.lastTimeStopSavedTime)
                        this.game.lastTimeStopSavedTime = null
                    }
                }
        
                const timeSec = (now - (this.game.timeStopOffset || 0)) / 1000
        
                // Cache transform manager once for platform/object/collectible updates
                const tcm = this.game.engine.getTransformManager()
        
                for (const p of this.game.movingPlatforms) {
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
                    const visible = this.game.cullingManager?.isVisible(`moving-platform:${p.entity}`, [x, y, z], radius, 'dynamic') ?? true
                    this.game.cullingManager?.setEntityVisible(p.entity, visible, `moving-platform:${p.entity}`)
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
        
                for (const p of this.game.rotatingPlatforms) {
                    if (!this.game.timeStopActive) {
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
                    const visible = this.game.cullingManager?.isVisible(`rotating-platform:${p.entity}`, [t.x, t.y, t.z], radius, 'dynamic') ?? true
                    this.game.cullingManager?.setEntityVisible(p.entity, visible, `rotating-platform:${p.entity}`)
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
        
                // Level Format v2 movers/spinners/triggers (sim-time driven).
                this.game.zoneScope?.tick(
                    this.game,
                    this.game.simDt ?? 0,
                    (entry, pose) => setPrimitiveTransform(this.game, entry.entity, pose, entry.halfExtents),
                    Boolean(this.game.timeStopActive),
                )

                this.game.updateGrapple()
        
                // Update PowerUps
                for (const p of this.game.powerUps) {
                    const powerVisible = this.game.cullingManager?.isVisible(`powerup:${p.entity}`, [p.pos.x, p.baseY, p.pos.z], 1, 'dynamic') ?? true
                    this.game.cullingManager?.setEntityVisible(p.entity, powerVisible, `powerup:${p.entity}`)
                    if (!powerVisible) {
                        culledPowerUps += 1
                        p._forceTransformSync = true
                        if (!this.game.timeStopActive) p.rotation += 0.05
                        continue
                    }
        
                    if (!this.game.timeStopActive) {
                        p.rotation += 0.05
                    }
                    const q = quatFromEuler(p.rotation, Math.PI / 4, 0)
                    const bob = this.game.timeStopActive ? 0 : Math.sin(timeSec * 3) * 0.2
                    const t = { x: p.pos.x, y: p.baseY + bob, z: p.pos.z }
        
                    if (transformChanged(p, t, q, 0.5)) {
                        const mat = scaledTransform(t, q, { x: 0.5, y: 0.5, z: 0.5 })
                        tcm.setTransform(getCachedTransformInstance(tcm, p, p.entity), mat)
                    }
                }
        
                // Update Collectibles
                if (!this.game.timeStopActive) {
                    this.game.collectibleRotation += 0.05
                }
                if (this.game.collectibles && this.game.collectibles.length > 0) {
                    for (let i = this.game.collectibles.length - 1; i >= 0; i--) {
                        const c = this.game.collectibles[i]
                        if (!c) continue
                        const bobOffset = this.game.timeStopActive ? 0 : Math.sin(this.game.collectibleRotation * 2) * 0.2
                        const newY = c.baseY + bobOffset
        
                        if (this.game.playerMarble) {
                            const pt = this.game.playerMarble.rigidBody.translation()
                            const dx = pt.x - c.pos.x
                            const dy = pt.y - newY
                            const dz = pt.z - c.pos.z
                            const distSq = dx*dx + dy*dy + dz*dz
                            if (distSq < 2.25) {
                                if (audio.playCollect) audio.playCollect()
        
                                // Combo Logic
                                this.game.combo = Math.min(10, this.game.combo + 1)
                                this.game.comboTimer = now
                                if (this.game.comboEl) {
                                    this.game.comboEl.style.display = 'block'
                                    this.game.comboEl.textContent = `Combo: x${this.game.combo}`
                                    this.game.comboEl.style.transform = 'scale(1.2)'
                                    setTimeout(() => { if (this.game.comboEl) this.game.comboEl.style.transform = 'scale(1)' }, 100)
                                }
                                if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'block'
        
                                // Trigger collection burst effect
                                const collectionPos = { x: c.pos.x, y: newY, z: c.pos.z }
                                const scoreValue = c.value ?? 10;
                                const collectibleType = c.type || 'coin';
                                if (typeof this.game.triggerCollectionEffect === 'function') {
                                    this.game.triggerCollectionEffect(collectionPos, scoreValue, collectibleType)
                                }
        
                                this.game.bankedTrickScore = (this.game.bankedTrickScore || 0) + 10
                                this.game.collectiblesCollected = (this.game.collectiblesCollected || 0) + 1
                                this.game.scene.remove(c.entity)
                                this.game.engine.destroyEntity(c.entity)
                                this.game.collectibles.splice(i, 1)
                                continue
                            }
                        }
        
                        const collectibleVisible = this.game.cullingManager?.isVisible(`collectible:${c.entity}`, [c.pos.x, newY, c.pos.z], 1, 'dynamic') ?? true
                        this.game.cullingManager?.setEntityVisible(c.entity, collectibleVisible, `collectible:${c.entity}`)
                        if (!collectibleVisible) {
                            culledCollectibles += 1
                            c._forceTransformSync = true
                            continue
                        }
        
                        const q = quatFromEuler(this.game.collectibleRotation, 0, Math.PI / 4)
                        const t = { x: c.pos.x, y: newY, z: c.pos.z }
        
                        if (transformChanged(c, t, q, 0.5)) {
                            const mat = scaledTransform(t, q, { x: 0.5, y: 0.5, z: 0.5 })
                            tcm.setTransform(getCachedTransformInstance(tcm, c, c.entity), mat)
                        }
                    }
                }
        
                // Combo Timer Logic
                let comboTimeElapsed = now - this.game.comboTimer
        
                // Adrenaline pauses combo decay if high
                if (this.game.adrenaline && this.game.adrenaline > 80) {
                    this.game.comboTimer = now // Keep resetting it so it never expires
                    comboTimeElapsed = 0
                }
                if (comboTimeElapsed > this.game.maxComboTime && this.game.combo > 1) {
                    const bankedTrickScore = this.game.bankedTrickScore ?? 0
                    if (bankedTrickScore > 0) {
                        const finalComboScore = bankedTrickScore * this.game.combo
                        this.game.score += finalComboScore
                        if (this.game.scoreEl) this.game.scoreEl.textContent = 'Score: ' + this.game.score

                        if (typeof this.game.showTrickMessage === 'function') {
                            this.game.showTrickMessage(`Combo Landed! +${finalComboScore}`, '#00ff00')
                        }
                    }

                    this.game.combo = 1
                    this.game.bankedTrickScore = 0
                    if (this.game.comboEl) {
                        this.game.comboEl.style.display = 'none'
                        this.game.comboEl.textContent = `Combo: x${this.game.combo}`
                    }
                    if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'none'
                    if (this.game.combobarEl) this.game.combobarEl.style.width = '0%'
                } else if (this.game.combo > 1 && this.game.combobarEl) {
                    const timeRemaining = Math.max(0, this.game.maxComboTime - comboTimeElapsed)
                    const pct = (timeRemaining / this.game.maxComboTime) * 100
                    this.game.combobarEl.style.width = `${pct}%`
                }
        return { culledPowerUps, culledCollectibles }
    }
}

// @ts-check
import { audio } from '../audio.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class GameLoopFrameInput {
    /** @param {GameMixinHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {number} now
     * @param {boolean} shouldUpdateHUD
     * @param {number} frameDeltaSec
     * @param {number} rotSpeed
     * @param {number} zoomSpeed
     */
    tickFrameInput(now, shouldUpdateHUD, frameDeltaSec, rotSpeed, zoomSpeed) {
                // Per-frame rates below are tuned per 1/60 s: `meter` scales
                // charge/energy meters by wall time, `step` scales continuous
                // impulses by the simulated time this frame's physics covers.
                const meter = frameDeltaSec * 60
                const step = (this.game.simDt ?? 1 / 60) * 60

                if (this.game.keys['KeyR']) {
                    this.game.respawnToLastCheckpoint()
                    this.game.keys['KeyR'] = false // Debounce key press
                }
                if (this.game.keys['KeyM'] && this.game.currentLevel) {
                    this.game.returnToMenu()
                }
        
                if (this.game.keys['BracketLeft']) {
                    const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
                    audio.setVolume(currentVol - 0.1)
                    this.game.keys['BracketLeft'] = false
                }
                if (this.game.keys['BracketRight']) {
                    const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
                    audio.setVolume(currentVol + 0.1)
                    this.game.keys['BracketRight'] = false
                }
                if (this.game.keys['KeyN']) {
                    audio.init()
                    const muted = audio.toggleMute()
                    if (this.game.muteBtn) {
                        this.game.muteBtn.textContent = muted ? '🔇' : '🔊'
                        this.game.muteBtn.classList.toggle('muted', muted)
                    }
                    this.game.keys['KeyN'] = false
                }
        
                if (this.game.cameraMode === 'orbit') {
                    if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) this.game.targetCamAngle -= rotSpeed
                    if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) this.game.targetCamAngle += rotSpeed
                    if (this.game.keys['ArrowUp'] || this.game.keys['KeyW']) this.game.targetCamRadius = Math.max(5, this.game.targetCamRadius - zoomSpeed)
                    if (this.game.keys['ArrowDown'] || this.game.keys['KeyS']) this.game.targetCamRadius = Math.min(100, this.game.targetCamRadius + zoomSpeed)
        
                    // Lerp actual values to targets for smooth movement
                    this.game.camAngle += (this.game.targetCamAngle - this.game.camAngle) * 0.1
                    this.game.camRadius += (this.game.targetCamRadius - this.game.camRadius) * 0.1
                    this.game.camHeight += (this.game.targetCamHeight - this.game.camHeight) * 0.1
                } else if (this.game.cameraMode === 'follow' || this.game.cameraMode === 'action' || this.game.cameraMode === 'fpv' || this.game.cameraMode === 'topdown' || this.game.cameraMode === 'cinematic' || this.game.cameraMode === 'side-scroller' || this.game.cameraMode === 'drone') {
                    let impulseStrength = 0.5 * step
                    if (this.game.activeEffects.speed && Date.now() < this.game.activeEffects.speed) {
                        impulseStrength *= 2.0
                    }
        
                    if (this.game.playerMarble) {
                        const rigidBody = this.game.playerMarble.rigidBody
        
                        let forwardX = Math.sin(this.game.aimYaw)
                        let forwardZ = Math.cos(this.game.aimYaw)
                        let rightX = Math.sin(this.game.aimYaw - Math.PI / 2)
                        let rightZ = Math.cos(this.game.aimYaw - Math.PI / 2)
        
                        if (this.game.cameraMode === 'side-scroller') {
                            // Lock movement to the Z axis for left/right and X axis for up/down in side-scroller view
                            forwardX = -1; forwardZ = 0;
                            rightX = 0; rightZ = -1;
                        }
        
                        if (this.game.keys['ArrowUp'] || this.game.keys['KeyW']) rigidBody.applyImpulse({ x: forwardX * impulseStrength, y: 0, z: forwardZ * impulseStrength }, true)
                        if (this.game.keys['ArrowDown'] || this.game.keys['KeyS']) rigidBody.applyImpulse({ x: -forwardX * impulseStrength, y: 0, z: -forwardZ * impulseStrength }, true)
                        if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) rigidBody.applyImpulse({ x: rightX * impulseStrength, y: 0, z: rightZ * impulseStrength }, true)
                        if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) rigidBody.applyImpulse({ x: -rightX * impulseStrength, y: 0, z: -rightZ * impulseStrength }, true)
                    }
                }
        

                // Air dash edge detection via Ability System and Keys
                const airDashCode = 'KeyQ';
                const isAirDashKeyPressed = this.game.keys[airDashCode];
                const wasAirDashKeyPressed = this.game._lastAirDashKeyPressed;
                // Charge abilities (air dash, dash, stomp): edge-detected from the
                // held keys by their registry entries (src/abilities/registry.js).
                this.game.abilitySystem?.tickChargeInputs(now)

                // Shift is the dash now; the legacy boost bar shows its cooldown.
                if (shouldUpdateHUD && this.game.boostBarEl) {
                    const timeSince = now - (this.game.lastDashTime || 0)
                    const progress = Math.min(1.0, timeSince / (this.game.dashCooldown || 1500))
                    this.game.boostBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.game.boostBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f0f)'
                    } else {
                       this.game.boostBarEl.style.filter = 'brightness(0.7)'
                    }
                }
        
                if (this.game.isChargingDash) {
                    // Increment charge - roughly 1.5 seconds to fully charge
                    this.game.dashCharge = Math.min(this.game.maxDashCharge, this.game.dashCharge + (frameDeltaSec * 0.66))
                }

                if (shouldUpdateHUD && this.game.dashBarEl) {
                    if (this.game.isChargingDash) {
                        this.game.dashBarEl.style.width = `${this.game.dashCharge * 100}%`
                        if (this.game.dashCharge >= this.game.maxDashCharge) {
                            this.game.dashBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #ff0000)'
                            this.game.dashBarEl.style.backgroundColor = '#ff0000'
                        } else {
                            this.game.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                            this.game.dashBarEl.style.backgroundColor = '#ff8c00'
                        }
                    } else {
                        const timeSince = now - this.game.lastDashTime
                        const progress = Math.min(1.0, timeSince / this.game.dashCooldown)
                        this.game.dashBarEl.style.width = `${progress * 100}%`
                        this.game.dashBarEl.style.backgroundColor = '#ff8c00'
                        if (progress >= 1.0) {
                           this.game.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                        } else {
                           this.game.dashBarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }
        
                if (shouldUpdateHUD && this.game.airDashBarEl) {
                    if (this.game.isChargingAirDash) {
                        const chargeDuration = now - (this.game.airDashChargeTime || now)
                        // Fully charged at ~700ms based on force scaling up to 55.0 at 0.08 per ms. 55 / 0.08 = 687.5ms
                        const maxChargeMs = 700.0
                        const chargeRatio = Math.min(1.0, chargeDuration / maxChargeMs)
                        this.game.airDashBarEl.style.width = `${chargeRatio * 100}%`

                        if (chargeRatio >= 1.0) {
                            this.game.airDashBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #00ffff)'
                            this.game.airDashBarEl.style.backgroundColor = '#ffffff'
                        } else {
                            this.game.airDashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                            this.game.airDashBarEl.style.backgroundColor = '#00ffff'
                        }
                    } else {
                        const timeSince = now - (this.game.lastAirDashTime || 0)
                        const progress = Math.min(1.0, timeSince / (this.game.airDashCooldown || 2000))
                        this.game.airDashBarEl.style.width = `${progress * 100}%`
                        this.game.airDashBarEl.style.backgroundColor = '#00ffff'
                        if (progress >= 1.0) {
                            this.game.airDashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                        } else {
                            this.game.airDashBarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }

                if (this.game.isChargingJump) {
                    this.game.jumpCharge = Math.min(1.0, this.game.jumpCharge + 0.03 * meter)
                    if (this.game.jumpBarEl) this.game.jumpBarEl.style.width = `${this.game.jumpCharge * 100}%`
                }

                if (shouldUpdateHUD && this.game.groundslambarEl) {
                    if (this.game.isChargingShockwave) {
                        const chargeDuration = now - (this.game.shockwaveChargeTime || now)
                        // Max charge at 1000ms
                        const chargeRatio = Math.min(1.0, chargeDuration / 1000.0)
                        this.game.groundslambarEl.style.width = `${chargeRatio * 100}%`

                        if (chargeRatio >= 1.0) {
                            this.game.groundslambarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #ff00ff)'
                            this.game.groundslambarEl.style.backgroundColor = '#ffffff'
                        } else {
                            this.game.groundslambarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff00ff)'
                            this.game.groundslambarEl.style.backgroundColor = '#ff00ff'
                        }
                    } else {
                        const timeSince = now - (this.game.lastShockwaveTime || 0)
                        const progress = Math.min(1.0, timeSince / (this.game.shockwaveCooldown || 3000))
                        this.game.groundslambarEl.style.width = `${progress * 100}%`
                        this.game.groundslambarEl.style.backgroundColor = '#ff00ff'
                        if (progress >= 1.0) {
                            this.game.groundslambarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff00ff)'
                        } else {
                            this.game.groundslambarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }
        
                if (this.game.charging) {
                    this.game.chargePower = Math.min(1.0, this.game.chargePower + 0.015 * meter)
                }
        
                if (!this.game.levelComplete && this.game.levelStartTime && shouldUpdateHUD) {
                    const time = ((now - this.game.levelStartTime) / 1000).toFixed(2)
                    if (this.game.timerEl) this.game.timerEl.textContent = `Time: ${time}s`
                }
        
                if (this.game.magnetActive && this.game.magnetPower > 0 && this.game.playerMarble) {
                    this.game.magnetPower = Math.max(0, this.game.magnetPower - 0.005 * meter)
        
                    const pt = this.game.playerMarble.rigidBody.translation()
                    const range = 20.0
                    const rangeSq = range * range
                    const forceStrength = 150.0
                    const physics = getMarblePhysics()
                    const repelSign = this.game.magnetMode === 'repel' ? -1 : 1
        
                    /** @type {{ body: import('@dimforge/rapier3d-compat').RigidBody, pos: { x: number, y: number, z: number } }[]} */
                    const targets = []
                    /** @param {import('@dimforge/rapier3d-compat').RigidBody} body */
                    const considerBody = (body) => {
                        const bt = body.translation()
                        const dx = pt.x - bt.x
                        const dy = pt.y - bt.y
                        const dz = pt.z - bt.z
                        const distSq = dx * dx + dy * dy + dz * dz
                        if (distSq > 0.25 && distSq < rangeSq) {
                            targets.push({ body, pos: bt })
                        }
                    }
        
                    for (const m of this.game.marbles) {
                        if (m !== this.game.playerMarble) considerBody(m.rigidBody)
                    }
                    for (const obj of this.game.dynamicObjects) {
                        considerBody(obj.rigidBody)
                    }
        
                    if (targets.length > FORCE_BATCH_THRESHOLD) {
                        if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(128)
                        const buf = this.game._forceBatchBuffers
                        buf.ensure(targets.length)
        
                        for (const [i, { pos: p }] of targets.entries()) {
                            const base = i * 3
                            buf.positions[base] = p.x
                            buf.positions[base + 1] = p.y
                            buf.positions[base + 2] = p.z
                            buf.strengths[i] = forceStrength
                        }
        
                        physics.computeForceFieldsBatch(
                            buf.positions, buf.strengths, buf.forces, targets.length,
                            pt.x, pt.y, pt.z,
                            2.0, 0.5, range, 1.0
                        )
        
                        for (const [i, { body }] of targets.entries()) {
                            const base = i * 3
                            body.applyImpulse({
                                x: (buf.forces[base] ?? 0) * repelSign * step,
                                y: (buf.forces[base + 1] ?? 0) * repelSign * step,
                                z: (buf.forces[base + 2] ?? 0) * repelSign * step
                            }, true)
                        }
                    } else {
                        if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(16)
                        const scalarBuf = this.game._forceBatchBuffers.forces
                        for (const { body, pos: bt } of targets) {
                            physics.computeForceFieldInto(
                                scalarBuf,
                                pt.x, pt.y, pt.z,
                                bt.x, bt.y, bt.z,
                                forceStrength, 2.0, 0.5, range, 1.0
                            )
                            body.applyImpulse({
                                x: scalarBuf[0] * repelSign * step,
                                y: scalarBuf[1] * repelSign * step,
                                z: scalarBuf[2] * repelSign * step
                            }, true)
                        }
                    }
        
                } else if (!this.game.magnetActive && this.game.magnetPower < 1.0) {
                    this.game.magnetPower = Math.min(1.0, this.game.magnetPower + 0.002 * meter)
                }
        
                if (shouldUpdateHUD && this.game.magnetBarEl) {
                    this.game.magnetBarEl.style.width = `${this.game.magnetPower * 100}%`
                    if (this.game.magnetActive) {
                        const color = this.game.magnetMode === 'attract' ? '#00ffff' : '#ff00ff'
                        this.game.magnetBarEl.style.background = color
                        this.game.magnetBarEl.style.boxShadow = `0 0 10px ${color}`
                    } else {
                        this.game.magnetBarEl.style.background = 'linear-gradient(90deg, #00ffff 0%, #ff00ff 100%)'
                        this.game.magnetBarEl.style.boxShadow = 'none'
                    }
                }
        
                if (shouldUpdateHUD) {
                    const yawDeg = Math.round(this.game.aimYaw * 180 / Math.PI)
                    const pitchDeg = Math.round(this.game.pitchAngle * 180 / Math.PI)
                    this.game.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`
                    this.game.powerbarEl.style.width = `${this.game.chargePower * 100}%`
                }
    }
}

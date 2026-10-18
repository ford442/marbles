// @ts-check
import { audio } from '../audio.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class GameLoopFrameInput {
    /**
     * @this {GameMixinHost}
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
                const step = (this.simDt ?? 1 / 60) * 60

                if (this.keys['KeyR']) {
                    this.respawnToLastCheckpoint()
                    this.keys['KeyR'] = false // Debounce key press
                }
                if (this.keys['KeyM'] && this.currentLevel) {
                    this.returnToMenu()
                }
        
                if (this.keys['BracketLeft']) {
                    const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
                    audio.setVolume(currentVol - 0.1)
                    this.keys['BracketLeft'] = false
                }
                if (this.keys['BracketRight']) {
                    const currentVol = audio.masterGain ? audio.masterGain.gain.value : 0.4
                    audio.setVolume(currentVol + 0.1)
                    this.keys['BracketRight'] = false
                }
                if (this.keys['KeyN']) {
                    audio.init()
                    const muted = audio.toggleMute()
                    if (this.muteBtn) {
                        this.muteBtn.textContent = muted ? '🔇' : '🔊'
                        this.muteBtn.classList.toggle('muted', muted)
                    }
                    this.keys['KeyN'] = false
                }
        
                if (this.cameraMode === 'orbit') {
                    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.targetCamAngle -= rotSpeed
                    if (this.keys['ArrowRight'] || this.keys['KeyD']) this.targetCamAngle += rotSpeed
                    if (this.keys['ArrowUp'] || this.keys['KeyW']) this.targetCamRadius = Math.max(5, this.targetCamRadius - zoomSpeed)
                    if (this.keys['ArrowDown'] || this.keys['KeyS']) this.targetCamRadius = Math.min(100, this.targetCamRadius + zoomSpeed)
        
                    // Lerp actual values to targets for smooth movement
                    this.camAngle += (this.targetCamAngle - this.camAngle) * 0.1
                    this.camRadius += (this.targetCamRadius - this.camRadius) * 0.1
                    this.camHeight += (this.targetCamHeight - this.camHeight) * 0.1
                } else if (this.cameraMode === 'follow' || this.cameraMode === 'action' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown' || this.cameraMode === 'cinematic' || this.cameraMode === 'side-scroller' || this.cameraMode === 'drone') {
                    let impulseStrength = 0.5 * step
                    if (this.activeEffects.speed && Date.now() < this.activeEffects.speed) {
                        impulseStrength *= 2.0
                    }
        
                    if (this.playerMarble) {
                        const rigidBody = this.playerMarble.rigidBody
        
                        let forwardX = Math.sin(this.aimYaw)
                        let forwardZ = Math.cos(this.aimYaw)
                        let rightX = Math.sin(this.aimYaw - Math.PI / 2)
                        let rightZ = Math.cos(this.aimYaw - Math.PI / 2)
        
                        if (this.cameraMode === 'side-scroller') {
                            // Lock movement to the Z axis for left/right and X axis for up/down in side-scroller view
                            forwardX = -1; forwardZ = 0;
                            rightX = 0; rightZ = -1;
                        }
        
                        if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: forwardX * impulseStrength, y: 0, z: forwardZ * impulseStrength }, true)
                        if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: -forwardX * impulseStrength, y: 0, z: -forwardZ * impulseStrength }, true)
                        if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: rightX * impulseStrength, y: 0, z: rightZ * impulseStrength }, true)
                        if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: -rightX * impulseStrength, y: 0, z: -rightZ * impulseStrength }, true)
                    }
                }
        

                // Hover edge detection via Ability System and Keys
                const hoverCode = 'KeyH';
                const isHoverKeyPressed = this.keys[hoverCode];
                const wasHoverKeyPressed = this._lastHoverKeyPressed;

                if (isHoverKeyPressed && !wasHoverKeyPressed) {
                    if (this.abilitySystem?.isEnabled('hover') !== false && this.playerMarble && !this.isHovering) {
                        if (now - (this.lastHoverTime || 0) > (this.hoverCooldown || 3000)) {
                            if (typeof this.beginHoverCharge === 'function') {
                                this.beginHoverCharge(now);
                            }
                        }
                    }
                } else if (!isHoverKeyPressed && wasHoverKeyPressed) {
                    if (this.isHovering && this.playerMarble) {
                        if (typeof this.releaseHover === 'function') {
                            this.releaseHover(now);
                        }
                    }
                } else if (isHoverKeyPressed && this.isHovering) {
                    if (typeof this.updateHover === 'function') {
                        this.updateHover(now, frameDeltaSec);
                    }
                }
                this._lastHoverKeyPressed = isHoverKeyPressed;

                if (shouldUpdateHUD && this.hoverBarEl) {
                    if (this.isHovering) {
                        this.hoverBarEl.style.width = `${(this.hoverCharge || 0) * 100}%`
                        this.hoverBarEl.style.backgroundColor = '#00ff00'
                        this.hoverBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #00ff00)'
                    } else {
                        const timeSince = now - (this.lastHoverTime || 0)
                        const progress = Math.min(1.0, timeSince / (this.hoverCooldown || 3000))
                        this.hoverBarEl.style.width = `${progress * 100}%`
                        this.hoverBarEl.style.backgroundColor = '#00ff00'
                        if (progress >= 1.0) {
                            this.hoverBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ff00)'
                        } else {
                            this.hoverBarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }

                // Air dash edge detection via Ability System and Keys
                const airDashCode = 'KeyQ';
                const isAirDashKeyPressed = this.keys[airDashCode];
                const wasAirDashKeyPressed = this._lastAirDashKeyPressed;
                // Charge abilities (air dash, dash, stomp): edge-detected from the
                // held keys by their registry entries (src/abilities/registry.js).
                this.abilitySystem?.tickChargeInputs(now)

                // Shift is the dash now; the legacy boost bar shows its cooldown.
                if (shouldUpdateHUD && this.boostBarEl) {
                    const timeSince = now - (this.lastDashTime || 0)
                    const progress = Math.min(1.0, timeSince / (this.dashCooldown || 1500))
                    this.boostBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.boostBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f0f)'
                    } else {
                       this.boostBarEl.style.filter = 'brightness(0.7)'
                    }
                }
        
                if (this.isChargingDash) {
                    // Increment charge - roughly 1.5 seconds to fully charge
                    this.dashCharge = Math.min(this.maxDashCharge, this.dashCharge + (frameDeltaSec * 0.66))
                }

                if (shouldUpdateHUD && this.dashBarEl) {
                    if (this.isChargingDash) {
                        this.dashBarEl.style.width = `${this.dashCharge * 100}%`
                        if (this.dashCharge >= this.maxDashCharge) {
                            this.dashBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #ff0000)'
                            this.dashBarEl.style.backgroundColor = '#ff0000'
                        } else {
                            this.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                            this.dashBarEl.style.backgroundColor = '#ff8c00'
                        }
                    } else {
                        const timeSince = now - this.lastDashTime
                        const progress = Math.min(1.0, timeSince / this.dashCooldown)
                        this.dashBarEl.style.width = `${progress * 100}%`
                        this.dashBarEl.style.backgroundColor = '#ff8c00'
                        if (progress >= 1.0) {
                           this.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
                        } else {
                           this.dashBarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }
        
                if (shouldUpdateHUD && this.airDashBarEl) {
                    if (this.isChargingAirDash) {
                        const chargeDuration = now - (this.airDashChargeTime || now)
                        // Fully charged at ~700ms based on force scaling up to 55.0 at 0.08 per ms. 55 / 0.08 = 687.5ms
                        const maxChargeMs = 700.0
                        const chargeRatio = Math.min(1.0, chargeDuration / maxChargeMs)
                        this.airDashBarEl.style.width = `${chargeRatio * 100}%`

                        if (chargeRatio >= 1.0) {
                            this.airDashBarEl.style.filter = 'brightness(1.5) drop-shadow(0 0 10px #00ffff)'
                            this.airDashBarEl.style.backgroundColor = '#ffffff'
                        } else {
                            this.airDashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                            this.airDashBarEl.style.backgroundColor = '#00ffff'
                        }
                    } else {
                        const timeSince = now - (this.lastAirDashTime || 0)
                        const progress = Math.min(1.0, timeSince / (this.airDashCooldown || 2000))
                        this.airDashBarEl.style.width = `${progress * 100}%`
                        this.airDashBarEl.style.backgroundColor = '#00ffff'
                        if (progress >= 1.0) {
                            this.airDashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                        } else {
                            this.airDashBarEl.style.filter = 'brightness(0.7)'
                        }
                    }
                }

                if (this.isChargingJump) {
                    this.jumpCharge = Math.min(1.0, this.jumpCharge + 0.03 * meter)
                    if (this.jumpBarEl) this.jumpBarEl.style.width = `${this.jumpCharge * 100}%`
                }
        
                if (this.charging) {
                    this.chargePower = Math.min(1.0, this.chargePower + 0.015 * meter)
                }
        
                if (!this.levelComplete && this.levelStartTime && shouldUpdateHUD) {
                    const time = ((now - this.levelStartTime) / 1000).toFixed(2)
                    if (this.timerEl) this.timerEl.textContent = `Time: ${time}s`
                }
        
                if (this.magnetActive && this.magnetPower > 0 && this.playerMarble) {
                    this.magnetPower = Math.max(0, this.magnetPower - 0.005 * meter)
        
                    const pt = this.playerMarble.rigidBody.translation()
                    const range = 20.0
                    const rangeSq = range * range
                    const forceStrength = 150.0
                    const physics = getMarblePhysics()
                    const repelSign = this.magnetMode === 'repel' ? -1 : 1
        
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
        
                    for (const m of this.marbles) {
                        if (m !== this.playerMarble) considerBody(m.rigidBody)
                    }
                    for (const obj of this.dynamicObjects) {
                        considerBody(obj.rigidBody)
                    }
        
                    if (targets.length > FORCE_BATCH_THRESHOLD) {
                        if (!this._forceBatchBuffers) this._forceBatchBuffers = new PhysicsBatchBuffers(128)
                        const buf = this._forceBatchBuffers
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
                        if (!this._forceBatchBuffers) this._forceBatchBuffers = new PhysicsBatchBuffers(16)
                        const scalarBuf = this._forceBatchBuffers.forces
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
        
                } else if (!this.magnetActive && this.magnetPower < 1.0) {
                    this.magnetPower = Math.min(1.0, this.magnetPower + 0.002 * meter)
                }
        
                if (shouldUpdateHUD && this.magnetBarEl) {
                    this.magnetBarEl.style.width = `${this.magnetPower * 100}%`
                    if (this.magnetActive) {
                        const color = this.magnetMode === 'attract' ? '#00ffff' : '#ff00ff'
                        this.magnetBarEl.style.background = color
                        this.magnetBarEl.style.boxShadow = `0 0 10px ${color}`
                    } else {
                        this.magnetBarEl.style.background = 'linear-gradient(90deg, #00ffff 0%, #ff00ff 100%)'
                        this.magnetBarEl.style.boxShadow = 'none'
                    }
                }
        
                if (shouldUpdateHUD) {
                    const yawDeg = Math.round(this.aimYaw * 180 / Math.PI)
                    const pitchDeg = Math.round(this.pitchAngle * 180 / Math.PI)
                    this.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`
                    this.powerbarEl.style.width = `${this.chargePower * 100}%`
                }
    }
}

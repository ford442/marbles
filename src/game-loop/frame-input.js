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

export class GameLoopFrameInput {
    tickFrameInput(now, shouldUpdateHUD, frameDeltaSec, rotSpeed, zoomSpeed) {
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
                    let impulseStrength = 0.5
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
        
                if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                    if (this.playerMarble && now - this.lastBoostTime > this.boostCooldown) {
                        const force = 60.0
                        const boostYaw = this.aimYaw
                        const dirX = Math.sin(boostYaw)
                        const dirZ = Math.cos(boostYaw)
        
                        this.playerMarble.rigidBody.applyImpulse({
                            x: dirX * force,
                            y: 0,
                            z: dirZ * force
                        }, true)
        
                        this.lastBoostTime = now
                        audio.playBoost()
        
                        if (this.hudManager) this.hudManager.markAbilityUsed('boost')
                    }
                }
        
                if (shouldUpdateHUD && this.boostBarEl) {
                    const timeSince = now - this.lastBoostTime
                    const progress = Math.min(1.0, timeSince / this.boostCooldown)
                    this.boostBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.boostBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f0f)'
                    } else {
                       this.boostBarEl.style.filter = 'brightness(0.7)'
                    }
                }
        
                if (shouldUpdateHUD && this.dashBarEl) {
                    if (this.isChargingDash) {
                        // Increment charge - roughly 1.5 seconds to fully charge
                        this.dashCharge = Math.min(this.maxDashCharge, this.dashCharge + (frameDeltaSec * 0.66))
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
        
                if (this.isChargingJump) {
                    this.jumpCharge = Math.min(1.0, this.jumpCharge + 0.03)
                    if (this.jumpBarEl) this.jumpBarEl.style.width = `${this.jumpCharge * 100}%`
                }
        
                if (this.charging) {
                    this.chargePower = Math.min(1.0, this.chargePower + 0.015)
                }
        
                if (!this.levelComplete && this.levelStartTime && shouldUpdateHUD) {
                    const time = ((now - this.levelStartTime) / 1000).toFixed(2)
                    if (this.timerEl) this.timerEl.textContent = `Time: ${time}s`
                }
        
                if (this.magnetActive && this.magnetPower > 0 && this.playerMarble) {
                    this.magnetPower = Math.max(0, this.magnetPower - 0.005)
        
                    const pt = this.playerMarble.rigidBody.translation()
                    const range = 20.0
                    const rangeSq = range * range
                    const forceStrength = 150.0
                    const physics = getMarblePhysics()
                    const repelSign = this.magnetMode === 'repel' ? -1 : 1
        
                    const targets = []
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
        
                        for (let i = 0; i < targets.length; i++) {
                            const base = i * 3
                            const p = targets[i].pos
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
        
                        for (let i = 0; i < targets.length; i++) {
                            const base = i * 3
                            targets[i].body.applyImpulse({
                                x: buf.forces[base] * repelSign,
                                y: buf.forces[base + 1] * repelSign,
                                z: buf.forces[base + 2] * repelSign
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
                                x: scalarBuf[0] * repelSign,
                                y: scalarBuf[1] * repelSign,
                                z: scalarBuf[2] * repelSign
                            }, true)
                        }
                    }
        
                } else if (!this.magnetActive && this.magnetPower < 1.0) {
                    this.magnetPower = Math.min(1.0, this.magnetPower + 0.002)
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

export function applyGameLoopFrameInput(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopFrameInput.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopFrameInput.prototype[name];
        }
    }
}

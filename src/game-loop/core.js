import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.js';
import { LEVELS } from '../levels.js';

export class GameLoopRenderCore {
    renderAndSync() {
        // Cache timestamp once per frame for reuse throughout renderAndSync
        const now = Date.now()
        const INITIAL_FRAME_DELTA_SEC = 1 / 60
        const frameDeltaSec = this._lastRenderTick ? (now - this._lastRenderTick) / 1000 : INITIAL_FRAME_DELTA_SEC
        this._lastRenderTick = now
        const FOV_CHANGE_THRESHOLD = 0.25
        const ASPECT_CHANGE_THRESHOLD = 0.001
        // Throttle HUD CSS style updates to ~10Hz to reduce layout/paint overhead
        const shouldUpdateHUD = (now - (this._lastHudStyleUpdate || 0)) >= 100
        if (shouldUpdateHUD) this._lastHudStyleUpdate = now
        const rotSpeed = 0.02
        const zoomSpeed = 0.5

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
                let boostYaw = this.aimYaw
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
            const forceStrength = 150.0

            const applyMagnetForce = (body) => {
                const bt = body.translation()
                const dx = pt.x - bt.x
                const dy = pt.y - bt.y
                const dz = pt.z - bt.z
                const dist = Math.hypot(dx, dy, dz)

                if (dist > 0.5 && dist < range) {
                    const factor = forceStrength / (dist * dist + 1.0)

                    const dirX = dx / dist
                    const dirY = dy / dist
                    const dirZ = dz / dist

                    let fx = dirX * factor
                    let fy = dirY * factor
                    let fz = dirZ * factor

                    if (this.magnetMode === 'repel') {
                        fx = -fx
                        fy = -fy
                        fz = -fz
                    }

                    body.applyImpulse({ x: fx, y: fy, z: fz }, true)
                }
            }

            for (const m of this.marbles) {
                if (m !== this.playerMarble) {
                    applyMagnetForce(m.rigidBody)
                }
            }
            for (const obj of this.dynamicObjects) {
                applyMagnetForce(obj.rigidBody)
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

        if (this.view && (this.cameraMode !== 'cinematic' || !this.currentLevel) && this._dofEnabled === true) {
            try { this.view.setDepthOfFieldOptions({ enabled: false }) } catch (e) { /* not supported */ }
            this._dofEnabled = false
            this._dofFocusDistance = null
        }

        if ((this.cameraMode === 'follow' || this.cameraMode === 'action' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown' || this.cameraMode === 'cinematic' || this.cameraMode === 'side-scroller' || this.cameraMode === 'drone') && this.currentLevel) {
            const level = LEVELS[this.currentLevel]
            const target = this.playerMarble || this.getLeader()
            if (target) {
                const t = target.rigidBody.translation()
                if (this.cameraMode === 'follow' || this.cameraMode === 'action') {
                    const height = level?.camera?.height || 10

                    const linvel = target.rigidBody.linvel()
                    const speed = Math.hypot(linvel.x, linvel.z)

                    // Dynamic Distance Scaling
                    const baseDist = this.followDist || 20
                    let dist = baseDist + Math.min(speed * 0.5, 15.0)

                    let currentHeight = height;
                    if (this.cameraMode === 'action') {
                        // Action camera gets lower and closer when fast
                        const speedFactor = Math.min(speed / 30.0, 1.0)
                        currentHeight = height * (1.0 - speedFactor * 0.6)
                        dist = baseDist * (1.0 - speedFactor * 0.3)
                    }

                    // Predictive Look-Ahead
                    let lookAheadFactor = Math.min(speed * 0.15, 8.0)
                    if (this.cameraMode === 'action') {
                        lookAheadFactor = Math.min(speed * 0.3, 15.0) // Look further ahead in action mode
                    }
                    const normVx = speed > 0.1 ? linvel.x / speed : 0
                    const normVz = speed > 0.1 ? linvel.z / speed : 0
                    const idealLookAtX = t.x + normVx * lookAheadFactor
                    const idealLookAtY = t.y
                    const idealLookAtZ = t.z + normVz * lookAheadFactor

                    // Calculate ideal eye position
                    let idealEyeX = t.x - Math.sin(this.aimYaw) * dist
                    let idealEyeY = t.y + currentHeight
                    let idealEyeZ = t.z - Math.cos(this.aimYaw) * dist

                    // Camera Collision Avoidance
                    if (this.world && typeof RAPIER !== 'undefined') {
                        const dx = idealEyeX - t.x
                        const dy = idealEyeY - t.y
                        const dz = idealEyeZ - t.z
                        const distToEye = Math.hypot(dx, dy, dz)
                        const rayDir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }

                        const r = target.scale * 0.5 || 0.5
                        const startDist = r + 0.1
                        const rayOrigin = {
                            x: t.x + rayDir.x * startDist,
                            y: t.y + rayDir.y * startDist,
                            z: t.z + rayDir.z * startDist
                        }

                        const ray = new RAPIER.Ray(rayOrigin, rayDir)

                        const maxRayDist = Math.max(0.01, distToEye - startDist)
                        const hit = this.world.castRay(ray, maxRayDist, false)
                        if (hit) {
                            const otherBody = hit.collider.parent()
                            if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
                                const safeDist = hit.toi - 0.2
                                if (safeDist > 0) {
                                    idealEyeX = rayOrigin.x + rayDir.x * safeDist
                                    idealEyeY = rayOrigin.y + rayDir.y * safeDist
                                    idealEyeZ = rayOrigin.z + rayDir.z * safeDist
                                } else {
                                    idealEyeX = rayOrigin.x
                                    idealEyeY = rayOrigin.y
                                    idealEyeZ = rayOrigin.z
                                }
                            }
                        }
                    }

                    if (!this.cameraFollowPos) {
                        this.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                        this.cameraFollowLookAt = { x: idealLookAtX, y: idealLookAtY, z: idealLookAtZ }
                    } else {
                        // Smoothly interpolate (Lerp) towards ideal positions
                        const lerpFactorPos = 0.1
                        const lerpFactorLook = 0.2
                        this.cameraFollowPos.x += (idealEyeX - this.cameraFollowPos.x) * lerpFactorPos
                        this.cameraFollowPos.y += (idealEyeY - this.cameraFollowPos.y) * lerpFactorPos
                        this.cameraFollowPos.z += (idealEyeZ - this.cameraFollowPos.z) * lerpFactorPos

                        this.cameraFollowLookAt.x += (idealLookAtX - this.cameraFollowLookAt.x) * lerpFactorLook
                        this.cameraFollowLookAt.y += (idealLookAtY - this.cameraFollowLookAt.y) * lerpFactorLook
                        this.cameraFollowLookAt.z += (idealLookAtZ - this.cameraFollowLookAt.z) * lerpFactorLook
                    }

                    const eyeX = this.cameraFollowPos.x + this.cameraShake.x
                    const eyeY = this.cameraFollowPos.y + this.cameraShake.y
                    const eyeZ = this.cameraFollowPos.z + this.cameraShake.z

                    this.camera.lookAt([eyeX, eyeY, eyeZ], [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z], [0, 1, 0])

                    // Dynamic FOV scaling based on speed
                    const baseFov = this.currentFov || 45
                    const targetFov = baseFov + Math.min(speed * 0.5, 20.0)
                    this.activeFov = this.activeFov || baseFov
                    this.activeFov += (targetFov - this.activeFov) * 0.1

                    if (this.view && this.camera && this.Filament) {
                        const width = this.canvas.width;
                        const height = this.canvas.height;
                        const aspect = width / height;
                        const CameraFov = this.Filament?.['Camera$Fov'];
                        const fovMode = CameraFov ? CameraFov.VERTICAL : 0;
                        const fovChanged = this._lastSetFov === undefined || Math.abs(this.activeFov - this._lastSetFov) > FOV_CHANGE_THRESHOLD
                        const aspectChanged = this._lastSetProjectionAspect === undefined || Math.abs(aspect - this._lastSetProjectionAspect) > ASPECT_CHANGE_THRESHOLD
                        if (fovChanged || aspectChanged) {
                            this.camera.setProjectionFov(this.activeFov, aspect, 0.1, 1000.0, fovMode);
                            this._lastSetFov = this.activeFov
                            this._lastSetProjectionAspect = aspect
                        }
                    }
                } else if (this.cameraMode === 'fpv') {
                    const r = target.scale * 0.5 || 0.5
                    const eyeX = t.x + this.cameraShake.x
                    const eyeY = t.y + r + 0.1 + this.cameraShake.y
                    const eyeZ = t.z + this.cameraShake.z

                    const cosP = Math.cos(this.pitchAngle)
                    const sinP = Math.sin(this.pitchAngle)
                    const dirX = Math.sin(this.aimYaw) * cosP
                    const dirY = sinP
                    const dirZ = Math.cos(this.aimYaw) * cosP

                    this.camera.lookAt([eyeX, eyeY, eyeZ], [eyeX + dirX, eyeY + dirY, eyeZ + dirZ], [0, 1, 0])
                } else if (this.cameraMode === 'topdown') {
                    this.camera.lookAt([t.x + this.cameraShake.x, t.y + 40 + this.cameraShake.y, t.z + this.cameraShake.z], [t.x, t.y, t.z], [0, 0, -1])
                } else if (this.cameraMode === 'cinematic') {
                    // Slowly orbit around the target
                    const cinematicAngle = now * 0.0005
                    const dist = 25
                    const height = 15
                    const eyeX = t.x + Math.sin(cinematicAngle) * dist + this.cameraShake.x
                    const eyeY = t.y + height + this.cameraShake.y
                    const eyeZ = t.z + Math.cos(cinematicAngle) * dist + this.cameraShake.z
                    this.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])

                    // Depth of Field: focus on the marble for cinematic separation
                    if (this.view) {
                        const shouldUpdateDof = this._dofEnabled !== true || this._dofFocusDistance !== dist
                        if (shouldUpdateDof) {
                            try {
                                this.view.setDepthOfFieldOptions({
                                    enabled: true,
                                    // Use the fixed orbit distance so focus distance matches exactly
                                    focusDistance: dist,
                                    blurScale: 1.0,
                                    cocScale: 1.0,
                                    // Small aperture (0.01) gives subtle bokeh without excessive blur
                                    maxApertureDiameter: 0.01,
                                })
                                this._dofEnabled = true
                                this._dofFocusDistance = dist
                            } catch (e) { /* DoF not supported, skip */ }
                        }
                    }
                } else if (this.cameraMode === 'side-scroller') {
                    const dist = 30
                    const height = 5
                    const eyeX = t.x + dist + this.cameraShake.x
                    const eyeY = t.y + height + this.cameraShake.y
                    const eyeZ = t.z + this.cameraShake.z
                    this.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
                } else if (this.cameraMode === 'drone') {
                    const dist = this.droneDist || 25.0

                    const cosP = Math.cos(this.pitchAngle)
                    const sinP = Math.sin(this.pitchAngle)
                    const dirX = Math.sin(this.aimYaw) * cosP
                    const dirY = sinP
                    const dirZ = Math.cos(this.aimYaw) * cosP

                    let idealEyeX = t.x - dirX * dist
                    let idealEyeY = t.y - dirY * dist
                    let idealEyeZ = t.z - dirZ * dist

                    // Collision Avoidance using Rapier Raycast
                    if (this.world && typeof RAPIER !== 'undefined') {
                        const dx = idealEyeX - t.x
                        const dy = idealEyeY - t.y
                        const dz = idealEyeZ - t.z
                        const distToEye = Math.hypot(dx, dy, dz)
                        const rayDir = { x: dx / distToEye, y: dy / distToEye, z: dz / distToEye }

                        const r = target.scale * 0.5 || 0.5
                        const startDist = r + 0.1
                        const rayOrigin = {
                            x: t.x + rayDir.x * startDist,
                            y: t.y + rayDir.y * startDist,
                            z: t.z + rayDir.z * startDist
                        }

                        const ray = new RAPIER.Ray(rayOrigin, rayDir)

                        const maxRayDist = Math.max(0.01, distToEye - startDist)
                        const hit = this.world.castRay(ray, maxRayDist, false)
                        if (hit) {
                            const otherBody = hit.collider.parent()
                            if (!otherBody || (otherBody.handle !== target.rigidBody.handle && !hit.collider.isSensor())) {
                                const safeDist = hit.toi - 0.2
                                if (safeDist > 0) {
                                    idealEyeX = rayOrigin.x + rayDir.x * safeDist
                                    idealEyeY = rayOrigin.y + rayDir.y * safeDist
                                    idealEyeZ = rayOrigin.z + rayDir.z * safeDist
                                } else {
                                    idealEyeX = rayOrigin.x
                                    idealEyeY = rayOrigin.y
                                    idealEyeZ = rayOrigin.z
                                }
                            }
                        }
                    }

                    if (!this.cameraFollowPos) {
                        this.cameraFollowPos = { x: idealEyeX, y: idealEyeY, z: idealEyeZ }
                        this.cameraFollowLookAt = { x: t.x, y: t.y, z: t.z }
                    } else {
                        const lerpFactorPos = 0.08
                        const lerpFactorLook = 0.15
                        this.cameraFollowPos.x += (idealEyeX - this.cameraFollowPos.x) * lerpFactorPos
                        this.cameraFollowPos.y += (idealEyeY - this.cameraFollowPos.y) * lerpFactorPos
                        this.cameraFollowPos.z += (idealEyeZ - this.cameraFollowPos.z) * lerpFactorPos

                        this.cameraFollowLookAt.x += (t.x - this.cameraFollowLookAt.x) * lerpFactorLook
                        this.cameraFollowLookAt.y += (t.y - this.cameraFollowLookAt.y) * lerpFactorLook
                        this.cameraFollowLookAt.z += (t.z - this.cameraFollowLookAt.z) * lerpFactorLook
                    }

                    const eyeX = this.cameraFollowPos.x + this.cameraShake.x
                    const eyeY = this.cameraFollowPos.y + this.cameraShake.y
                    const eyeZ = this.cameraFollowPos.z + this.cameraShake.z

                    this.camera.lookAt([eyeX, eyeY, eyeZ], [this.cameraFollowLookAt.x, this.cameraFollowLookAt.y, this.cameraFollowLookAt.z], [0, 1, 0])
                }
            }
        } else {
            const eyeX = this.camRadius * Math.sin(this.camAngle) + this.cameraShake.x
            const eyeY = this.camHeight + this.cameraShake.y
            const eyeZ = this.camRadius * Math.cos(this.camAngle) + this.cameraShake.z
            this.camera.lookAt([eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0])
        }

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

            p.rigidBody.setNextKinematicTranslation({ x, y, z })

            const mat = quaternionToMat4({ x, y, z }, p.rigidBody.rotation())
            const sx = p.halfExtents.x * 2
            const sy = p.halfExtents.y * 2
            const sz = p.halfExtents.z * 2
            mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
            mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
            mat[8] *= sz; mat[9] *= sz; mat[10] *= sz

            const inst = tcm.getInstance(p.entity)
            tcm.setTransform(inst, mat)
        }

        for (const p of this.rotatingPlatforms) {
            if (!this.timeStopActive) {
                p.angle += p.speed
            }
            // Assuming Y axis rotation for now as per createRotatingBox
            const q = quatFromEuler(0, p.angle, 0)

            p.rigidBody.setNextKinematicRotation(q)

            const t = p.rigidBody.translation()
            const mat = quaternionToMat4(t, q)
            const sx = p.halfExtents.x * 2
            const sy = p.halfExtents.y * 2
            const sz = p.halfExtents.z * 2
            mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
            mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
            mat[8] *= sz; mat[9] *= sz; mat[10] *= sz

            const inst = tcm.getInstance(p.entity)
            tcm.setTransform(inst, mat)
        }

        this.updateGrapple()

        // Update PowerUps
        for (const p of this.powerUps) {
            if (!this.timeStopActive) {
                p.rotation += 0.05
            }
            const q = quatFromEuler(p.rotation, Math.PI / 4, 0)
            const bob = this.timeStopActive ? 0 : Math.sin(timeSec * 3) * 0.2
            const t = { x: p.pos.x, y: p.baseY + bob, z: p.pos.z }
            
            const mat = quaternionToMat4(t, q)
            const s = 0.5
            mat[0] *= s; mat[1] *= s; mat[2] *= s
            mat[4] *= s; mat[5] *= s; mat[6] *= s
            mat[8] *= s; mat[9] *= s; mat[10] *= s

            const inst = tcm.getInstance(p.entity)
            tcm.setTransform(inst, mat)
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
                const q = quatFromEuler(this.collectibleRotation, 0, Math.PI / 4)
                
                const mat = quaternionToMat4({ x: c.pos.x, y: newY, z: c.pos.z }, q)
                const scale = 0.5
                mat[0] *= scale; mat[1] *= scale; mat[2] *= scale
                mat[4] *= scale; mat[5] *= scale; mat[6] *= scale
                mat[8] *= scale; mat[9] *= scale; mat[10] *= scale
                
                const inst = tcm.getInstance(c.entity)
                tcm.setTransform(inst, mat)

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
                        this.scene.remove(c.entity)
                        this.engine.destroyEntity(c.entity)
                        this.collectibles.splice(i, 1)
                    }
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

        // Update Active Effects UI
        if (shouldUpdateHUD && this.activeEffectsEl) {
            const active = []
            for (const [type, endTime] of Object.entries(this.activeEffects)) {
                if (now < endTime) {
                    const timeLeft = Math.ceil((endTime - now) / 1000)
                    active.push(`${type.toUpperCase()}: ${timeLeft}s`)
                } else {
                    delete this.activeEffects[type]
                }
            }
            this.activeEffectsEl.textContent = active.join(' | ')
        }

        if (shouldUpdateHUD && this.sizebarContainerEl && this.sizebarEl) {
            const timeSinceSizeShift = now - this.lastSizeShiftTime
            if (timeSinceSizeShift < this.sizeShiftCooldown) {
                this.sizebarContainerEl.style.display = 'block'
                const pct = (timeSinceSizeShift / this.sizeShiftCooldown) * 100
                this.sizebarEl.style.width = pct + '%'
            } else {
                this.sizebarEl.style.width = '100%'
                this.sizebarContainerEl.style.display = 'none'
            }
        }

        if (shouldUpdateHUD && this.holobarContainerEl && this.holobarEl) {
            const timeSinceHolo = now - this.lastHoloTime
            if (timeSinceHolo < this.holoCooldown) {
                this.holobarContainerEl.style.display = 'block'
                const pct = (timeSinceHolo / this.holoCooldown) * 100
                this.holobarEl.style.width = pct + '%'
            } else {
                this.holobarEl.style.width = '100%'
                this.holobarContainerEl.style.display = 'none'
            }
        }

        if (shouldUpdateHUD && this.chameleonBarContainerEl && this.chameleonBarEl) {
            const timeSinceChameleon = now - this.lastChameleonTime
            const profile = this.chameleonProfiles[this.chameleonState]
            if (timeSinceChameleon < this.chameleonCooldown) {
                this.chameleonBarContainerEl.style.display = 'block'
                const pct = (timeSinceChameleon / this.chameleonCooldown) * 100
                this.chameleonBarEl.style.width = pct + '%'
                this.chameleonBarEl.style.background = `rgb(${profile.color[0]*255}, ${profile.color[1]*255}, ${profile.color[2]*255})`
            } else {
                this.chameleonBarEl.style.width = '100%'
                this.chameleonBarEl.style.background = `rgb(${profile.color[0]*255}, ${profile.color[1]*255}, ${profile.color[2]*255})`
                this.chameleonBarContainerEl.style.display = 'none'
            }
        }


        if (shouldUpdateHUD && this.blinkBarEl) {
            const timeSinceBlink = now - this.lastBlinkTime
            const progress = Math.min(1.0, timeSinceBlink / this.blinkCooldown)
            this.blinkBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.blinkBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ffcc00)'
            } else {
               this.blinkBarEl.style.filter = 'brightness(0.7)'
            }

            if (this.blinkBarContainerEl) {
                this.blinkBarContainerEl.style.display = 'block'
            }
        }

        if (shouldUpdateHUD && this.teleportBarEl) {
            const timeSinceTeleport = now - this.lastTeleportTime
            const progress = Math.min(1.0, timeSinceTeleport / this.teleportCooldown)
            this.teleportBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.teleportBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #cc00ff)'
            } else {
               this.teleportBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (shouldUpdateHUD && this.gravityPulseBarContainerEl && this.gravityPulseBarEl) {
            const timeSincePulse = now - this.lastGravityPulseTime
            if (timeSincePulse < this.gravityPulseCooldown) {
                this.gravityPulseBarContainerEl.style.display = 'block'
                const pct = (timeSincePulse / this.gravityPulseCooldown) * 100
                this.gravityPulseBarEl.style.width = pct + '%'
            } else {
                this.gravityPulseBarEl.style.width = '100%'
                this.gravityPulseBarContainerEl.style.display = 'none'
            }
        }

        if (shouldUpdateHUD && this.blackHoleBarEl && this.blackHoleBarContainerEl) {
            const timeSinceBlackHole = now - this.lastBlackHoleTime
            const progress = Math.min(1.0, timeSinceBlackHole / this.blackHoleCooldown)
            this.blackHoleBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.blackHoleBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #aa00ff)'
            } else {
               this.blackHoleBarEl.style.filter = 'brightness(0.7)'
            }

            if (this.activeBlackHoles && this.activeBlackHoles.length > 0) {
                this.blackHoleBarContainerEl.style.display = 'block'
                this.blackHoleBarEl.style.boxShadow = '0 0 10px #aa00ff'
            } else {
                this.blackHoleBarEl.style.boxShadow = 'none'
            }
        }

        if (shouldUpdateHUD && this.bombBarEl) {
            const timeSinceBomb = now - this.lastBombTime
            const progress = Math.min(1.0, timeSinceBomb / this.bombCooldown)
            this.bombBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.bombBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff4500)'
            } else {
               this.bombBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (shouldUpdateHUD && this.missileBarEl) {
            const timeSinceMissile = now - this.lastMissileTime
            const progress = Math.min(1.0, timeSinceMissile / this.missileCooldown)
            this.missileBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.missileBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8800)'
            } else {
               this.missileBarEl.style.filter = 'brightness(0.7)'
            }
        }

        // EMP Cooldown Bar
        if (shouldUpdateHUD && this.empBarEl) {
            const timeSinceEMP = now - this.lastEmpTime
            const progress = Math.min(1.0, timeSinceEMP / this.empCooldown)
            this.empBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.empBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
            } else {
               this.empBarEl.style.filter = 'brightness(0.7)'
            }

            if (this.empBarContainerEl) {
                this.empBarContainerEl.style.display = 'block'
            }
        }

        // Handle Active Black Holes lifecycle
        if (this.activeBlackHoles && this.activeBlackHoles.length > 0) {
        for (let i = this.activeBlackHoles.length - 1; i >= 0; i--) {
            const bh = this.activeBlackHoles[i]
            const timeAlive = now - bh.spawnTime

            if (timeAlive > bh.duration) {
                this.world.removeRigidBody(bh.rigidBody)
                this.scene.remove(bh.entity)
                if (bh.matInstance) this.engine.destroyMaterialInstance(bh.matInstance)
                this.engine.destroyEntity(bh.entity)
                this.Filament.EntityManager.get().destroy(bh.entity)

                if (bh.lightEntity) {
                    this.scene.remove(bh.lightEntity)
                    this.engine.destroyEntity(bh.lightEntity)
                    this.Filament.EntityManager.get().destroy(bh.lightEntity)
                }

                this.activeBlackHoles.splice(i, 1)
            } else {
                const pos = bh.rigidBody.translation()
                const radius = 25.0
                const attractionForce = 20.0

                // Attract dynamic bodies
                this.world.bodies.forEach(body => {
                    // Don't attract the black hole itself, or the player
                    if (body === bh.rigidBody) return
                    if (this.playerMarble && body === this.playerMarble.rigidBody) return
                    if (!body.isDynamic()) return

                    const bodyPos = body.translation()
                    const dx = pos.x - bodyPos.x
                    const dy = pos.y - bodyPos.y
                    const dz = pos.z - bodyPos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq < radius * radius && distSq > 0.01) {
                        const dist = Math.sqrt(distSq)
                        // Inverse square law-ish pull
                        const forceStr = (attractionForce * body.mass()) / dist

                        const fx = (dx / dist) * forceStr
                        const fy = (dy / dist) * forceStr + (body.mass() * 0.2) // Lift slightly
                        const fz = (dz / dist) * forceStr

                        body.applyImpulse({ x: fx, y: fy, z: fz }, true)
                    }
                })

                // Sync Filament transform to Rapier rigid body
                const inst = tcm.getInstance(bh.entity)
                const r = bh.rigidBody.rotation()
                const mat = quaternionToMat4(pos, r)

                // The scale visual effect (pulsing slightly)
                const pulse = 1.0 + Math.sin(timeAlive * 0.01) * 0.1
                const s = 1.5 * pulse // Adjust visual size
                mat[0] *= s; mat[1] *= s; mat[2] *= s
                mat[4] *= s; mat[5] *= s; mat[6] *= s
                mat[8] *= s; mat[9] *= s; mat[10] *= s

                tcm.setTransform(inst, mat)

                if (bh.lightEntity) {
                    const lightInst = tcm.getInstance(bh.lightEntity)
                    const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
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
                this.world.removeRigidBody(m.rigidBody)
                this.scene.remove(m.entity)
                if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
                this.engine.destroyEntity(m.entity)
                this.Filament.EntityManager.get().destroy(m.entity)

                if (m.lightEntity) {
                    this.scene.remove(m.lightEntity)
                    this.engine.destroyEntity(m.lightEntity)
                    this.Filament.EntityManager.get().destroy(m.lightEntity)
                }

                this.activeMissiles.splice(i, 1)
            } else {
                // Sync Filament transform
                const inst = tcm.getInstance(m.entity)
                const r = m.rigidBody.rotation()
                const mat = quaternionToMat4(pos, r)

                const s = 0.4
                mat[0] *= s; mat[1] *= s; mat[2] *= s
                mat[4] *= s; mat[5] *= s; mat[6] *= s
                mat[8] *= s; mat[9] *= s; mat[10] *= s

                tcm.setTransform(inst, mat)

                if (m.lightEntity) {
                    const lightInst = tcm.getInstance(m.lightEntity)
                    const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
            }
        }

        // Handle Active Bombs lifecycle
        for (let i = this.activeBombs.length - 1; i >= 0; i--) {
            const b = this.activeBombs[i]
            const timeAlive = now - b.spawnTime

            if (timeAlive > b.duration) {
                this.explodeBomb(b)
                this.world.removeRigidBody(b.rigidBody)
                this.scene.remove(b.entity)
                if (b.matInstance) this.engine.destroyMaterialInstance(b.matInstance)
                this.engine.destroyEntity(b.entity)
                this.Filament.EntityManager.get().destroy(b.entity)

                if (b.lightEntity) {
                    this.scene.remove(b.lightEntity)
                    this.engine.destroyEntity(b.lightEntity)
                    this.Filament.EntityManager.get().destroy(b.lightEntity)
                }

                this.activeBombs.splice(i, 1)
            } else {
                const timeLeft = b.duration - timeAlive
                const blinkRate = Math.max(50, timeLeft / 5) // Speeds up as it gets closer
                const blink = Math.floor(now / blinkRate) % 2 === 0

                if (b.matInstance) {
                    const color = blink ? [1.0, 0.2, 0.0] : [0.2, 0.2, 0.2]
                    b.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
                }

                // Sync Filament transform to Rapier rigid body
                const inst = tcm.getInstance(b.entity)
                const t = b.rigidBody.translation()
                const r = b.rigidBody.rotation()
                const mat = quaternionToMat4(t, r)

                // Scale matrix for 0.4 radius
                const s = 0.8
                mat[0] *= s; mat[1] *= s; mat[2] *= s
                mat[4] *= s; mat[5] *= s; mat[6] *= s
                mat[8] *= s; mat[9] *= s; mat[10] *= s

                tcm.setTransform(inst, mat)

                if (b.lightEntity) {
                    const lightInst = tcm.getInstance(b.lightEntity)
                    const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
            }
        }

        // Update consolidated HUD
        if (this.hudManager) {
            this.hudManager.updateAllAbilities()
        }

        // Update goal zone effects
        if (this.playerMarble) {
            const playerPos = this.playerMarble.rigidBody.translation()
            this.updateGoalEffects(0.016, playerPos)
        }

        this.syncTransformsAndRender(now)
    }
}

export function applyGameLoopRenderCore(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopRenderCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopRenderCore.prototype[name];
        }
    }
}

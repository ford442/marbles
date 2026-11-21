// @ts-check
/** @typedef {import('../types/frame-host.ts').FrameHost} FrameHost */
import { audio } from '../audio.js';
import { quaternionToMat4 } from '../math.ts';
import { tickLevelBehaviors } from '../game/level-behaviors/index.js';
import { applyRepelPulse } from './repel-pulse.js';
import { applyAcceleration } from '../game/systems/body-impulse.ts';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';

/** Gravity (m/s²) the hover / glider / gravity-powerup lift is tuned against. */
const GRAVITY = 9.81;

/**
 * Fraction to move toward a target this frame for a smoothing filter tuned as
 * "`perFrame` of the remaining distance per 1/60 s".
 * @param {number} perFrame
 * @param {number} meter - frames' worth of wall time this frame
 */
function blendPerFrame(perFrame, meter) {
    return 1 - Math.pow(1 - perFrame, meter)
}

export class GameLoopLogic {
    /** @param {FrameHost} game */
    constructor(game) {
        this.game = game;
    }

    updateGameState() {
        // Skip game updates when paused (but keep polling for pause toggle)
        if (this.game.isPaused) {
            // Still render the scene, just don't update game state
            return
        }

        // Rates in this method are tuned per 1/60 s and scaled by elapsed time
        // so behaviour is independent of display refresh rate:
        //   meter — wall-clock seconds × 60: energy meters, timers, UI smoothing
        //   step  — simulated seconds × 60: continuous impulses (0 on frames
        //           where the fixed-step clock runs no physics step)
        const dt = this.game.frameDt ?? 1 / 60
        const simDt = this.game.simDt ?? 1 / 60
        const meter = dt * 60
        const step = simDt * 60

        tickLevelBehaviors(this.game, simDt);

        // Note: gamepads are already polled once per frame in loop(); no need
        // to poll again here.

        // Party race: relay transform sync (arcade mode, not physics-authoritative)
        if (this.game.multiplayerMode) {
            this.game.tickMultiplayer?.()
        }

        this.game.touchControls?.tick()

        // Record / playback ghost replay (30 Hz, visual-only)
        if (this.game.ghostReplay) {
            this.game.ghostReplay.tickRecord(this.game)

            const ghostFrame = this.game.ghostReplay.tickPlayback(this.game)
            if (ghostFrame && this.game.ghostEntity) {
                const tcm = this.game.engine.getTransformManager()
                const rot = { x: ghostFrame.qx, y: ghostFrame.qy, z: ghostFrame.qz, w: ghostFrame.qw }
                const pos = { x: ghostFrame.x, y: ghostFrame.y, z: ghostFrame.z }
                const mat = quaternionToMat4(pos, rot)
                const inst = tcm.getInstance(this.game.ghostEntity)
                tcm.setTransform(inst, mat)

                if (this.game.ghostLightEntity) {
                    const lightInst = tcm.getInstance(this.game.ghostLightEntity)
                    const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
            }
        }

        const rotSpeed = 0.02
        const zoomSpeed = 0.5

        // Adrenaline Logic Update
        if (this.game.playerMarble) {
            const linvel = this.game.playerMarble.rigidBody.linvel()
            const speed = Math.hypot(linvel.x, linvel.y, linvel.z)

            if (speed > 15) {
                // Increase adrenaline based on speed above 15
                this.game.adrenaline = Math.min(this.game.maxAdrenaline, this.game.adrenaline + (speed - 15) * 0.05 * meter)
            } else {
                // Decay adrenaline slowly
                this.game.adrenaline = Math.max(0, this.game.adrenaline - 0.2 * meter)
            }

            // Camera FOV target
            const targetFov = this.game.baseFov + (this.game.adrenaline / this.game.maxAdrenaline) * 20.0
            this.game.currentFov += (targetFov - this.game.currentFov) * blendPerFrame(0.1, meter)

            // Generate Camera Shake (respect accessibility setting)
            const shakeMultiplier = this.game.getScreenShakeIntensity ? this.game.getScreenShakeIntensity() : 1.0
            // Reuse a single cameraShake object instead of allocating a new one
            // every frame (this runs at 60 FPS and would otherwise churn the GC).
            if (!this.game.cameraShake) this.game.cameraShake = { x: 0, y: 0, z: 0 }
            const shake = this.game.cameraShake
            if (this.game.adrenaline > 20 && shakeMultiplier > 0) {
                const shakeIntensity = (this.game.adrenaline - 20) / 80.0 * 0.5 * shakeMultiplier
                shake.x += (Math.random() - 0.5) * shakeIntensity
                shake.y += (Math.random() - 0.5) * shakeIntensity
                shake.z += (Math.random() - 0.5) * shakeIntensity
            }

            // Add Tremor Camera Shake
            if (this.game.tremorShakeTimer && this.game.tremorShakeTimer > 0) {
                const tremorIntensity = (this.game.tremorShakeTimer / 30.0) * 1.5 * shakeMultiplier
                this.game.cameraShake.x += (Math.random() - 0.5) * tremorIntensity
                this.game.cameraShake.y += (Math.random() - 0.5) * tremorIntensity
                this.game.cameraShake.z += (Math.random() - 0.5) * tremorIntensity
                this.game.tremorShakeTimer = Math.max(0, this.game.tremorShakeTimer - meter)
            }

            // Stomp camera shake decay
            const shakeDecay = Math.pow(0.9, meter)
            this.game.cameraShake.x *= shakeDecay
            this.game.cameraShake.y *= shakeDecay
            this.game.cameraShake.z *= shakeDecay

            // Update Projection FOV each frame
            if (this.game.camera && this.game.view && this.game.Filament && this.game.Filament.Camera$Fov) {
                const aspect = this.game.canvas.width / this.game.canvas.height
                this.game.camera.setProjectionFov(this.game.currentFov, aspect, 0.1, 1000.0, this.game.Filament.Camera$Fov.VERTICAL)
            }

            // Update speed lines effect based on marble velocity
            this.game.updateSpeedLines(speed)
        }

        if (this.game.adrenalineBarEl && this.game.adrenalineBarContainerEl) {
            const pct = (this.game.adrenaline / this.game.maxAdrenaline) * 100
            this.game.adrenalineBarEl.style.width = `${pct}%`
            if (this.game.adrenaline > 0) {
                this.game.adrenalineBarContainerEl.style.display = 'block'
            } else {
                this.game.adrenalineBarContainerEl.style.display = 'none'
            }

            if (this.game.adrenaline > 80) {
                this.game.adrenalineBarEl.style.boxShadow = '0 0 15px #ff0000'
            } else {
                this.game.adrenalineBarEl.style.boxShadow = '0 0 5px #ff0000'
            }
        }

        // Sandbox Builder Logic
        this.game.buildEnergy = Math.min(this.game.maxBuildEnergy, this.game.buildEnergy + 0.1 * meter)
        if (this.game.buildbarEl) {
            const pct = (this.game.buildEnergy / this.game.maxBuildEnergy) * 100
            this.game.buildbarEl.style.width = `${pct}%`

            if (this.game.buildEnergy >= 25) {
                this.game.buildbarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ff00)'
            } else {
                this.game.buildbarEl.style.filter = 'brightness(0.7)'
            }
        }

        // Focus Mechanic Logic
        // Focus is the registry's `focus` entry (poll trigger; maps can disable it).
        if (this.game.abilitySystem?.isHeld('focus') && this.game.focusEnergy > 0) {
            if (!this.game.focusActive && this.game.hudManager) {
                this.game.hudManager.markAbilityUsed('focus')
            }
            this.game.focusActive = true
            const targetScale = 0.2
            this.game.timeScale += (targetScale - this.game.timeScale) * blendPerFrame(0.1, meter)
            this.game.focusEnergy = Math.max(0, this.game.focusEnergy - 0.5 * meter)
        } else {
            this.game.focusActive = false
            const targetScale = 1.0
            this.game.timeScale += (targetScale - this.game.timeScale) * blendPerFrame(0.1, meter)
            this.game.focusEnergy = Math.min(this.game.maxFocusEnergy, this.game.focusEnergy + 0.2 * meter)
        }

        // Apply Time Scale to Physics: scales the fixed-step clock's
        // accumulated time (both backends), never the step size.
        if (this.game.physicsBackend?.setTimeScale) {
            this.game.physicsBackend.setTimeScale(this.game.timeScale)
        } else if (this.game.physicsClock) {
            this.game.physicsClock.timeScale = this.game.timeScale
        }

        // Time Stop Mechanic Logic
        if (this.game.timeStopActive && this.game.timeStopEnergy > 0) {
            this.game.timeStopEnergy = Math.max(0, this.game.timeStopEnergy - 0.5 * meter)

            if (this.game.playerMarble) {
                const playerRb = this.game.playerMarble.rigidBody
                for (const body of this.game.dynamicBodies) {
                    if (body === playerRb) continue

                    // Save state if not already saved
                    if (!this.game.timeStopSavedStates.has(body.handle)) {
                        const linvel = body.linvel()
                        const angvel = body.angvel()
                        this.game.timeStopSavedStates.set(body.handle, {
                            linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
                            angvel: { x: angvel.x, y: angvel.y, z: angvel.z }
                        })
                    }

                    // Freeze body
                    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
                    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
                    body.setGravityScale(0, true)
                }
            }
        } else {
            if (this.game.timeStopActive) {
                // Out of energy, deactivate
                this.game.timeStopActive = false
                const playerRb = this.game.playerMarble ? this.game.playerMarble.rigidBody : null
                for (const body of this.game.dynamicBodies) {
                    if (body !== playerRb) {
                        const state = this.game.timeStopSavedStates.get(body.handle)
                        if (state) {
                            body.setLinvel(state.linvel, true)
                            body.setAngvel(state.angvel, true)
                            this.game.timeStopSavedStates.delete(body.handle)
                        }
                        body.setGravityScale(1.0, true)
                    }
                }
                this.game.timeStopSavedStates.clear()
            }
            this.game.timeStopEnergy = Math.min(this.game.maxTimeStopEnergy, this.game.timeStopEnergy + 0.2 * meter)
        }

        if (this.game.timeStopbarContainerEl && this.game.timeStopbarEl) {
            const pct = (this.game.timeStopEnergy / this.game.maxTimeStopEnergy) * 100
            this.game.timeStopbarEl.style.width = `${pct}%`

            if (this.game.timeStopEnergy < this.game.maxTimeStopEnergy || this.game.timeStopActive) {
                this.game.timeStopbarContainerEl.style.display = 'block'
            } else {
                this.game.timeStopbarContainerEl.style.display = 'none'
            }

            if (this.game.timeStopActive && this.game.timeStopEnergy > 0) {
                this.game.timeStopbarEl.style.boxShadow = '0 0 10px #ffffff'
                // Optional: apply grayscale or color tint to the whole body via CSS
                document.body.style.filter = 'grayscale(80%) contrast(1.2)'
            } else {
                this.game.timeStopbarEl.style.boxShadow = 'none'
                if (!this.game.focusActive) { // ensure we don't clear focus active filter
                    document.body.style.filter = 'none'
                }
            }
        }

        // EMP Bar Logic
        if (this.game.empBarEl && this.game.empBarContainerEl) {
            const now = Date.now()
            const timeSinceLastEmp = now - this.game.lastEmpTime
            if (timeSinceLastEmp < this.game.empCooldown) {
                this.game.empBarContainerEl.style.display = 'block'
                const pct = (timeSinceLastEmp / this.game.empCooldown) * 100
                this.game.empBarEl.style.width = `${pct}%`
            } else {
                this.game.empBarContainerEl.style.display = 'none'
                this.game.empBarEl.style.width = '100%'
            }
        }

        // Portal Teleportation Logic
        const nowTime = Date.now()
        if (this.game.portalA && this.game.portalB && this.game.playerMarble && (nowTime - this.game.lastPortalTeleportTime > this.game.portalCooldown)) {
            const playerPos = this.game.playerMarble.rigidBody.translation()
            const pRadius = this.game.playerMarble.scale * 0.5 || 0.5

            // Check dist to Portal A
            const distA = Math.hypot(playerPos.x - this.game.portalA.pos.x, playerPos.y - this.game.portalA.pos.y, playerPos.z - this.game.portalA.pos.z)
            if (distA < 1.5) {
                // Teleport to B
                const outPos = {
                    x: this.game.portalB.pos.x + this.game.portalB.normal.x * (pRadius + 0.1),
                    y: this.game.portalB.pos.y + this.game.portalB.normal.y * (pRadius + 0.1),
                    z: this.game.portalB.pos.z + this.game.portalB.normal.z * (pRadius + 0.1)
                }
                this.game.playerMarble.rigidBody.setTranslation(outPos, true)
                // Maintain velocity magnitude, change direction to out normal
                const vel = this.game.playerMarble.rigidBody.linvel()
                const speed = Math.hypot(vel.x, vel.y, vel.z) || 10.0
                this.game.playerMarble.rigidBody.setLinvel({
                    x: this.game.portalB.normal.x * speed,
                    y: this.game.portalB.normal.y * speed,
                    z: this.game.portalB.normal.z * speed
                }, true)
                this.game.lastPortalTeleportTime = nowTime
                if (audio && audio.playTrick) audio.playTrick()
            } else {
                // Check dist to Portal B
                const distB = Math.hypot(playerPos.x - this.game.portalB.pos.x, playerPos.y - this.game.portalB.pos.y, playerPos.z - this.game.portalB.pos.z)
                if (distB < 1.5) {
                    // Teleport to A
                    const outPos = {
                        x: this.game.portalA.pos.x + this.game.portalA.normal.x * (pRadius + 0.1),
                        y: this.game.portalA.pos.y + this.game.portalA.normal.y * (pRadius + 0.1),
                        z: this.game.portalA.pos.z + this.game.portalA.normal.z * (pRadius + 0.1)
                    }
                    this.game.playerMarble.rigidBody.setTranslation(outPos, true)
                    const vel = this.game.playerMarble.rigidBody.linvel()
                    const speed = Math.hypot(vel.x, vel.y, vel.z) || 10.0
                    this.game.playerMarble.rigidBody.setLinvel({
                        x: this.game.portalA.normal.x * speed,
                        y: this.game.portalA.normal.y * speed,
                        z: this.game.portalA.normal.z * speed
                    }, true)
                    this.game.lastPortalTeleportTime = nowTime
                    if (audio && audio.playTrick) audio.playTrick()
                }
            }
        }

        // Update Focus UI and Effects
        if (this.game.focusBarEl) {
            const pct = (this.game.focusEnergy / this.game.maxFocusEnergy) * 100
            this.game.focusBarEl.style.width = `${pct}%`

            if (this.game.focusActive) {
                this.game.focusBarEl.style.boxShadow = '0 0 10px #7b00ff'
                document.body.style.filter = 'contrast(1.2) saturate(0.5) brightness(1.1)'
            } else {
                this.game.focusBarEl.style.boxShadow = 'none'
                document.body.style.filter = 'none'
            }
        }

        // Rewind records and replays one entry per frame that ran physics, so
        // history length and playback speed don't depend on refresh rate.
        const physicsFrame = (this.game.physicsSubsteps ?? 1) > 0
        if (this.game.isRewinding && this.game.playerMarble) {
            if (this.game._rewindCount > 0 && physicsFrame) {
                // Pop last frame from ring buffer
                this.game._rewindCount--
                this.game._rewindHead = (this.game._rewindHead - 1 + this.game.maxRewindFrames) % this.game.maxRewindFrames
                const base = this.game._rewindHead * 13
                const buf = this.game._rewindBuffer
                const at = (/** @type {number} */ i) => buf[base + i] ?? 0
                this.game.playerMarble.rigidBody.setTranslation({ x: at(0), y: at(1), z: at(2) }, true)
                this.game.playerMarble.rigidBody.setRotation(   { x: at(3), y: at(4), z: at(5), w: at(6) }, true)
                this.game.playerMarble.rigidBody.setLinvel(     { x: at(7), y: at(8), z: at(9) }, true)
                this.game.playerMarble.rigidBody.setAngvel(     { x: at(10), y: at(11), z: at(12) }, true)

                // Visual effect for rewind
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                // Tint red/orange
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [1.0, 0.2, 0.0])
            }
        } else if (this.game.playerMarble && physicsFrame) {
             const rb = this.game.playerMarble.rigidBody
             const pos = rb.translation()
             const rot = rb.rotation()
             const linvel = rb.linvel()
             const angvel = rb.angvel()

             // Push frame into ring buffer (overwrites oldest when full)
             const base = this.game._rewindHead * 13
             const buf = this.game._rewindBuffer
             buf[base]      = pos.x;    buf[base + 1]  = pos.y;    buf[base + 2]  = pos.z
             buf[base + 3]  = rot.x;    buf[base + 4]  = rot.y;    buf[base + 5]  = rot.z;   buf[base + 6]  = rot.w
             buf[base + 7]  = linvel.x; buf[base + 8]  = linvel.y; buf[base + 9]  = linvel.z
             buf[base + 10] = angvel.x; buf[base + 11] = angvel.y; buf[base + 12] = angvel.z
             this.game._rewindHead = (this.game._rewindHead + 1) % this.game.maxRewindFrames
             if (this.game._rewindCount < this.game.maxRewindFrames) this.game._rewindCount++
        }

        if (this.game.rewindBarEl) {
            const pct = (this.game._rewindCount / this.game.maxRewindFrames) * 100
            this.game.rewindBarEl.style.width = `${pct}%`
        }

        if (this.game.gravityBarEl) {
            if (this.game.activeEffects.gravity && Date.now() < this.game.activeEffects.gravity) {
                const timeLeft = this.game.activeEffects.gravity - Date.now()
                const pct = (timeLeft / 5000) * 100
                this.game.gravityBarEl.style.width = `${pct}%`
                this.game.gravityBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ffcc00)'

                if (this.game.playerMarble) {
                    // Counteract most of gravity so it feels floaty
                    applyAcceleration(this.game.playerMarble.rigidBody, { x: 0, y: 0.98 * GRAVITY, z: 0 }, simDt)
                }
            } else {
                this.game.gravityBarEl.style.width = `0%`
                this.game.gravityBarEl.style.filter = 'none'
            }
        }

        // Vortex Mechanic
        if (this.game.vortexActive && this.game.vortexEnergy > 0) {
            this.game.vortexEnergy = Math.max(0, this.game.vortexEnergy - 1.0 * meter)
            if (this.game.playerMarble) {
                const playerPos = this.game.playerMarble.rigidBody.translation()
                const radius = 15.0
                const attractionForce = 2.0
                const tangentialForce = 1.5

                const playerRb = this.game.playerMarble.rigidBody
                for (const body of this.game.dynamicBodies) {
                    if (body === playerRb) continue

                    const bodyPos = body.translation()
                    const dx = bodyPos.x - playerPos.x
                    const dy = bodyPos.y - playerPos.y
                    const dz = bodyPos.z - playerPos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq < radius * radius && distSq > 0.001) {
                        const dist = Math.sqrt(distSq)

                        // Pull towards player
                        const fx = -(dx / dist) * attractionForce * body.mass()
                        const fy = -(dy / dist) * attractionForce * body.mass()
                        const fz = -(dz / dist) * attractionForce * body.mass()

                        // Tangential swirling force (cross product of up vector and direction to player)
                        // up = (0, 1, 0), dir = (dx, dy, dz)
                        // cross(up, dir) = (dz, 0, -dx)
                        const tx = (dz / dist) * tangentialForce * body.mass()
                        const ty = 0
                        const tz = -(dx / dist) * tangentialForce * body.mass()

                        // Add a little upward force to lift them into the vortex
                        const liftForce = body.mass() * 0.5

                        body.applyImpulse({
                            x: (fx + tx) * step,
                            y: (fy + ty + liftForce) * step,
                            z: (fz + tz) * step,
                        }, true)
                    }
                }

                // Visual feedback - tint magenta
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [1.0, 0.0, 1.0])
                }
            }
        } else {
            this.game.vortexEnergy = Math.min(this.game.maxVortexEnergy, this.game.vortexEnergy + 0.5 * meter)

            // Restore original color when not using vortex or out of energy
            if (!this.game.shieldActive && this.game.playerMarble && this.game.playerMarble.originalColor) {
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.playerMarble.originalColor)
                }
            }
        }

        if (this.game.vortexbarContainerEl && this.game.vortexbarEl) {
            const pct = (this.game.vortexEnergy / this.game.maxVortexEnergy) * 100
            this.game.vortexbarEl.style.width = `${pct}%`

            if (this.game.vortexEnergy < this.game.maxVortexEnergy || this.game.vortexActive) {
                this.game.vortexbarContainerEl.style.display = 'block'
            } else {
                this.game.vortexbarContainerEl.style.display = 'none'
            }

            if (this.game.vortexActive && this.game.vortexEnergy > 0) {
                this.game.vortexbarEl.style.boxShadow = '0 0 10px #ff00ff'
            } else {
                this.game.vortexbarEl.style.boxShadow = 'none'
            }
        }

        if (this.game.shieldActive && this.game.shieldEnergy > 0) {
            this.game.shieldEnergy -= 1.0 * meter
            if (this.game.shieldEnergy < 0) this.game.shieldEnergy = 0

            if (this.game.playerMarble) {
                // Repel other dynamic bodies, with a slight upward pop
                applyRepelPulse(this.game, 5.0, 3.0, 1.0)
                const playerPos = this.game.playerMarble.rigidBody.translation()
                const radius = 5.0
                const force = 3.0

                // Repel other dynamic bodies
                const playerRb = this.game.playerMarble.rigidBody
                for (const body of this.game.dynamicBodies) {
                    if (body === playerRb) continue

                    const bodyPos = body.translation()
                    const dx = bodyPos.x - playerPos.x
                    const dy = bodyPos.y - playerPos.y
                    const dz = bodyPos.z - playerPos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq < radius * radius && distSq > 0.001) {
                        const dist = Math.sqrt(distSq)
                        const fx = (dx / dist) * force * body.mass()
                        const fy = (dy / dist) * force * body.mass() + 1.0 // slight upward pop
                        const fz = (dz / dist) * force * body.mass()

                        body.applyImpulse({ x: fx * step, y: fy * step, z: fz * step }, true)
                    }
                }

                // Visual feedback - tint cyan
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
                }
            }
        } else {
            this.game.shieldEnergy += 0.2 * meter
            if (this.game.shieldEnergy > this.game.maxShieldEnergy) this.game.shieldEnergy = this.game.maxShieldEnergy

            // Restore original color when not shielding or out of energy
            if (this.game.playerMarble && this.game.playerMarble.originalColor && !this.game.violetActive) {
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.playerMarble.originalColor)
                }
            }
        }

        if (this.game.shieldbarEl) {
            const pct = (this.game.shieldEnergy / this.game.maxShieldEnergy) * 100
            this.game.shieldbarEl.style.width = `${pct}%`
            if (this.game.shieldActive && this.game.shieldEnergy > 0) {
                this.game.shieldbarEl.style.boxShadow = '0 0 10px #00ffff'
            } else {
                this.game.shieldbarEl.style.boxShadow = 'none'
            }
        }

        // Violet Light Logic
        if (this.game.violetActive && this.game.violetEnergy > 0) {
            this.game.violetEnergy -= 1.0 * meter
            if (this.game.violetEnergy < 0) this.game.violetEnergy = 0

            if (this.game.playerMarble) {
                const playerPos = this.game.playerMarble.rigidBody.translation()
                const radius = 15.0

                // Repel other dynamic bodies
                applyRepelPulse(this.game, radius, 0.5, 0)

                // Create or update Violet Light Entity
                if (!this.game.violetLightEntity) {
                    this.game.violetLightEntity = this.game.Filament.EntityManager.get().create()
                    this.game.Filament.LightManager.Builder(this.game.Filament.LightManager$Type.POINT)
                        .color([0.6, 0.0, 1.0])
                        .intensity(100000.0)
                        .falloff(radius)
                        .build(this.game.engine, this.game.violetLightEntity)
                    this.game.scene.addEntity(this.game.violetLightEntity)
                }

                const tcm = this.game.engine.getTransformManager()
                const lightInst = tcm.getInstance(this.game.violetLightEntity)
                const lightMat = quaternionToMat4(playerPos, { x: 0, y: 0, z: 0, w: 1 })
                tcm.setTransform(lightInst, lightMat)

                // Visual feedback - tint violet
                if (!this.game.shieldActive) {
                    const rcm = this.game.engine.getRenderableManager()
                    const inst = rcm.getInstance(this.game.playerMarble.entity)
                    if (inst) {
                        const matInst = rcm.getMaterialInstanceAt(inst, 0)
                        matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.6, 0.0, 1.0])
                    }
                }
            }
        } else {
            this.game.violetEnergy += 0.2 * meter
            if (this.game.violetEnergy > this.game.maxVioletEnergy) this.game.violetEnergy = this.game.maxVioletEnergy

            // Destroy Violet Light Entity
            if (this.game.violetLightEntity) {
                this.game.scene.remove(this.game.violetLightEntity)
                this.game.engine.destroyEntity(this.game.violetLightEntity)
                this.game.Filament.EntityManager.get().destroy(this.game.violetLightEntity)
                this.game.violetLightEntity = null
            }

            // Restore original color when not shielding, phasing, vortexing, or violetting
            if (this.game.playerMarble && this.game.playerMarble.originalColor && !this.game.shieldActive && !this.game.vortexActive && !this.game.wasPhasing) {
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.playerMarble.originalColor)
                }
            }
        }

        if (this.game.violetbarEl && this.game.violetbarContainerEl) {
            const pct = (this.game.violetEnergy / this.game.maxVioletEnergy) * 100
            this.game.violetbarEl.style.width = `${pct}%`

            if (this.game.violetEnergy < this.game.maxVioletEnergy || this.game.violetActive) {
                this.game.violetbarContainerEl.style.display = 'block'
            } else {
                this.game.violetbarContainerEl.style.display = 'none'
            }

            if (this.game.violetActive && this.game.violetEnergy > 0) {
                this.game.violetbarEl.style.boxShadow = '0 0 10px #ee82ee'
            } else {
                this.game.violetbarEl.style.boxShadow = 'none'
            }
        }

        // One grounding probe per frame, shared by the meters below.
        const grounded = this.game.playerMarble ? this.game.isGrounded(this.game.playerMarble) : false

        if (this.game.awaitingShockwaveImpact && grounded && this.game.playerMarble) {
            this.game.awaitingShockwaveImpact = false;

            const pt = this.game.playerMarble.rigidBody.translation();
            const range = 25.0;
            const rangeSq = range * range;
            const forceStrength = 500.0;
            const physics = getMarblePhysics();

            /** @type {{ body: import('@dimforge/rapier3d-compat').RigidBody, pos: { x: number, y: number, z: number } }[]} */
            const targets = [];

            /** @param {import('@dimforge/rapier3d-compat').RigidBody} body */
            const considerBody = (body) => {
                const bt = body.translation();
                const dx = pt.x - bt.x;
                const dy = pt.y - bt.y;
                const dz = pt.z - bt.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > 0.1 && distSq < rangeSq) {
                    targets.push({ body, pos: bt });
                }
            };

            for (const m of this.game.marbles) {
                if (m !== this.game.playerMarble) considerBody(m.rigidBody);
            }
            for (const obj of this.game.dynamicObjects) {
                considerBody(obj.rigidBody);
            }

            if (targets.length > FORCE_BATCH_THRESHOLD) {
                if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(128);
                const buf = this.game._forceBatchBuffers;
                buf.ensure(targets.length);

                for (const [i, { pos: p }] of targets.entries()) {
                    const base = i * 3;
                    buf.positions[base] = p.x;
                    buf.positions[base + 1] = p.y;
                    buf.positions[base + 2] = p.z;
                    buf.strengths[i] = forceStrength;
                }

                physics.computeForceFieldsBatch(
                    buf.positions, buf.strengths, buf.forces, targets.length,
                    pt.x, pt.y, pt.z,
                    1.0, 0.2, range, 1.0 // exponent, offset, radius, scale
                );

                for (const [i, { body }] of targets.entries()) {
                    const base = i * 3;
                    body.applyImpulse({
                        x: buf.forces[base] ?? 0,
                        y: (buf.forces[base + 1] ?? 0) + 20.0, // Extra upward kick
                        z: buf.forces[base + 2] ?? 0
                    }, true);
                }
            } else if (targets.length > 0) {
                if (!this.game._forceBatchBuffers) this.game._forceBatchBuffers = new PhysicsBatchBuffers(16);
                const scalarBuf = this.game._forceBatchBuffers.forces;
                for (const { body, pos: bt } of targets) {
                    physics.computeForceFieldInto(
                        scalarBuf,
                        pt.x, pt.y, pt.z,
                        bt.x, bt.y, bt.z,
                        forceStrength, 1.0, 0.2, range, 1.0
                    );
                    body.applyImpulse({
                        x: scalarBuf[0] ?? 0,
                        y: (scalarBuf[1] ?? 0) + 20.0,
                        z: scalarBuf[2] ?? 0
                    }, true);
                }
            }

            // Camera shake
            if (!this.game.cameraShake) this.game.cameraShake = { x: 0, y: 0, z: 0 };
            this.game.cameraShake.y += 2.0; // intense vertical shake

            // `audio` has no playImpact today; the guard keeps this a no-op until it does.
            const impactAudio = /** @type {{ playImpact?: () => void }} */ (/** @type {unknown} */ (audio))
            impactAudio.playImpact?.();
        }

        // Passive Double Jump Reset
        if (grounded) {
            this.game.hasDoubleJumped = false;
        }

        // Glider Logic
        if (this.game.gliderActive && this.game.gliderEnergy > 0) {
            if (this.game.playerMarble) {
                const rb = this.game.playerMarble.rigidBody
                const linvel = rb.linvel()
                const gravityDir = rb.gravityScale() < 0 ? -1 : 1

                // Counteract some gravity to fall slower
                if ((gravityDir > 0 && linvel.y < 0) || (gravityDir < 0 && linvel.y > 0)) {
                    rb.setLinvel({ x: linvel.x, y: linvel.y * Math.pow(0.9, step), z: linvel.z }, true)
                    applyAcceleration(rb, { x: 0, y: 6.0 * gravityDir, z: 0 }, simDt)
                }

                // Apply forward thrust based on view direction
                const cosP = Math.cos(this.game.pitchAngle)
                const sinP = Math.sin(this.game.pitchAngle)
                const dirX = Math.sin(this.game.aimYaw) * cosP
                const dirY = sinP // Allowing slight pitch to affect upward/downward glide
                const dirZ = Math.cos(this.game.aimYaw) * cosP

                const glideThrust = 30.0 // m/s²
                applyAcceleration(rb, {
                    x: dirX * glideThrust,
                    y: dirY * glideThrust,
                    z: dirZ * glideThrust
                }, simDt)

                if (audio && audio.playBoost && Math.random() < 0.1) {
                    audio.playBoost() // Play sound occasionally for feedback
                }
            }
            this.game.gliderEnergy = Math.max(0, this.game.gliderEnergy - 0.4 * meter)
        } else {
            if (grounded) {
                this.game.gliderEnergy = Math.min(this.game.maxGliderEnergy, this.game.gliderEnergy + 0.3 * meter)
            }
        }

        // Jetpack Logic
        if (this.game.jetpackActive && this.game.jetpackEnergy > 0) {
            if (this.game.playerMarble) {
                const rb = this.game.playerMarble.rigidBody
                const cosP = Math.cos(this.game.pitchAngle)

                // Thrust vector aligned with camera aim, but mainly upwards
                const dirX = Math.sin(this.game.aimYaw) * cosP
                const dirY = 1.0 // Always push up
                const dirZ = Math.cos(this.game.aimYaw) * cosP

                // Apply continuous force while active
                // Stronger than hover (15 m/s² up vs 9.81) to actually ascend
                applyAcceleration(rb, {
                    x: dirX * 6.0,
                    y: dirY * 15.0,
                    z: dirZ * 6.0
                }, simDt)

                const pos = rb.translation()
                const linvel = rb.linvel()
                // Spawn exhaust particles
                // `frameCount` is never initialised or advanced anywhere, so (as before
                // the type check) neither the exhaust nor the thrust sound fires.
                if (this.game.frameCount !== undefined && this.game.frameCount % 2 === 0) {
                    this.game.spawnJetpackExhaust(pos, linvel)
                }

                // Play continuous thrust sound
                if (this.game.frameCount !== undefined && this.game.frameCount % 5 === 0 && audio && audio.playBoost) {
                    // We could add a specialized loop sound, but boosting repeatedly gives a sputtering jet effect
                    audio.playBoost()
                }
            }
            this.game.jetpackEnergy = Math.max(0, this.game.jetpackEnergy - 1.0 * meter) // Drains faster than hover
        } else {
            if (grounded) {
                this.game.jetpackEnergy = Math.min(this.game.maxJetpackEnergy, this.game.jetpackEnergy + 0.5 * meter)
            }
        }

        if (this.game.jetpackbarEl && this.game.jetpackbarContainerEl) {
            const pct = (this.game.jetpackEnergy / this.game.maxJetpackEnergy) * 100
            this.game.jetpackbarEl.style.width = `${pct}%`

            if (this.game.jetpackEnergy < this.game.maxJetpackEnergy || this.game.jetpackActive) {
                this.game.jetpackbarContainerEl.style.display = 'block'
            } else {
                this.game.jetpackbarContainerEl.style.display = 'none'
            }

            if (this.game.jetpackActive && this.game.jetpackEnergy > 0) {
                this.game.jetpackbarEl.style.boxShadow = '0 0 10px #ffaa00'
            } else {
                this.game.jetpackbarEl.style.boxShadow = 'none'
            }
        }

        if (this.game.gliderBarEl && this.game.gliderBarContainerEl) {
            const pct = (this.game.gliderEnergy / this.game.maxGliderEnergy) * 100
            this.game.gliderBarEl.style.width = `${pct}%`

            if (this.game.gliderEnergy < this.game.maxGliderEnergy || this.game.gliderActive) {
                this.game.gliderBarContainerEl.style.display = 'block'
            } else {
                this.game.gliderBarContainerEl.style.display = 'none'
            }

            if (this.game.gliderActive && this.game.gliderEnergy > 0) {
                this.game.gliderBarEl.style.boxShadow = '0 0 10px #aaffaa'
            } else {
                this.game.gliderBarEl.style.boxShadow = 'none'
            }
        }

        // Gravity Flip Logic. This block re-asserts the marble's gravity scale
        // every frame, so it must leave the scale alone while hover owns it
        // (abilities/hover.js lowers it on the fixed step and restores it on
        // release; a flip toggled mid-hover takes effect once hover ends).
        const hoverOwnsGravity = this.game.hoverActive
        if (this.game.flipActive && this.game.flipEnergy > 0 && this.game.playerMarble) {
            this.game.flipEnergy = Math.max(0, this.game.flipEnergy - 0.5 * meter)
            if (!hoverOwnsGravity) this.game.playerMarble.rigidBody.setGravityScale(-this.game.playerMarble.baseGravityScale, true)
        } else if (this.game.flipActive && this.game.flipEnergy <= 0) {
            this.game.flipActive = false
            if (this.game.playerMarble && !hoverOwnsGravity) {
                this.game.playerMarble.rigidBody.setGravityScale(this.game.playerMarble.baseGravityScale, true)
            }
        } else if (!this.game.flipActive) {
            this.game.flipEnergy = Math.min(this.game.maxFlipEnergy, this.game.flipEnergy + 0.2 * meter)
            if (this.game.playerMarble && !hoverOwnsGravity) {
                this.game.playerMarble.rigidBody.setGravityScale(this.game.playerMarble.baseGravityScale, true)
            }
        }

        if (this.game.flipbarContainerEl && this.game.flipbarEl) {
            const pct = (this.game.flipEnergy / this.game.maxFlipEnergy) * 100
            this.game.flipbarEl.style.width = `${pct}%`

            if (this.game.flipEnergy < this.game.maxFlipEnergy || this.game.flipActive) {
                this.game.flipbarContainerEl.style.display = 'block'
            } else {
                this.game.flipbarContainerEl.style.display = 'none'
            }

            if (this.game.flipActive && this.game.flipEnergy > 0) {
                this.game.flipbarEl.style.boxShadow = '0 0 10px #ff00ff'
            } else {
                this.game.flipbarEl.style.boxShadow = 'none'
            }
        }

        // Phase Shift Logic
        if (this.game.phaseActive && this.game.phaseEnergy > 1.0 && this.game.playerMarble) {
            this.game.phaseEnergy = Math.max(0, this.game.phaseEnergy - 1.0 * meter)

            if (!this.game.wasPhasing) {
                this.game.wasPhasing = true
                // Set collision group to 1, ignore group 2
                this.game.playerMarble.collider?.setCollisionGroups(0x0001FFFD)

                // Visual feedback - tint purple
                const rcm = this.game.engine.getRenderableManager()
                const inst = rcm.getInstance(this.game.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.7, 0.0, 1.0])
                }
            }
        } else {
            this.game.phaseEnergy = Math.min(this.game.maxPhaseEnergy, this.game.phaseEnergy + 0.5 * meter)

            if (this.game.wasPhasing && this.game.playerMarble) {
                this.game.wasPhasing = false
                // Restore normal collision (collides with everything)
                if (this.game.playerMarble.collider) {
                    this.game.playerMarble.collider.setCollisionGroups(0x0001FFFF)
                }

                // Restore original color when not phasing or out of energy
                if (!this.game.shieldActive && !this.game.vortexActive && this.game.playerMarble.originalColor) {
                    const rcm = this.game.engine.getRenderableManager()
                    const inst = rcm.getInstance(this.game.playerMarble.entity)
                    if (inst) {
                        const matInst = rcm.getMaterialInstanceAt(inst, 0)
                        matInst.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.playerMarble.originalColor)
                    }
                }
            }
        }

        if (this.game.phasebarContainerEl && this.game.phasebarEl) {
            const pct = (this.game.phaseEnergy / this.game.maxPhaseEnergy) * 100
            this.game.phasebarEl.style.width = `${pct}%`

            if (this.game.phaseEnergy < this.game.maxPhaseEnergy || this.game.phaseActive) {
                this.game.phasebarContainerEl.style.display = 'block'
            } else {
                this.game.phasebarContainerEl.style.display = 'none'
            }

            if (this.game.phaseActive && this.game.phaseEnergy > 0) {
                this.game.phasebarEl.style.boxShadow = '0 0 10px #aa00ff'
            } else {
                this.game.phasebarEl.style.boxShadow = 'none'
            }
        }

        // Frost Bridge Logic
        if (this.game.iceActive && this.game.iceEnergy > 0 && this.game.playerMarble) {
            this.game.iceEnergy = Math.max(0, this.game.iceEnergy - 0.5 * meter)

            const now = Date.now()
            if (now - this.game.lastIceTime > this.game.iceCooldown) {
                this.game.lastIceTime = now
                const pos = this.game.playerMarble.rigidBody.translation()
                this.game.spawnIceBlock(pos)
            }
        } else {
            this.game.iceEnergy = Math.min(this.game.maxIceEnergy, this.game.iceEnergy + 0.2 * meter)
        }

        if (this.game.icebarContainerEl && this.game.icebarEl) {
            const pct = (this.game.iceEnergy / this.game.maxIceEnergy) * 100
            this.game.icebarEl.style.width = `${pct}%`

            if (this.game.iceEnergy < this.game.maxIceEnergy || this.game.iceActive) {
                this.game.icebarContainerEl.style.display = 'block'
            } else {
                this.game.icebarContainerEl.style.display = 'none'
            }

            if (this.game.iceActive && this.game.iceEnergy > 0) {
                this.game.icebarEl.style.boxShadow = '0 0 10px #00ffff'
            } else {
                this.game.icebarEl.style.boxShadow = 'none'
            }
        }

        if (audio && audio.setFocus) {
            audio.setFocus(this.game.focusActive)
        }
    }
}

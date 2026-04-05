import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { quaternionToMat4, quatFromEuler } from './math.js';
import { LEVELS } from './levels.js';

export class GameLoopMethods {
    loop() {
        this.pollGamepads()

        if (!this.frameCount) this.frameCount = 0
        this.frameCount++
        if (this.frameCount <= 3) {
            console.log(`[RENDER] Frame ${this.frameCount}, Level: ${this.currentLevel || 'menu'}, Marbles: ${this.marbles.length}`)
        }

        if (this.frameCount % 10 === 0) {
            const debugOverlay = document.getElementById('debug-overlay')
            if (debugOverlay && this.currentLevel) {
                debugOverlay.style.display = 'block'
                document.getElementById('debug-level').textContent = this.currentLevel
                document.getElementById('debug-marbles').textContent = this.marbles.length
                document.getElementById('debug-camera').textContent = this.cameraMode
            }
        }

        // Record Ghost
        if (!this.levelComplete && this.levelStartTime && this.playerMarble && !this.timeStopActive) {
            const t = this.playerMarble.rigidBody.translation()
            const r = this.playerMarble.rigidBody.rotation()
            this.ghostRecording.push({
                t: { x: t.x, y: t.y, z: t.z },
                r: { x: r.x, y: r.y, z: r.z, w: r.w },
                s: this.playerMarble.scale
            })
        }

        // Playback Ghost
        if (this.ghostEntity && this.bestGhosts[this.currentLevel] && !this.timeStopActive) {
            const bestGhost = this.bestGhosts[this.currentLevel]
            if (this.ghostPlaybackIndex < bestGhost.length) {
                const frameData = bestGhost[this.ghostPlaybackIndex]
                const tcm = this.engine.getTransformManager()

                const mat = quaternionToMat4(frameData.t, frameData.r)
                if (frameData.s && frameData.s !== 1.0) {
                    const s = frameData.s
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s
                }
                const inst = tcm.getInstance(this.ghostEntity)
                tcm.setTransform(inst, mat)

                if (this.ghostLightEntity) {
                    const lightInst = tcm.getInstance(this.ghostLightEntity)
                    const lightMat = quaternionToMat4(frameData.t, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }

                this.ghostPlaybackIndex++
            }
        }

        const rotSpeed = 0.02
        const zoomSpeed = 0.5

        // Adrenaline Logic Update
        if (this.playerMarble) {
            const linvel = this.playerMarble.rigidBody.linvel()
            const speed = Math.hypot(linvel.x, linvel.y, linvel.z)

            if (speed > 15) {
                // Increase adrenaline based on speed above 15
                this.adrenaline = Math.min(this.maxAdrenaline, this.adrenaline + (speed - 15) * 0.05)
            } else {
                // Decay adrenaline slowly
                this.adrenaline = Math.max(0, this.adrenaline - 0.2)
            }

            // Camera FOV target
            const targetFov = this.baseFov + (this.adrenaline / this.maxAdrenaline) * 20.0
            this.currentFov = this.currentFov * 0.9 + targetFov * 0.1

            // Generate Camera Shake
            if (this.adrenaline > 20) {
                const shakeIntensity = (this.adrenaline - 20) / 80.0 * 0.5
                this.cameraShake = {
                    x: (Math.random() - 0.5) * shakeIntensity,
                    y: (Math.random() - 0.5) * shakeIntensity,
                    z: (Math.random() - 0.5) * shakeIntensity
                }
            } else {
                this.cameraShake = { x: 0, y: 0, z: 0 }
            }

            // Update Projection FOV each frame
            if (this.camera && this.view && this.Filament && this.Filament.Camera$Fov) {
                const aspect = this.canvas.width / this.canvas.height
                this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, this.Filament.Camera$Fov.VERTICAL)
            }
        }

        if (this.adrenalineBarEl && this.adrenalineBarContainerEl) {
            const pct = (this.adrenaline / this.maxAdrenaline) * 100
            this.adrenalineBarEl.style.width = `${pct}%`
            if (this.adrenaline > 0) {
                this.adrenalineBarContainerEl.style.display = 'block'
            } else {
                this.adrenalineBarContainerEl.style.display = 'none'
            }

            if (this.adrenaline > 80) {
                this.adrenalineBarEl.style.boxShadow = '0 0 15px #ff0000'
            } else {
                this.adrenalineBarEl.style.boxShadow = '0 0 5px #ff0000'
            }
        }

        // Sandbox Builder Logic
        this.buildEnergy = Math.min(this.maxBuildEnergy, this.buildEnergy + 0.1)
        if (this.buildbarEl) {
            const pct = (this.buildEnergy / this.maxBuildEnergy) * 100
            this.buildbarEl.style.width = `${pct}%`

            if (this.buildEnergy >= 25) {
                this.buildbarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ff00)'
            } else {
                this.buildbarEl.style.filter = 'brightness(0.7)'
            }
        }

        // Focus Mechanic Logic
        if (this.keys['KeyF'] && this.focusEnergy > 0) {
            this.focusActive = true
            const targetScale = 0.2
            this.timeScale = this.timeScale * 0.9 + targetScale * 0.1
            this.focusEnergy = Math.max(0, this.focusEnergy - 0.5)
        } else {
            this.focusActive = false
            const targetScale = 1.0
            this.timeScale = this.timeScale * 0.9 + targetScale * 0.1
            this.focusEnergy = Math.min(this.maxFocusEnergy, this.focusEnergy + 0.2)
        }

        // Apply Time Scale to Physics
        if (this.world) {
            this.world.timestep = (1/60) * this.timeScale
        }

        // Time Stop Mechanic Logic
        if (this.timeStopActive && this.timeStopEnergy > 0) {
            this.timeStopEnergy = Math.max(0, this.timeStopEnergy - 0.5)

            if (this.playerMarble) {
                this.world.bodies.forEach(body => {
                    if (body === this.playerMarble.rigidBody) return
                    if (!body.isDynamic()) return

                    // Save state if not already saved
                    if (!this.timeStopSavedStates.has(body.handle)) {
                        const linvel = body.linvel()
                        const angvel = body.angvel()
                        this.timeStopSavedStates.set(body.handle, {
                            linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
                            angvel: { x: angvel.x, y: angvel.y, z: angvel.z }
                        })
                    }

                    // Freeze body
                    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
                    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
                    body.setGravityScale(0, true)
                })
            }
        } else {
            if (this.timeStopActive) {
                // Out of energy, deactivate
                this.timeStopActive = false
                this.world.bodies.forEach(body => {
                    if (body.isDynamic() && this.playerMarble && body !== this.playerMarble.rigidBody) {
                        if (this.timeStopSavedStates.has(body.handle)) {
                            const state = this.timeStopSavedStates.get(body.handle)
                            body.setLinvel(state.linvel, true)
                            body.setAngvel(state.angvel, true)
                            this.timeStopSavedStates.delete(body.handle)
                        }
                        body.setGravityScale(1.0, true)
                    }
                })
                this.timeStopSavedStates.clear()
            }
            this.timeStopEnergy = Math.min(this.maxTimeStopEnergy, this.timeStopEnergy + 0.2)
        }

        if (this.timeStopbarContainerEl && this.timeStopbarEl) {
            const pct = (this.timeStopEnergy / this.maxTimeStopEnergy) * 100
            this.timeStopbarEl.style.width = `${pct}%`

            if (this.timeStopEnergy < this.maxTimeStopEnergy || this.timeStopActive) {
                this.timeStopbarContainerEl.style.display = 'block'
            } else {
                this.timeStopbarContainerEl.style.display = 'none'
            }

            if (this.timeStopActive && this.timeStopEnergy > 0) {
                this.timeStopbarEl.style.boxShadow = '0 0 10px #ffffff'
                // Optional: apply grayscale or color tint to the whole body via CSS
                document.body.style.filter = 'grayscale(80%) contrast(1.2)'
            } else {
                this.timeStopbarEl.style.boxShadow = 'none'
                if (!this.focusActive) { // ensure we don't clear focus active filter
                    document.body.style.filter = 'none'
                }
            }
        }

        // Blink Cooldown Logic
        if (this.blinkCooldown > 0) {
            this.blinkCooldown--
        }
        if (this.teleportBarEl && this.teleportBarContainerEl) {
            if (this.blinkCooldown > 0) {
                this.teleportBarContainerEl.style.display = 'block'
                const pct = ((this.maxBlinkCooldown - this.blinkCooldown) / this.maxBlinkCooldown) * 100
                this.teleportBarEl.style.width = `${pct}%`
                this.teleportBarEl.style.background = '#ff00ff'
            } else {
                this.teleportBarContainerEl.style.display = 'none'
            }
        }

        // Portal Teleportation Logic
        const nowTime = Date.now()
        if (this.portalA && this.portalB && this.playerMarble && (nowTime - this.lastPortalTeleportTime > this.portalCooldown)) {
            const playerPos = this.playerMarble.rigidBody.translation()
            const pRadius = this.playerMarble.scale * 0.5 || 0.5

            // Check dist to Portal A
            const distA = Math.hypot(playerPos.x - this.portalA.pos.x, playerPos.y - this.portalA.pos.y, playerPos.z - this.portalA.pos.z)
            if (distA < 1.5) {
                // Teleport to B
                const outPos = {
                    x: this.portalB.pos.x + this.portalB.normal.x * (pRadius + 0.1),
                    y: this.portalB.pos.y + this.portalB.normal.y * (pRadius + 0.1),
                    z: this.portalB.pos.z + this.portalB.normal.z * (pRadius + 0.1)
                }
                this.playerMarble.rigidBody.setTranslation(outPos, true)
                // Maintain velocity magnitude, change direction to out normal
                const vel = this.playerMarble.rigidBody.linvel()
                const speed = Math.hypot(vel.x, vel.y, vel.z) || 10.0
                this.playerMarble.rigidBody.setLinvel({
                    x: this.portalB.normal.x * speed,
                    y: this.portalB.normal.y * speed,
                    z: this.portalB.normal.z * speed
                }, true)
                this.lastPortalTeleportTime = nowTime
                if (audio && audio.playTrick) audio.playTrick()
            } else {
                // Check dist to Portal B
                const distB = Math.hypot(playerPos.x - this.portalB.pos.x, playerPos.y - this.portalB.pos.y, playerPos.z - this.portalB.pos.z)
                if (distB < 1.5) {
                    // Teleport to A
                    const outPos = {
                        x: this.portalA.pos.x + this.portalA.normal.x * (pRadius + 0.1),
                        y: this.portalA.pos.y + this.portalA.normal.y * (pRadius + 0.1),
                        z: this.portalA.pos.z + this.portalA.normal.z * (pRadius + 0.1)
                    }
                    this.playerMarble.rigidBody.setTranslation(outPos, true)
                    const vel = this.playerMarble.rigidBody.linvel()
                    const speed = Math.hypot(vel.x, vel.y, vel.z) || 10.0
                    this.playerMarble.rigidBody.setLinvel({
                        x: this.portalA.normal.x * speed,
                        y: this.portalA.normal.y * speed,
                        z: this.portalA.normal.z * speed
                    }, true)
                    this.lastPortalTeleportTime = nowTime
                    if (audio && audio.playTrick) audio.playTrick()
                }
            }
        }

        // Update Focus UI and Effects
        if (this.focusBarEl) {
            const pct = (this.focusEnergy / this.maxFocusEnergy) * 100
            this.focusBarEl.style.width = `${pct}%`

            if (this.focusActive) {
                this.focusBarEl.style.boxShadow = '0 0 10px #7b00ff'
                document.body.style.filter = 'contrast(1.2) saturate(0.5) brightness(1.1)'
            } else {
                this.focusBarEl.style.boxShadow = 'none'
                document.body.style.filter = 'none'
            }
        }

        if (this.isRewinding && this.playerMarble) {
            if (this.rewindHistory.length > 0) {
                const state = this.rewindHistory.pop()
                this.playerMarble.rigidBody.setTranslation(state.pos, true)
                this.playerMarble.rigidBody.setRotation(state.rot, true)
                this.playerMarble.rigidBody.setLinvel(state.linvel, true)
                this.playerMarble.rigidBody.setAngvel(state.angvel, true)

                // Visual effect for rewind
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                // Tint red/orange
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.2, 0.0])
            }
        } else if (this.playerMarble) {
             const rb = this.playerMarble.rigidBody
             const pos = rb.translation()
             const rot = rb.rotation()
             const linvel = rb.linvel()
             const angvel = rb.angvel()

             this.rewindHistory.push({
                 pos: { x: pos.x, y: pos.y, z: pos.z },
                 rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
                 linvel: { x: linvel.x, y: linvel.y, z: linvel.z },
                 angvel: { x: angvel.x, y: angvel.y, z: angvel.z }
             })

             if (this.rewindHistory.length > this.maxRewindFrames) {
                 this.rewindHistory.shift()
             }
        }

        if (this.rewindBarEl) {
            const pct = (this.rewindHistory.length / this.maxRewindFrames) * 100
            this.rewindBarEl.style.width = `${pct}%`
        }

        if (this.gravityBarEl) {
            if (this.activeEffects.gravity && Date.now() < this.activeEffects.gravity) {
                const timeLeft = this.activeEffects.gravity - Date.now()
                const pct = (timeLeft / 5000) * 100
                this.gravityBarEl.style.width = `${pct}%`
                this.gravityBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ffcc00)'

                if (this.playerMarble) {
                    // Apply counter-gravity impulse
                    const mass = this.playerMarble.rigidBody.mass()
                    // Counteract mostly gravity (-9.81 * mass * timestep)
                    // Apply a steady upward force so it feels floaty
                    this.playerMarble.rigidBody.applyImpulse({ x: 0, y: 0.16 * mass, z: 0 }, true)
                }
            } else {
                this.gravityBarEl.style.width = `0%`
                this.gravityBarEl.style.filter = 'none'
            }
        }

        // Vortex Mechanic
        if (this.vortexActive && this.vortexEnergy > 0) {
            this.vortexEnergy = Math.max(0, this.vortexEnergy - 1.0)
            if (this.playerMarble) {
                const playerPos = this.playerMarble.rigidBody.translation()
                const radius = 15.0
                const attractionForce = 2.0
                const tangentialForce = 1.5

                this.world.bodies.forEach(body => {
                    if (body === this.playerMarble.rigidBody) return
                    if (!body.isDynamic()) return

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

                        body.applyImpulse({ x: fx + tx, y: fy + ty + liftForce, z: fz + tz }, true)
                    }
                })

                // Visual feedback - tint magenta
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.0, 1.0])
                }
            }
        } else {
            this.vortexEnergy = Math.min(this.maxVortexEnergy, this.vortexEnergy + 0.5)

            // Restore original color when not using vortex or out of energy
            if (!this.shieldActive && this.playerMarble && this.playerMarble.originalColor) {
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.originalColor)
                }
            }
        }

        if (this.vortexbarContainerEl && this.vortexbarEl) {
            const pct = (this.vortexEnergy / this.maxVortexEnergy) * 100
            this.vortexbarEl.style.width = `${pct}%`

            if (this.vortexEnergy < this.maxVortexEnergy || this.vortexActive) {
                this.vortexbarContainerEl.style.display = 'block'
            } else {
                this.vortexbarContainerEl.style.display = 'none'
            }

            if (this.vortexActive && this.vortexEnergy > 0) {
                this.vortexbarEl.style.boxShadow = '0 0 10px #ff00ff'
            } else {
                this.vortexbarEl.style.boxShadow = 'none'
            }
        }

        if (this.shieldActive && this.shieldEnergy > 0) {
            this.shieldEnergy -= 1.0
            if (this.shieldEnergy < 0) this.shieldEnergy = 0

            if (this.playerMarble) {
                const playerPos = this.playerMarble.rigidBody.translation()
                const radius = 5.0
                const force = 3.0

                // Repel other dynamic bodies
                this.world.bodies.forEach(body => {
                    if (body === this.playerMarble.rigidBody) return
                    if (!body.isDynamic()) return

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

                        body.applyImpulse({ x: fx, y: fy, z: fz }, true)
                    }
                })

                // Visual feedback - tint cyan
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
                }
            }
        } else {
            this.shieldEnergy += 0.2
            if (this.shieldEnergy > this.maxShieldEnergy) this.shieldEnergy = this.maxShieldEnergy

            // Restore original color when not shielding or out of energy
            if (this.playerMarble && this.playerMarble.originalColor) {
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.originalColor)
                }
            }
        }

        if (this.shieldbarEl) {
            const pct = (this.shieldEnergy / this.maxShieldEnergy) * 100
            this.shieldbarEl.style.width = `${pct}%`
            if (this.shieldActive && this.shieldEnergy > 0) {
                this.shieldbarEl.style.boxShadow = '0 0 10px #00ffff'
            } else {
                this.shieldbarEl.style.boxShadow = 'none'
            }
        }

        if (this.hoverActive && this.hoverEnergy > 0) {
            if (this.playerMarble) {
                const mass = this.playerMarble.rigidBody.mass()
                const linvel = this.playerMarble.rigidBody.linvel()
                const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1
                if ((gravityDir > 0 && linvel.y < 0) || (gravityDir < 0 && linvel.y > 0)) {
                    this.playerMarble.rigidBody.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)
                }
                this.playerMarble.rigidBody.applyImpulse({ x: 0, y: 0.1635 * mass * gravityDir, z: 0 }, true)
            }
            this.hoverEnergy = Math.max(0, this.hoverEnergy - 0.5)
        } else {
            if (this.playerMarble && this.isGrounded(this.playerMarble)) {
                this.hoverEnergy = Math.min(this.maxHoverEnergy, this.hoverEnergy + 0.2)
            }
        }

        // Glider Logic
        if (this.gliderActive && this.gliderEnergy > 0) {
            if (this.playerMarble) {
                const mass = this.playerMarble.rigidBody.mass()
                const linvel = this.playerMarble.rigidBody.linvel()
                const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1

                // Counteract some gravity to fall slower
                if ((gravityDir > 0 && linvel.y < 0) || (gravityDir < 0 && linvel.y > 0)) {
                    this.playerMarble.rigidBody.setLinvel({ x: linvel.x, y: linvel.y * 0.9, z: linvel.z }, true)
                    this.playerMarble.rigidBody.applyImpulse({ x: 0, y: 0.1 * mass * gravityDir, z: 0 }, true)
                }

                // Apply forward thrust based on view direction
                const cosP = Math.cos(this.pitchAngle)
                const sinP = Math.sin(this.pitchAngle)
                const dirX = Math.sin(this.aimYaw) * cosP
                const dirY = sinP // Allowing slight pitch to affect upward/downward glide
                const dirZ = Math.cos(this.aimYaw) * cosP

                const glideThrust = 0.5 * mass
                this.playerMarble.rigidBody.applyImpulse({
                    x: dirX * glideThrust,
                    y: dirY * glideThrust,
                    z: dirZ * glideThrust
                }, true)

                if (audio && audio.playBoost && Math.random() < 0.1) {
                    audio.playBoost() // Play sound occasionally for feedback
                }
            }
            this.gliderEnergy = Math.max(0, this.gliderEnergy - 0.4)
        } else {
            if (this.playerMarble && this.isGrounded(this.playerMarble)) {
                this.gliderEnergy = Math.min(this.maxGliderEnergy, this.gliderEnergy + 0.3)
            }
        }

        // Jetpack Logic
        if (this.jetpackActive && this.jetpackEnergy > 0) {
            if (this.playerMarble) {
                const rb = this.playerMarble.rigidBody
                const mass = rb.mass()
                const cosP = Math.cos(this.pitchAngle)
                const sinP = Math.sin(this.pitchAngle)

                // Thrust vector aligned with camera aim, but mainly upwards
                const dirX = Math.sin(this.aimYaw) * cosP
                const dirY = 1.0 // Always push up
                const dirZ = Math.cos(this.aimYaw) * cosP

                // Apply continuous force while active
                // Stronger than hover to actually ascend
                rb.applyImpulse({
                    x: dirX * mass * 0.1,
                    y: dirY * mass * 0.25,
                    z: dirZ * mass * 0.1
                }, true)

                const pos = rb.translation()
                const linvel = rb.linvel()
                // Spawn exhaust particles
                if (this.frameCount % 2 === 0) {
                    this.spawnJetpackExhaust(pos, linvel)
                }

                // Play continuous thrust sound
                if (this.frameCount % 5 === 0 && audio && audio.playBoost) {
                    // We could add a specialized loop sound, but boosting repeatedly gives a sputtering jet effect
                    audio.playBoost()
                }
            }
            this.jetpackEnergy = Math.max(0, this.jetpackEnergy - 1.0) // Drains faster than hover
        } else {
            if (this.playerMarble && this.isGrounded(this.playerMarble)) {
                this.jetpackEnergy = Math.min(this.maxJetpackEnergy, this.jetpackEnergy + 0.5)
            }
        }

        if (this.jetpackbarEl && this.jetpackbarContainerEl) {
            const pct = (this.jetpackEnergy / this.maxJetpackEnergy) * 100
            this.jetpackbarEl.style.width = `${pct}%`

            if (this.jetpackEnergy < this.maxJetpackEnergy || this.jetpackActive) {
                this.jetpackbarContainerEl.style.display = 'block'
            } else {
                this.jetpackbarContainerEl.style.display = 'none'
            }

            if (this.jetpackActive && this.jetpackEnergy > 0) {
                this.jetpackbarEl.style.boxShadow = '0 0 10px #ffaa00'
            } else {
                this.jetpackbarEl.style.boxShadow = 'none'
            }
        }

        if (this.hoverBarEl) {
            const pct = (this.hoverEnergy / this.maxHoverEnergy) * 100
            this.hoverBarEl.style.width = `${pct}%`
            if (this.hoverActive && this.hoverEnergy > 0) {
                this.hoverBarEl.style.boxShadow = '0 0 10px #00ffcc'
            } else {
                this.hoverBarEl.style.boxShadow = 'none'
            }
        }

        if (this.gliderBarEl && this.gliderBarContainerEl) {
            const pct = (this.gliderEnergy / this.maxGliderEnergy) * 100
            this.gliderBarEl.style.width = `${pct}%`

            if (this.gliderEnergy < this.maxGliderEnergy || this.gliderActive) {
                this.gliderBarContainerEl.style.display = 'block'
            } else {
                this.gliderBarContainerEl.style.display = 'none'
            }

            if (this.gliderActive && this.gliderEnergy > 0) {
                this.gliderBarEl.style.boxShadow = '0 0 10px #aaffaa'
            } else {
                this.gliderBarEl.style.boxShadow = 'none'
            }
        }

        // Gravity Flip Logic
        if (this.flipActive && this.flipEnergy > 0 && this.playerMarble) {
            this.flipEnergy = Math.max(0, this.flipEnergy - 0.5)
            this.playerMarble.rigidBody.setGravityScale(-this.playerMarble.baseGravityScale, true)
        } else if (this.flipActive && this.flipEnergy <= 0) {
            this.flipActive = false
            if (this.playerMarble) {
                this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
            }
        } else if (!this.flipActive) {
            this.flipEnergy = Math.min(this.maxFlipEnergy, this.flipEnergy + 0.2)
            if (this.playerMarble) {
                this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
            }
        }

        if (this.flipbarContainerEl && this.flipbarEl) {
            const pct = (this.flipEnergy / this.maxFlipEnergy) * 100
            this.flipbarEl.style.width = `${pct}%`

            if (this.flipEnergy < this.maxFlipEnergy || this.flipActive) {
                this.flipbarContainerEl.style.display = 'block'
            } else {
                this.flipbarContainerEl.style.display = 'none'
            }

            if (this.flipActive && this.flipEnergy > 0) {
                this.flipbarEl.style.boxShadow = '0 0 10px #ff00ff'
            } else {
                this.flipbarEl.style.boxShadow = 'none'
            }
        }

        // Phase Shift Logic
        if (this.phaseActive && this.phaseEnergy > 1.0 && this.playerMarble) {
            this.phaseEnergy = Math.max(0, this.phaseEnergy - 1.0)

            if (!this.wasPhasing) {
                this.wasPhasing = true
                // Set collision group to 1, ignore group 2
                this.playerMarble.collider.setCollisionGroups(0x0001FFFD)

                // Visual feedback - tint purple
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.7, 0.0, 1.0])
                }
            }
        } else {
            this.phaseEnergy = Math.min(this.maxPhaseEnergy, this.phaseEnergy + 0.5)

            if (this.wasPhasing && this.playerMarble) {
                this.wasPhasing = false
                // Restore normal collision (collides with everything)
                if (this.playerMarble.collider) {
                    this.playerMarble.collider.setCollisionGroups(0x0001FFFF)
                }

                // Restore original color when not phasing or out of energy
                if (!this.shieldActive && !this.vortexActive && this.playerMarble.originalColor) {
                    const rcm = this.engine.getRenderableManager()
                    const inst = rcm.getInstance(this.playerMarble.entity)
                    if (inst) {
                        const matInst = rcm.getMaterialInstanceAt(inst, 0)
                        matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.originalColor)
                    }
                }
            }
        }

        if (this.phasebarContainerEl && this.phasebarEl) {
            const pct = (this.phaseEnergy / this.maxPhaseEnergy) * 100
            this.phasebarEl.style.width = `${pct}%`

            if (this.phaseEnergy < this.maxPhaseEnergy || this.phaseActive) {
                this.phasebarContainerEl.style.display = 'block'
            } else {
                this.phasebarContainerEl.style.display = 'none'
            }

            if (this.phaseActive && this.phaseEnergy > 0) {
                this.phasebarEl.style.boxShadow = '0 0 10px #aa00ff'
            } else {
                this.phasebarEl.style.boxShadow = 'none'
            }
        }

        // Frost Bridge Logic
        if (this.iceActive && this.iceEnergy > 0 && this.playerMarble) {
            this.iceEnergy = Math.max(0, this.iceEnergy - 0.5)

            const now = Date.now()
            if (now - this.lastIceTime > this.iceCooldown) {
                this.lastIceTime = now
                const pos = this.playerMarble.rigidBody.translation()
                this.spawnIceBlock(pos)
            }
        } else {
            this.iceEnergy = Math.min(this.maxIceEnergy, this.iceEnergy + 0.2)
        }

        if (this.icebarContainerEl && this.icebarEl) {
            const pct = (this.iceEnergy / this.maxIceEnergy) * 100
            this.icebarEl.style.width = `${pct}%`

            if (this.iceEnergy < this.maxIceEnergy || this.iceActive) {
                this.icebarContainerEl.style.display = 'block'
            } else {
                this.icebarContainerEl.style.display = 'none'
            }

            if (this.iceActive && this.iceEnergy > 0) {
                this.icebarEl.style.boxShadow = '0 0 10px #00ffff'
            } else {
                this.icebarEl.style.boxShadow = 'none'
            }
        }

        if (audio && audio.setFocus) {
            audio.setFocus(this.focusActive)
        }

        if (this.keys['KeyR']) {
            this.resetMarbles()
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
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.camAngle -= rotSpeed
            if (this.keys['ArrowRight'] || this.keys['KeyD']) this.camAngle += rotSpeed
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.camRadius = Math.max(5, this.camRadius - zoomSpeed)
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.camRadius = Math.min(100, this.camRadius + zoomSpeed)
        } else if (this.cameraMode === 'follow' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown') {
            let impulseStrength = 0.5
            if (this.activeEffects.speed && Date.now() < this.activeEffects.speed) {
                impulseStrength *= 2.0
            }

            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody

                const forwardX = Math.sin(this.aimYaw)
                const forwardZ = Math.cos(this.aimYaw)
                const rightX = Math.sin(this.aimYaw - Math.PI / 2)
                const rightZ = Math.cos(this.aimYaw - Math.PI / 2)

                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: forwardX * impulseStrength, y: 0, z: forwardZ * impulseStrength }, true)
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: -forwardX * impulseStrength, y: 0, z: -forwardZ * impulseStrength }, true)
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: rightX * impulseStrength, y: 0, z: rightZ * impulseStrength }, true)
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: -rightX * impulseStrength, y: 0, z: -rightZ * impulseStrength }, true)
            }
        }

        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            const now = Date.now()
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
            }
        }

        if (this.boostBarEl) {
            const now = Date.now()
            const timeSince = now - this.lastBoostTime
            const progress = Math.min(1.0, timeSince / this.boostCooldown)
            this.boostBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.boostBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #f0f)'
            } else {
               this.boostBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.dashBarEl) {
            const now = Date.now()
            const timeSince = now - this.lastDashTime
            const progress = Math.min(1.0, timeSince / this.dashCooldown)
            this.dashBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.dashBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
            } else {
               this.dashBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.isChargingJump) {
            this.jumpCharge = Math.min(1.0, this.jumpCharge + 0.03)
            if (this.jumpBarEl) this.jumpBarEl.style.width = `${this.jumpCharge * 100}%`
        }

        if (this.charging) {
            this.chargePower = Math.min(1.0, this.chargePower + 0.015)
        }

        if (!this.levelComplete && this.levelStartTime) {
            const time = ((Date.now() - this.levelStartTime) / 1000).toFixed(2)
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

        if (this.magnetBarEl) {
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

        const yawDeg = Math.round(this.aimYaw * 180 / Math.PI)
        const pitchDeg = Math.round(this.pitchAngle * 180 / Math.PI)
        this.aimEl.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`
        this.powerbarEl.style.width = `${this.chargePower * 100}%`

        if ((this.cameraMode === 'follow' || this.cameraMode === 'fpv' || this.cameraMode === 'topdown') && this.currentLevel) {
            const level = LEVELS[this.currentLevel]
            const target = this.playerMarble || this.getLeader()
            if (target) {
                const t = target.rigidBody.translation()
                if (this.cameraMode === 'follow') {
                    const height = level?.camera?.height || 10
                    const dist = 20

                    const eyeX = t.x - Math.sin(this.aimYaw) * dist + this.cameraShake.x
                    const eyeY = t.y + height + this.cameraShake.y
                    const eyeZ = t.z - Math.cos(this.aimYaw) * dist + this.cameraShake.z

                    this.camera.lookAt([eyeX, eyeY, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
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
                }
            }
        } else {
            const eyeX = this.camRadius * Math.sin(this.camAngle) + this.cameraShake.x
            const eyeY = this.camHeight + this.cameraShake.y
            const eyeZ = this.camRadius * Math.cos(this.camAngle) + this.cameraShake.z
            this.camera.lookAt([eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0])
        }

        // Update Moving Platforms
        const now = Date.now()
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

            const tcm = this.engine.getTransformManager()
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

            const tcm = this.engine.getTransformManager()
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

            const tcm = this.engine.getTransformManager()
            const inst = tcm.getInstance(p.entity)
            tcm.setTransform(inst, mat)
        }

        // Update Collectibles
        if (!this.timeStopActive) {
            this.collectibleRotation += 0.05
        }
        if (this.collectibles && this.collectibles.length > 0) {
            const tcm = this.engine.getTransformManager()
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
                        this.comboTimer = Date.now()
                        if (this.comboEl) {
                            this.comboEl.style.display = 'block'
                            this.comboEl.textContent = `Combo: x${this.combo}`
                            this.comboEl.style.transform = 'scale(1.2)'
                            setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
                        }
                        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'

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
        let comboTimeElapsed = Date.now() - this.comboTimer

        // Adrenaline pauses combo decay if high
        if (this.adrenaline && this.adrenaline > 80) {
            this.comboTimer = Date.now() // Keep resetting it so it never expires
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
        const effectsContainer = document.getElementById('active-effects')
        if (effectsContainer) {
            const now = Date.now()
            const active = []
            for (const [type, endTime] of Object.entries(this.activeEffects)) {
                if (now < endTime) {
                    const timeLeft = Math.ceil((endTime - now) / 1000)
                    active.push(`${type.toUpperCase()}: ${timeLeft}s`)
                } else {
                    delete this.activeEffects[type]
                }
            }
            effectsContainer.textContent = active.join(' | ')
        }

        if (this.sizebarContainerEl && this.sizebarEl) {
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

        if (this.holobarContainerEl && this.holobarEl) {
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

        if (this.chameleonBarContainerEl && this.chameleonBarEl) {
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

        if (this.teleportBarEl) {
            const timeSinceTeleport = now - this.lastTeleportTime
            const progress = Math.min(1.0, timeSinceTeleport / this.teleportCooldown)
            this.teleportBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.teleportBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #cc00ff)'
            } else {
               this.teleportBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.missileBarEl) {
            const timeSinceMissile = now - this.lastMissileTime
            const progress = Math.min(1.0, timeSinceMissile / this.missileCooldown)
            this.missileBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.missileBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8c00)'
            } else {
               this.missileBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.bombBarEl) {
            const timeSinceBomb = now - this.lastBombTime
            const progress = Math.min(1.0, timeSinceBomb / this.bombCooldown)
            this.bombBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.bombBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff4500)'
            } else {
               this.bombBarEl.style.filter = 'brightness(0.7)'
            }
        }

        if (this.missileBarEl) {
            const timeSinceMissile = now - this.lastMissileTime
            const progress = Math.min(1.0, timeSinceMissile / this.missileCooldown)
            this.missileBarEl.style.width = `${progress * 100}%`

            if (progress >= 1.0) {
               this.missileBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #ff8800)'
            } else {
               this.missileBarEl.style.filter = 'brightness(0.7)'
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
                const tcm = this.engine.getTransformManager()
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
                const tcm = this.engine.getTransformManager()
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

        // Handle visual particles lifecycle
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            const p = this.visualParticles[i]
            const timeAlive = now - p.spawnTime

            if (timeAlive > p.duration) {
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
                this.visualParticles.splice(i, 1)
            } else {
                if (p.isRing) {
                    // Expanding ring logic
                    const progress = timeAlive / p.duration
                    p.scale = 1.0 + progress * 20.0 // Expands outwards

                    if (p.matInstance) {
                        const r = 1.0 - progress
                        const g = 0.2 - progress * 0.2
                        const b = 0.0
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const sXZ = 0.1 * p.scale // Base size * expansion
                    const sY = 0.1 * (1.0 - progress) // Flatten out as it expands
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(inst, mat)
                } else {
                    // Animate position
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016

                    // Shrink
                    p.scale = Math.max(0, 1.0 - (timeAlive / p.duration))

                    // Fade to dark red/smoke
                    if (p.matInstance) {
                        const progress = timeAlive / p.duration
                        const r = 1.0 - progress * 0.8
                        const g = 0.6 - progress * 0.6
                        const b = 0.0
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const s = 0.2 * p.scale // Base size * animation scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(inst, mat)
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
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
                this.temporaryPlatforms.splice(i, 1)
            } else {
                const timeLeft = maxDuration - timeAlive
                if (timeLeft < 1000) {
                    const blink = Math.floor(now / 100) % 2 === 0
                    if (p.matInstance && !p.duration) { // Only blink Holo-platforms, not ice blocks
                        const color = blink ? [1.0, 0.0, 0.0] : [0.0, 1.0, 1.0]
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
                    } else if (p.matInstance && p.duration) {
                        // Fade/blink out ice blocks subtly
                        const scale = blink ? 0.9 : 1.0
                        const tcm = this.engine.getTransformManager()
                        const inst = tcm.getInstance(p.entity)
                        const mat = tcm.getTransform(inst)

                        // We shouldn't modify the main transform's scaling easily without recreating it.
                        // So let's just change color to whiteish.
                        const color = blink ? [1.0, 1.0, 1.0] : [0.5, 0.9, 1.0]
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
                    }
                }
            }
        }

        this.world.step()
        this.processCollisionEvents()
        this.checkGameLogic()

        const tcm = this.engine.getTransformManager()
        for (const m of this.marbles) {
            const t = m.rigidBody.translation()
            const r = m.rigidBody.rotation()
            const mat = quaternionToMat4(t, r)

            if (m.scale && m.scale !== 1.0) {
                mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale
                mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale
                mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale
            }

            const inst = tcm.getInstance(m.entity)
            tcm.setTransform(inst, mat)

            if (m.rainbow) {
                const time = Date.now() * 0.002
                const r = Math.sin(time) * 0.5 + 0.5
                const g = Math.sin(time + 2.094) * 0.5 + 0.5
                const b = Math.sin(time + 4.188) * 0.5 + 0.5
                const rcm = this.engine.getRenderableManager()
                const renderInst = rcm.getInstance(m.entity)
                rcm.getMaterialInstanceAt(renderInst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
            }

            if (m.lightEntity) {
                const lightInst = tcm.getInstance(m.lightEntity)
                const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                tcm.setTransform(lightInst, lightMat)
            }
        }

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

            const inst = tcm.getInstance(obj.entity)
            tcm.setTransform(inst, mat)
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
            let mat = quaternionToMat4(cuePos, quat)
            const thin = 0.04
            mat[0] *= thin; mat[1] *= thin; mat[2] *= thin
            mat[4] *= thin; mat[5] *= thin; mat[6] *= thin
            mat[8] *= length; mat[9] *= length; mat[10] *= length
            this.engine.getTransformManager().setTransform(this.cueInst, mat)
        } else if (this.cueInst) {
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            this.engine.getTransformManager().setTransform(this.cueInst, zeroMat)
        }

        if (this.renderer && this.swapChain && this.view) {
            if (this.renderer.beginFrame(this.swapChain)) {
                this.renderer.renderView(this.view)
                this.renderer.endFrame()
            }
            this.engine.execute()
        }
        requestAnimationFrame(() => this.loop())
    }
}

export function applyGameLoopMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopMethods.prototype[name];
        }
    }
}

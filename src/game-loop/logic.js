import { audio } from '../audio.js';
import { quaternionToMat4 } from '../math.js';

export class GameLoopLogic {
    updateGameState() {
        // Skip game updates when paused (but keep polling for pause toggle)
        if (this.isPaused) {
            // Still render the scene, just don't update game state
            return
        }

        // Note: gamepads are already polled once per frame in loop(); no need
        // to poll again here.

        // Party race: relay transform sync (arcade mode, not physics-authoritative)
        if (this.multiplayerMode) {
            this.tickMultiplayer?.()
        }

        this.touchControls?.tick()

        // Record / playback ghost replay (30 Hz, visual-only)
        if (this.ghostReplay) {
            this.ghostReplay.tickRecord(this)

            const ghostFrame = this.ghostReplay.tickPlayback(this)
            if (ghostFrame && this.ghostEntity) {
                const tcm = this.engine.getTransformManager()
                const rot = { x: ghostFrame.qx, y: ghostFrame.qy, z: ghostFrame.qz, w: ghostFrame.qw }
                const pos = { x: ghostFrame.x, y: ghostFrame.y, z: ghostFrame.z }
                const mat = quaternionToMat4(pos, rot)
                const inst = tcm.getInstance(this.ghostEntity)
                tcm.setTransform(inst, mat)

                if (this.ghostLightEntity) {
                    const lightInst = tcm.getInstance(this.ghostLightEntity)
                    const lightMat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })
                    tcm.setTransform(lightInst, lightMat)
                }
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

            // Generate Camera Shake (respect accessibility setting)
            const shakeMultiplier = this.getScreenShakeIntensity ? this.getScreenShakeIntensity() : 1.0
            // Reuse a single cameraShake object instead of allocating a new one
            // every frame (this runs at 60 FPS and would otherwise churn the GC).
            if (!this.cameraShake) this.cameraShake = { x: 0, y: 0, z: 0 }
            const shake = this.cameraShake
            if (this.adrenaline > 20 && shakeMultiplier > 0) {
                const shakeIntensity = (this.adrenaline - 20) / 80.0 * 0.5 * shakeMultiplier
                shake.x = (Math.random() - 0.5) * shakeIntensity
                shake.y = (Math.random() - 0.5) * shakeIntensity
                shake.z = (Math.random() - 0.5) * shakeIntensity
            } else {
                shake.x = 0; shake.y = 0; shake.z = 0
            }

            // Add Tremor Camera Shake
            if (this.tremorShakeTimer && this.tremorShakeTimer > 0) {
                const tremorIntensity = (this.tremorShakeTimer / 30.0) * 1.5 * shakeMultiplier
                this.cameraShake.x += (Math.random() - 0.5) * tremorIntensity
                this.cameraShake.y += (Math.random() - 0.5) * tremorIntensity
                this.cameraShake.z += (Math.random() - 0.5) * tremorIntensity
                this.tremorShakeTimer--
            }

            // Update Projection FOV each frame
            if (this.camera && this.view && this.Filament && this.Filament.Camera$Fov) {
                const aspect = this.canvas.width / this.canvas.height
                this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, this.Filament.Camera$Fov.VERTICAL)
            }

            // Update speed lines effect based on marble velocity
            this.updateSpeedLines(speed)
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
            if (!this.focusActive && this.hudManager) {
                this.hudManager.markAbilityUsed('focus')
            }
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
                const playerRb = this.playerMarble.rigidBody
                for (const body of this.dynamicBodies) {
                    if (body === playerRb) continue

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
                }
            }
        } else {
            if (this.timeStopActive) {
                // Out of energy, deactivate
                this.timeStopActive = false
                const playerRb = this.playerMarble ? this.playerMarble.rigidBody : null
                for (const body of this.dynamicBodies) {
                    if (body !== playerRb) {
                        if (this.timeStopSavedStates.has(body.handle)) {
                            const state = this.timeStopSavedStates.get(body.handle)
                            body.setLinvel(state.linvel, true)
                            body.setAngvel(state.angvel, true)
                            this.timeStopSavedStates.delete(body.handle)
                        }
                        body.setGravityScale(1.0, true)
                    }
                }
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

        // EMP Bar Logic
        if (this.empBarEl && this.empBarContainerEl) {
            const now = Date.now()
            const timeSinceLastEmp = now - this.lastEmpTime
            if (timeSinceLastEmp < this.empCooldown) {
                this.empBarContainerEl.style.display = 'block'
                const pct = (timeSinceLastEmp / this.empCooldown) * 100
                this.empBarEl.style.width = `${pct}%`
            } else {
                this.empBarContainerEl.style.display = 'none'
                this.empBarEl.style.width = '100%'
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
            if (this._rewindCount > 0) {
                // Pop last frame from ring buffer
                this._rewindCount--
                this._rewindHead = (this._rewindHead - 1 + this.maxRewindFrames) % this.maxRewindFrames
                const base = this._rewindHead * 13
                const buf = this._rewindBuffer
                this.playerMarble.rigidBody.setTranslation({ x: buf[base],     y: buf[base + 1], z: buf[base + 2] }, true)
                this.playerMarble.rigidBody.setRotation(   { x: buf[base + 3], y: buf[base + 4], z: buf[base + 5], w: buf[base + 6] }, true)
                this.playerMarble.rigidBody.setLinvel(     { x: buf[base + 7], y: buf[base + 8], z: buf[base + 9] }, true)
                this.playerMarble.rigidBody.setAngvel(     { x: buf[base + 10], y: buf[base + 11], z: buf[base + 12] }, true)

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

             // Push frame into ring buffer (overwrites oldest when full)
             const base = this._rewindHead * 13
             const buf = this._rewindBuffer
             buf[base]      = pos.x;    buf[base + 1]  = pos.y;    buf[base + 2]  = pos.z
             buf[base + 3]  = rot.x;    buf[base + 4]  = rot.y;    buf[base + 5]  = rot.z;   buf[base + 6]  = rot.w
             buf[base + 7]  = linvel.x; buf[base + 8]  = linvel.y; buf[base + 9]  = linvel.z
             buf[base + 10] = angvel.x; buf[base + 11] = angvel.y; buf[base + 12] = angvel.z
             this._rewindHead = (this._rewindHead + 1) % this.maxRewindFrames
             if (this._rewindCount < this.maxRewindFrames) this._rewindCount++
        }

        if (this.rewindBarEl) {
            const pct = (this._rewindCount / this.maxRewindFrames) * 100
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

                const playerRb = this.playerMarble.rigidBody
                for (const body of this.dynamicBodies) {
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

                        body.applyImpulse({ x: fx + tx, y: fy + ty + liftForce, z: fz + tz }, true)
                    }
                }

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
                const playerRb = this.playerMarble.rigidBody
                for (const body of this.dynamicBodies) {
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

                        body.applyImpulse({ x: fx, y: fy, z: fz }, true)
                    }
                }

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
            if (this.playerMarble && this.playerMarble.originalColor && !this.violetActive) {
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

        // Violet Light Logic
        if (this.violetActive && this.violetEnergy > 0) {
            this.violetEnergy -= 1.0
            if (this.violetEnergy < 0) this.violetEnergy = 0

            if (this.playerMarble) {
                const playerPos = this.playerMarble.rigidBody.translation()
                const radius = 15.0
                const force = 0.5

                // Repel other dynamic bodies
                const playerRb = this.playerMarble.rigidBody
                for (const body of this.dynamicBodies) {
                    if (body === playerRb) continue

                    const bodyPos = body.translation()
                    const dx = bodyPos.x - playerPos.x
                    const dy = bodyPos.y - playerPos.y
                    const dz = bodyPos.z - playerPos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq < radius * radius && distSq > 0.001) {
                        const dist = Math.sqrt(distSq)
                        const fx = (dx / dist) * force * body.mass()
                        const fy = (dy / dist) * force * body.mass()
                        const fz = (dz / dist) * force * body.mass()

                        body.applyImpulse({ x: fx, y: fy, z: fz }, true)
                    }
                }

                // Create or update Violet Light Entity
                if (!this.violetLightEntity) {
                    this.violetLightEntity = this.Filament.EntityManager.get().create()
                    this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
                        .color([0.6, 0.0, 1.0])
                        .intensity(100000.0)
                        .falloff(radius)
                        .build(this.engine, this.violetLightEntity)
                    this.scene.addEntity(this.violetLightEntity)
                }

                const tcm = this.engine.getTransformManager()
                const lightInst = tcm.getInstance(this.violetLightEntity)
                const lightMat = quaternionToMat4(playerPos, { x: 0, y: 0, z: 0, w: 1 })
                tcm.setTransform(lightInst, lightMat)

                // Visual feedback - tint violet
                if (!this.shieldActive) {
                    const rcm = this.engine.getRenderableManager()
                    const inst = rcm.getInstance(this.playerMarble.entity)
                    if (inst) {
                        const matInst = rcm.getMaterialInstanceAt(inst, 0)
                        matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.6, 0.0, 1.0])
                    }
                }
            }
        } else {
            this.violetEnergy += 0.2
            if (this.violetEnergy > this.maxVioletEnergy) this.violetEnergy = this.maxVioletEnergy

            // Destroy Violet Light Entity
            if (this.violetLightEntity) {
                this.scene.remove(this.violetLightEntity)
                this.engine.destroyEntity(this.violetLightEntity)
                this.Filament.EntityManager.get().destroy(this.violetLightEntity)
                this.violetLightEntity = null
            }

            // Restore original color when not shielding, phasing, vortexing, or violetting
            if (this.playerMarble && this.playerMarble.originalColor && !this.shieldActive && !this.vortexActive && !this.wasPhasing) {
                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                if (inst) {
                    const matInst = rcm.getMaterialInstanceAt(inst, 0)
                    matInst.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.originalColor)
                }
            }
        }

        if (this.violetbarEl && this.violetbarContainerEl) {
            const pct = (this.violetEnergy / this.maxVioletEnergy) * 100
            this.violetbarEl.style.width = `${pct}%`

            if (this.violetEnergy < this.maxVioletEnergy || this.violetActive) {
                this.violetbarContainerEl.style.display = 'block'
            } else {
                this.violetbarContainerEl.style.display = 'none'
            }

            if (this.violetActive && this.violetEnergy > 0) {
                this.violetbarEl.style.boxShadow = '0 0 10px #ee82ee'
            } else {
                this.violetbarEl.style.boxShadow = 'none'
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
    }
}

export function applyGameLoopLogic(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopLogic.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopLogic.prototype[name];
        }
    }
}

import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { LEVELS } from '../levels.js';
import { loadFilament } from './filament-loader.js';
import { initMarblePhysicsWasm } from '../wasm-bridge.js';
import { ParticleSystem } from '../particle-system.js';
import { LightingSystem } from '../lighting-system.js';
import { VolumetricLightsSystem } from '../rendering/volumetric-lights.js';
import {
    getRequestedRendererMode,
    installRendererModeControls,
    installSimpleDebugBackend,
    setRuntimeRendererGlobals,
} from '../rendering/simple-debug-renderer.js';
import { getRenderDimensions, applyDynamicResolution } from '../render-resolution.js';

export class InitCore {
    async init() {
        console.log('[INIT] Starting game initialization...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(0, 'Starting initialization...')
        }

        window.addEventListener('gamepadconnected', (e) => {
            console.log(`[GAMEPAD] Connected: ${e.gamepad.id} at index ${e.gamepad.index}`)
            this.gamepadIndices = this.gamepadIndices || []
            if (!this.gamepadIndices.includes(e.gamepad.index)) {
                this.gamepadIndices.push(e.gamepad.index)
            }
        })

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`[GAMEPAD] Disconnected: ${e.gamepad.id} at index ${e.gamepad.index}`)
            if (this.gamepadIndices) {
                this.gamepadIndices = this.gamepadIndices.filter(i => i !== e.gamepad.index)
            }
            if (this.gamepadState) {
                delete this.gamepadState[e.gamepad.index]
            }
        })

        window.addEventListener('keydown', (e) => {
            // Handle ESC key for pause menu
            if (e.code === 'Escape') {
                // Don't pause if in level selection menu
                const levelMenu = document.getElementById('level-menu')
                if (levelMenu && levelMenu.style.display === 'flex') {
                    return // Don't pause in menu
                }
                // Don't pause if level complete modal is showing
                const levelCompleteModal = document.getElementById('level-complete-modal')
                if (levelCompleteModal && levelCompleteModal.classList.contains('active')) {
                    return // Don't pause when level complete
                }
                // Toggle pause if in game
                if (this.currentLevel) {
                    this.togglePause()
                }
                return
            }

            // Don't process game inputs when paused
            if (this.isPaused) return

            if (e.code === 'Space' && !this.keys['Space']) {
                if (this.playerMarble) {
                    if (this.isGrounded(this.playerMarble)) {
                        this.isChargingJump = true
                        this.jumpCharge = 0
                    } else {
                        const wallContact = this.getWallContact(this.playerMarble)
                        if (wallContact) {
                            const rb = this.playerMarble.rigidBody
                            const linvel = rb.linvel()
                            rb.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)

                            const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                            const upForce = 20.0 * gravityDir
                            const pushForce = 25.0
                            const forwardX = Math.sin(this.aimYaw)
                            const forwardZ = Math.cos(this.aimYaw)
                            const forwardForce = 15.0

                            rb.applyImpulse({
                                x: wallContact.normal.x * pushForce + forwardX * forwardForce,
                                y: upForce,
                                z: wallContact.normal.z * pushForce + forwardZ * forwardForce
                            }, true)

                            this.jumpCount = 1
                            audio.playJump()
                            if (typeof this.awardTrickPoints === 'function') this.awardTrickPoints('Wall Launch!', 75, '#ff00ff')
                        } else if (this.jumpCount < this.maxJumps) {
                            const rb = this.playerMarble.rigidBody
                            const linvel = rb.linvel()
                            const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                            rb.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)
                            rb.applyImpulse({ x: 0, y: 10.0 * gravityDir, z: 0 }, true)
                            audio.playJump()

                            if (this.jumpCount === 1) {
                                this.awardTrickPoints('Double Jump!', 20, '#00bfff')
                            } else if (this.jumpCount === 2) {
                                this.awardTrickPoints('Triple Jump!', 50, '#ff00ff')
                            }
                            this.jumpCount++
                        }
                    }
                }
            }
            if (e.code === 'Tab') {
                e.preventDefault()
                if (this.marbles.length > 0) {
                    if (this.playerMarble && this.flipActive) {
                        this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
                        this.flipActive = false
                    }
                    this.currentMarbleIndex = (this.currentMarbleIndex + 1) % this.marbles.length
                    this.playerMarble = this.marbles[this.currentMarbleIndex]
                    this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
                    console.log(`[GAME] Switched to marble ${this.currentMarbleIndex}: ${this.playerMarble.name}`)
                    this.updateActiveMarbleLight()
                }
            }
            this.keys[e.code] = true
            if (e.code === 'KeyC') {
                const modes = ['orbit', 'follow', 'action', 'fpv', 'topdown', 'cinematic', 'side-scroller', 'drone']
                const idx = modes.indexOf(this.cameraMode)
                this.cameraMode = modes[(idx + 1) % modes.length]
                console.log('Camera Mode:', this.cameraMode)
            }
            if (e.code === 'KeyE') {
                this.magnetMode = 'attract'
                this.magnetActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('magnet')
            }
            if (e.code === 'KeyQ') {
                this.magnetMode = 'repel'
                this.magnetActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('magnet')
            }
            if (e.code === 'KeyB' && this.playerMarble) {
                this.triggerBlink()
            }
            if (e.code === 'KeyH' && this.playerMarble) {
                this.hoverActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('hover')
            }
            if (e.code === 'KeyG' && this.playerMarble) {
                if (typeof this.fireGravityPulse === 'function') {
                    this.fireGravityPulse()
                }
            }
            if (e.code === 'KeyU' && this.playerMarble) {
                this.flipActive = !this.flipActive
                if (this.flipActive) {
                    this.playerMarble.rigidBody.setGravityScale(-this.playerMarble.baseGravityScale, true)
                } else {
                    this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
                }
                if (this.hudManager) this.hudManager.markAbilityUsed('flip')
            }
            if (e.code === 'KeyV' && this.playerMarble && !this.keys['KeyV']) {
                const now = Date.now()
                if (now - this.lastDashTime > this.dashCooldown) {
                    this.isChargingDash = true
                    this.dashCharge = 0
                }
            }
            if (e.code === 'KeyZ' && this.playerMarble && !this.isGrounded(this.playerMarble)) {
                this.isStomping = true
                this.stompStartTime = Date.now()
                const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? 1 : -1
                this.playerMarble.rigidBody.setLinvel({ x: 0, y: 60.0 * gravityDir, z: 0 }, true)

                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.0, 0.0])

                audio.playBoost()
            }
            if (e.code === 'Digit0' && this.playerMarble) {
                if (typeof this.fireTremor === 'function') {
                    this.fireTremor()
                }
            }
            if (e.code === 'Digit1') {
                this.spawnBuildPiece('ramp')
            }
            if (e.code === 'Digit2') {
                this.spawnBuildPiece('floor')
            }
            if (e.code === 'Digit3') {
                this.spawnBuildPiece('bouncer')
            }
            if (e.code === 'Digit4' && this.playerMarble) {
                this.firePortal('A')
            }
            if (e.code === 'Digit5' && this.playerMarble) {
                this.firePortal('B')
            }
            if (e.code === 'Digit6' && this.playerMarble) {
                this.phaseActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('phase')
            }
            if (e.code === 'Digit7' && this.playerMarble) {
                this.gliderActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('glider')
            }
            if (e.code === 'Digit8' && this.playerMarble) {
                this.timeStopActive = !this.timeStopActive
                if (this.timeStopActive) {
                    if (audio && audio.playTrick) audio.playTrick()
                    this.showTrickMessage('TIME STOP!', '#ffffff')
                    if (this.hudManager) this.hudManager.markAbilityUsed('timestop')
                } else {
                    // Restore velocities immediately
                    const playerRb = this.playerMarble.rigidBody
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
            }
            if (e.code === 'Digit9' && this.playerMarble) {
                this.spawnBlackHole()
            }
            if (e.code === 'KeyX' && this.playerMarble) {
                this.spawnBomb()
            }
            if (e.code === 'KeyO' && this.playerMarble) {
                this.violetActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('violet')
            }
            if (e.code === 'KeyL' && this.playerMarble) {
                this.spawnMissile()
            }
            if (e.code === 'KeyT') {
                this.isRewinding = true
                if (this.hudManager) this.hudManager.markAbilityUsed('rewind')
            }
            if (e.code === 'KeyP' && this.playerMarble) {
                const now = Date.now()
                if (now - this.lastTeleportTime > this.teleportCooldown) {
                    this.triggerTeleport()
                }
            }
            if (e.code === 'KeyJ' && this.playerMarble) {
                this.jetpackActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('jetpack')
            }
            if (e.code === 'KeyY' && this.playerMarble) {
                this.vortexActive = true
                if (this.hudManager) this.hudManager.markAbilityUsed('vortex')
            }
            if (e.code === 'KeyN' && this.playerMarble && this.blinkCooldown <= 0) {
                const maxDist = 20.0
                const cosP = Math.cos(this.pitchAngle)
                const sinP = Math.sin(this.pitchAngle)
                const dirX = Math.sin(this.aimYaw) * cosP
                const dirY = sinP
                const dirZ = Math.cos(this.aimYaw) * cosP

                const rb = this.playerMarble.rigidBody
                const pos = rb.translation()
                const pRadius = this.playerMarble.scale * 0.5 || 0.5

                const ray = new RAPIER.Ray(pos, { x: dirX, y: dirY, z: dirZ })
                const hit = this.world.castRay(ray, maxDist, true, 0xffffffff, undefined, undefined, undefined, rb)

                let newPos
                if (hit) {
                    newPos = {
                        x: pos.x + dirX * Math.max(0, hit.toi - pRadius - 0.1),
                        y: pos.y + dirY * Math.max(0, hit.toi - pRadius - 0.1),
                        z: pos.z + dirZ * Math.max(0, hit.toi - pRadius - 0.1)
                    }
                } else {
                    newPos = {
                        x: pos.x + dirX * maxDist,
                        y: pos.y + dirY * maxDist,
                        z: pos.z + dirZ * maxDist
                    }
                }

                rb.setTranslation(newPos, true)
                this.blinkCooldown = this.maxBlinkCooldown
                this.awardTrickPoints('Blink!', 100, '#ff00ff')
                if (typeof audio !== 'undefined' && audio.playTrick) audio.playTrick()
            }
            if (e.code === 'KeyI' && this.playerMarble) {
                const now = Date.now()
                if (now - this.lastSizeShiftTime > this.sizeShiftCooldown) {
                    this.lastSizeShiftTime = now

                    const sizes = [
                        { name: 'Normal', scale: 1.0 },
                        { name: 'Mini', scale: 0.5 },
                        { name: 'Giant', scale: 2.0 }
                    ]

                    this.playerMarble.sizeState = ((this.playerMarble.sizeState || 0) + 1) % 3
                    const sizeProfile = sizes[this.playerMarble.sizeState]

                    const rb = this.playerMarble.rigidBody

                    if (this.playerMarble.collider) {
                        this.world.removeCollider(this.playerMarble.collider, true)
                    }

                    const newRadius = (this.playerMarble.baseRadius || 0.5) * sizeProfile.scale
                    const desc = RAPIER.ColliderDesc.ball(newRadius)
                        .setRestitution(this.playerMarble.baseRestitution !== undefined ? this.playerMarble.baseRestitution : 0.5)
                        .setFriction(this.playerMarble.baseFriction !== undefined ? this.playerMarble.baseFriction : 0.5)

                    if (this.playerMarble.baseDensity) {
                        desc.setDensity(this.playerMarble.baseDensity)
                    }

                    this.playerMarble.collider = this.world.createCollider(desc, rb)
                    this.playerMarble.scale = sizeProfile.scale * (this.playerMarble.baseScale || 1.0)

                    if (sizeProfile.scale > 1.0) {
                        const pos = rb.translation()
                        rb.setTranslation({ x: pos.x, y: pos.y + newRadius, z: pos.z }, true)
                    }

                    this.showTrickMessage(`Size: ${sizeProfile.name}`, '#ffff00')
                    if (audio && audio.playCollect) audio.playCollect()
                }
            }
            if (e.code === 'KeyK' && this.playerMarble) {
                if (typeof this.fireEMP === 'function') {
                    this.fireEMP()
                }
                if (this.hudManager) this.hudManager.markAbilityUsed('emp')
            }
            if (e.code === 'KeyN' && this.playerMarble) {
                const now = Date.now()
                if (now - this.lastChameleonTime > this.chameleonCooldown) {
                    this.chameleonState = (this.chameleonState + 1) % this.chameleonProfiles.length
                    const profile = this.chameleonProfiles[this.chameleonState]

                    this.playerMarble.baseGravityScale = profile.gravityScale
                    if (!this.flipActive) {
                        this.playerMarble.rigidBody.setGravityScale(profile.gravityScale, true)
                    } else {
                        this.playerMarble.rigidBody.setGravityScale(-profile.gravityScale, true)
                    }

                    this.playerMarble.color = profile.color
                    const rcm = this.engine.getRenderableManager()
                    const inst = rcm.getInstance(this.playerMarble.entity)
                    rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, profile.color)

                    this.lastChameleonTime = now
                    this.showTrickMessage(`Chameleon: ${profile.name}`, `rgb(${profile.color[0]*255}, ${profile.color[1]*255}, ${profile.color[2]*255})`)
                    if (audio && audio.playCollect) audio.playCollect()
                    if (this.hudManager) this.hudManager.markAbilityUsed('chameleon')
                }
            }
        })

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Digit6') {
                this.phaseActive = false
            }
            if (e.code === 'Digit7') {
                this.gliderActive = false
            }
            if (e.code === 'KeyO') {
                this.violetActive = false
            }
            if (e.code === 'KeyH') {
                this.hoverActive = false
            }
            if (e.code === 'KeyG') {
                this.iceActive = false
            }
            if (e.code === 'KeyY') {
                this.vortexActive = false
            }
            if (e.code === 'KeyJ') {
                this.jetpackActive = false
            }
            if (e.code === 'KeyT') {
                this.isRewinding = false
                if (this.playerMarble) {
                    this.playerMarble.rigidBody.wakeUp()
                    if (this.playerMarble.color) {
                         const rcm = this.engine.getRenderableManager()
                         const inst = rcm.getInstance(this.playerMarble.entity)
                         rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.color)
                    }
                }
            }
            if (e.code === 'KeyV') {
                if (this.isChargingDash && this.playerMarble) {
                    const rb = this.playerMarble.rigidBody
                    const cosP = Math.cos(this.pitchAngle)
                    const sinP = Math.sin(this.pitchAngle)
                    const dirX = Math.sin(this.aimYaw) * cosP
                    const dirY = sinP
                    const dirZ = Math.cos(this.aimYaw) * cosP

                    // Apply a strong physics impulse based on charge
                    const baseForce = 50.0
                    const force = baseForce + (this.dashCharge * 150.0)
                    rb.applyImpulse({
                        x: dirX * force,
                        y: dirY * force,
                        z: dirZ * force
                    }, true)

                    this.lastDashTime = Date.now()
                    if (typeof audio !== 'undefined' && audio.playBoost) audio.playBoost()

                    if (this.hudManager) this.hudManager.markAbilityUsed('dash')
                }
                this.isChargingDash = false
                this.dashCharge = 0
                if (this.dashBarEl) this.dashBarEl.style.boxShadow = 'none'
            }
            if (e.code === 'KeyE' || e.code === 'KeyQ') {
                this.magnetActive = false
                this.magnetMode = null
            }
            if (e.code === 'Space') {
                if (this.isChargingJump && this.playerMarble) {
                    let force = 5.0 + this.jumpCharge * 10.0
                    if (this.activeEffects.jump && Date.now() < this.activeEffects.jump) {
                        force *= 2.0
                    }
                    const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1
                    this.playerMarble.rigidBody.applyImpulse({ x: 0, y: force * gravityDir, z: 0 }, true)
                    audio.playJump()
                    this.jumpCount = 1
                }
                this.isChargingJump = false
                this.jumpCharge = 0
                if (this.jumpBarEl) this.jumpBarEl.style.width = '0%'
            }
            this.keys[e.code] = false
        })

        const initAudio = () => {
            audio.init()
            audio.resume()
        }
        window.addEventListener('click', initAudio, { once: true })
        window.addEventListener('keydown', initAudio, { once: true })

        this.muteBtn = document.getElementById('mute-btn')
        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                audio.init()
                const muted = audio.toggleMute()
                this.muteBtn.textContent = muted ? '🔇' : '🔊'
                this.muteBtn.classList.toggle('muted', muted)
            })
        }

        this.initMouseControls()

        console.log('[INIT] Initializing Rapier physics...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(5, 'Initializing physics engine...')
        }
        await RAPIER.init()
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(15, 'Physics engine ready')
        }
        const gravity = { x: 0.0, y: -9.81, z: 0.0 }
        this.world = new RAPIER.World(gravity)
        console.log('[INIT] Physics initialized')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(20, 'Physics initialized')
        }

        // Kick off WASM physics module load in the background (non-blocking).
        // The bridge transparently falls back to JS if the binary is absent.
        initMarblePhysicsWasm().then(ok => {
            console.log(`[INIT] MarblePhysics WASM ${ok ? 'active' : 'using JS fallbacks'}`)
        })

        const rendererRequest = getRequestedRendererMode()
        this.rendererType = rendererRequest.type
        this.rendererFallbackReason = ''
        setRuntimeRendererGlobals(this.rendererType, this.rendererFallbackReason)

        console.log(`[INIT] Initializing ${rendererRequest.type === 'simple-webgl' ? 'Simple WebGL2 debug' : 'Filament'} rendering...`)
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(25, rendererRequest.type === 'simple-webgl'
                ? 'Creating simple WebGL2 debug renderer...'
                : 'Loading Filament rendering engine...')
        }

        const { cssWidth, cssHeight, bufferWidth, bufferHeight, scale } = getRenderDimensions(this.settings)
        const width = bufferWidth
        const height = bufferHeight
        this.canvas.style.width = cssWidth + 'px'
        this.canvas.style.height = cssHeight + 'px'
        this.canvas.width = width
        this.canvas.height = height
        console.log(`[INIT] Canvas sized to ${width}x${height} (css ${cssWidth}x${cssHeight}, renderScale ${scale})`)

        if (rendererRequest.type === 'simple-webgl') {
            installSimpleDebugBackend(this)
            console.log('[INIT] Simple WebGL2 debug renderer ready')
        } else {
            try {
                this.Filament = await loadFilament()
            } catch (filamentError) {
                const message = filamentError?.message || 'Unknown error'
                console.error('[INIT] Filament failed to load, falling back to simple renderer:', filamentError)
                installSimpleDebugBackend(this, `Filament load failed: ${message}`)
            }

            if (this.rendererType !== 'simple-webgl') {
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress(45, 'Filament rendering ready')
                }
                console.log('[INIT] Filament loaded')
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress(50, 'Creating rendering engine...')
                }

                try {
                    this.engine = this.Filament.Engine.create(this.canvas)
                    this.scene = this.engine.createScene()
                    this.swapChain = this.engine.createSwapChain()
                    this.renderer = this.engine.createRenderer()
                    this.rendererType = 'filament'
                    this.rendererModeLabel = 'Filament'
                    setRuntimeRendererGlobals('filament', '')
                } catch (engineError) {
                    const message = engineError?.message || 'Unknown rendering error'
                    console.error('[INIT] Failed to create Filament engine, falling back to simple renderer:', engineError)
                    installSimpleDebugBackend(this, `Filament engine failed: ${message}`)
                }
            }
        }

        if (this.rendererType !== 'simple-webgl') {
            console.log('[INIT] Filament engine created')

            const cameraEntity = this.Filament.EntityManager.get().create()
            this.camera = this.engine.createCamera(cameraEntity)
            this.view = this.engine.createView()
            this.view.setCamera(this.camera)
            this.view.setScene(this.scene)
            this.view.setViewport([0, 0, width, height])

            const CameraFov = this.Filament?.['Camera$Fov']
            const aspect = width / height
            const fovMode = CameraFov ? CameraFov.VERTICAL : 0
            this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, fovMode)
            this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])

            this.renderer.setClearOptions({ clearColor: [0.1, 0.1, 0.1, 1.0], clear: true })

            // Dynamic resolution: let the GPU lower the internal render target
            // when it can't hit framerate, then scale back up when it can.
            applyDynamicResolution(this.view, this.Filament, this.settings?.graphics?.dynamicResolution)
        }
        installRendererModeControls(this.rendererType)
        console.log(`[INIT] Camera and view configured (${this.rendererModeLabel || this.rendererType})`)

        console.log('[INIT] Loading assets...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(55, 'Loading materials and assets...')
        }
        await this.setupAssets()
        this.effectPool?.prewarm()
        console.log('[INIT] Assets loaded')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(70, 'Assets loaded')
        }

        if (this.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.settings?.graphics?.quality || 'high'
                this.particleSystem = new ParticleSystem(this.engine, this.scene, this.Filament, qualityTier)
                this.particleSystem._game = this
                console.log('[INIT] Particle system initialized')
            } catch (e) {
                console.error('[INIT] Particle system initialization failed:', e)
                this.particleSystem = null
            }
        } else {
            this.particleSystem = null
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(75, 'Creating lights...')
        }
        this.createLight()
        console.log('[INIT] Lights created')
        
        if (this.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.settings?.graphics?.quality || 'high'
                this.lightingSystem = new LightingSystem(this.engine, this.scene, this.Filament)
                this.lightingSystem.registerLights(this.sunLight, this.fillLight, this.backLight)
                this.lightingSystem.setQuality(qualityTier)
                this.lightingSystem.isLightActive = (entity) => this.lightingBudget?.isBudgetActive(entity) ?? true
                this.lightingSystem.isAnimateAllowed = (entity) => this.lightingBudget?.isAnimateAllowed(entity) ?? true
                console.log('[INIT] Lighting system initialized')
            } catch (e) {
                console.error('[INIT] Lighting system initialization failed:', e)
                this.lightingSystem = null
            }
        } else {
            this.lightingSystem = null
        }

        // Initialize volumetric light shaft system
        if (this.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.settings?.graphics?.quality || 'high'
                this.volumetricLights = new VolumetricLightsSystem(qualityTier)
                console.log('[INIT] Volumetric lights system initialized')
            } catch (e) {
                console.error('[INIT] Volumetric lights initialization failed (non-fatal):', e)
                this.volumetricLights = null
            }
        } else {
            this.volumetricLights = null
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(85, 'Setting up post-processing...')
        }
        if (this.rendererType !== 'simple-webgl') {
            try {
                this.setupPostProcessing()
                console.log('[INIT] Post-processing enabled')
            } catch (e) {
                console.error('[INIT] Post-processing setup failed (non-fatal):', e)
            }
        } else {
            console.log('[INIT] Post-processing skipped for simple debug renderer')
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(95, 'Preparing level menu...')
        }
        
        // Initialize pause menu handlers (once only)
        this.initPauseMenu()
        console.log('[INIT] Pause menu initialized')
        
        this.showLevelSelection()
        console.log('[INIT] Level menu displayed')

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(100, 'Ready!')
        }

        window.__FILAMENT_FULLY_READY__ = true;

        this.resize()
        window.addEventListener('resize', () => this.resize())

        this.loadSettings()
        console.log('[INIT] Settings loaded')

        // Initialize speed lines effect
        this.initSpeedLines()
        console.log('[INIT] Speed lines initialized')

        console.log('[INIT] Starting game loop')
        this.loop()
        console.log('[INIT] Initialization complete!')
    }

    // Show a fatal initialization error on the loading screen.
    _showInitError(message) {
        console.error('[INIT] Fatal init error:', message)
        const loadingEl = document.getElementById('loading')
        if (loadingEl) {
            loadingEl.classList.add('error')
            const textEl = loadingEl.querySelector('.loading-text')
            if (textEl) textEl.textContent = '⚠️ Failed to Start'
        }
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(0, message)
        }
    }
}

export function applyInitCore(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitCore.prototype[name];
        }
    }
}

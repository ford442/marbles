import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { LEVELS } from './levels.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';

// Default settings configuration
const DEFAULT_SETTINGS = {
    graphics: {
        quality: 'high',
        shadows: true,
        bloom: 50,
        ssao: true
    },
    audio: {
        master: 80,
        sfx: 70,
        music: 50
    },
    controls: {
        sensitivity: 50,
        invertY: false
    },
    accessibility: {
        uiScale: 100,
        highContrast: false,
        screenShake: 100
    }
};

export async function loadFilament() {
    let attempts = 0
    while (typeof Filament === 'undefined' && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 10))
        attempts++
    }

    console.log('[INIT] Filament available after', attempts, 'attempts:', typeof Filament)
    if (typeof Filament === 'undefined') {
        throw new Error('Filament not loaded. Make sure filament.js is included as a script tag.')
    }

    if (typeof Filament.init === 'function' && !Filament.isReady) {
        await new Promise(resolve => Filament.init([], resolve))
    }

    if (Filament.loadGeneratedExtensions) Filament.loadGeneratedExtensions()
    if (Filament.loadClassExtensions) Filament.loadClassExtensions()

    console.log('[INIT] Filament loaded globally:', typeof Filament, Object.keys(Filament || {}).slice(0, 10))
    return Filament
}

export class InitMethods {
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
                            const upForce = 15.0 * gravityDir
                            const pushForce = 10.0
                            rb.applyImpulse({
                                x: wallContact.normal.x * pushForce,
                                y: upForce,
                                z: wallContact.normal.z * pushForce
                            }, true)

                            this.jumpCount = 1
                            audio.playJump()
                            console.log('[GAME] Wall Jump!')
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
                const modes = ['orbit', 'follow', 'fpv', 'topdown', 'cinematic', 'side-scroller']
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
                    this.world.bodies.forEach(body => {
                        if (body.isDynamic() && body !== this.playerMarble.rigidBody) {
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

                const ray = new this.RAPIER.Ray(pos, { x: dirX, y: dirY, z: dirZ })
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

        console.log('[INIT] Initializing Filament rendering...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(25, 'Loading Filament rendering engine...')
        }
        this.Filament = await loadFilament()
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(45, 'Filament rendering ready')
        }
        console.log('[INIT] Filament loaded')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(50, 'Creating rendering engine...')
        }

        const width = window.innerWidth
        const height = window.innerHeight
        this.canvas.width = width
        this.canvas.height = height
        console.log(`[INIT] Canvas sized to ${width}x${height}`)

        this.engine = this.Filament.Engine.create(this.canvas)
        this.scene = this.engine.createScene()
        this.swapChain = this.engine.createSwapChain()
        this.renderer = this.engine.createRenderer()
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
        console.log('[INIT] Camera and view configured')

        console.log('[INIT] Loading assets...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(55, 'Loading materials and assets...')
        }
        await this.setupAssets()
        console.log('[INIT] Assets loaded')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(70, 'Assets loaded')
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(75, 'Creating lights...')
        }
        this.createLight()
        console.log('[INIT] Lights created')

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(85, 'Setting up post-processing...')
        }
        try {
            this.setupPostProcessing()
            console.log('[INIT] Post-processing enabled')
        } catch (e) {
            console.error('[INIT] Post-processing setup failed (non-fatal):', e)
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
        
        // Hide loading screen with fade transition
        if (typeof window.hideLoadingScreen === 'function') {
            window.hideLoadingScreen()
        } else {
            const loading = document.getElementById('loading')
            if (loading) {
                loading.classList.add('hidden')
                setTimeout(() => { loading.style.display = 'none' }, 500)
            }
        }
        console.log('[INIT] Loading screen hidden')

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

    // ==================== PAUSE MENU & SETTINGS METHODS ====================

    initPauseMenu() {
        // Initialize pause state
        this.isPaused = false
        this.settings = null

        // Get DOM elements
        this.pauseOverlay = document.getElementById('pause-overlay')
        this.settingsPanel = document.getElementById('settings-panel')
        this.pauseBtn = document.getElementById('pause-btn')

        // Bind button events
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.togglePause())
        }

        // Resume button
        const btnResume = document.getElementById('btn-resume')
        if (btnResume) {
            btnResume.addEventListener('click', () => this.togglePause())
        }

        // Restart button (in pause menu)
        const btnRestartPause = document.getElementById('btn-restart-pause')
        if (btnRestartPause) {
            btnRestartPause.addEventListener('click', () => this.restartCurrentLevel())
        }

        // Settings button
        const btnSettings = document.getElementById('btn-settings')
        if (btnSettings) {
            btnSettings.addEventListener('click', () => this.openSettings())
        }

        // Quit to menu button
        const btnQuitMenu = document.getElementById('btn-quit-menu')
        if (btnQuitMenu) {
            btnQuitMenu.addEventListener('click', () => this.quitToMenu())
        }

        // Settings close button (X)
        const settingsClose = document.getElementById('settings-close')
        if (settingsClose) {
            settingsClose.addEventListener('click', () => this.closeSettings())
        }

        // Settings back button
        const btnSettingsBack = document.getElementById('btn-settings-back')
        if (btnSettingsBack) {
            btnSettingsBack.addEventListener('click', () => this.closeSettings())
        }

        // Settings save button
        const btnSettingsSave = document.getElementById('btn-settings-save')
        if (btnSettingsSave) {
            btnSettingsSave.addEventListener('click', () => this.saveSettings())
        }

        // Settings reset defaults button
        const btnSettingsDefaults = document.getElementById('btn-settings-defaults')
        if (btnSettingsDefaults) {
            btnSettingsDefaults.addEventListener('click', () => this.resetSettingsToDefaults())
        }

        // Initialize settings tabs
        this.initSettingsTabs()

        // Initialize settings input listeners
        this.initSettingsInputs()

        // Close pause menu on ESC when already paused
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.settingsPanel && this.settingsPanel.classList.contains('active')) {
                    this.closeSettings()
                } else if (this.isPaused) {
                    this.togglePause()
                }
            }
        })
    }

    togglePause() {
        if (this.isPaused) {
            this.unpauseGame()
        } else {
            this.pauseGame()
        }
    }

    pauseGame() {
        if (this.isPaused) return
        
        this.isPaused = true
        
        // Show pause overlay
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.add('active')
        }

        // Dim/blur canvas
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.add('paused')
        }

        // Release pointer lock
        if (document.pointerLockElement === this.canvas) {
            document.exitPointerLock()
        }

        // Mute/lower audio
        if (audio && audio.setMasterVolume) {
            const currentVolume = this.settings?.audio?.master ?? 80
            audio.setMasterVolume(currentVolume * 0.3 / 100) // Lower to 30% while paused
        }

        console.log('[PAUSE] Game paused')
    }

    unpauseGame() {
        if (!this.isPaused) return
        
        this.isPaused = false
        
        // Hide pause overlay
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.remove('active')
        }

        // Remove canvas effects
        const canvas = document.getElementById('canvas')
        if (canvas) {
            canvas.classList.remove('paused')
        }

        // Restore audio volume
        if (audio && audio.setMasterVolume && this.settings) {
            audio.setMasterVolume(this.settings.audio.master / 100)
        }

        // Re-acquire pointer lock if in game
        if (this.currentLevel && document.pointerLockElement !== this.canvas) {
            this.canvas.requestPointerLock().catch(() => {})
        }

        console.log('[PAUSE] Game unpaused')
    }

    restartCurrentLevel() {
        this.unpauseGame()
        if (this.currentLevel) {
            this.loadLevel(this.currentLevel)
        }
    }

    quitToMenu() {
        this.unpauseGame()
        this.clearLevel()
        this.showLevelSelection()
    }

    openSettings() {
        if (this.settingsPanel) {
            this.settingsPanel.classList.add('active')
            this.populateSettingsValues()
        }
    }

    closeSettings() {
        if (this.settingsPanel) {
            this.settingsPanel.classList.remove('active')
            // If we were in pause menu, stay paused
            if (!this.isPaused && this.pauseOverlay && this.pauseOverlay.classList.contains('active')) {
                // This shouldn't happen, but just in case
            }
        }
    }

    initSettingsTabs() {
        const tabs = document.querySelectorAll('.settings-tab')
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'))
                // Add active class to clicked tab
                tab.classList.add('active')
                
                // Show corresponding section
                const tabId = tab.dataset.tab
                document.querySelectorAll('.settings-section').forEach(section => {
                    section.classList.remove('active')
                })
                const targetSection = document.getElementById(`tab-${tabId}`)
                if (targetSection) {
                    targetSection.classList.add('active')
                }
            })
        })
    }

    initSettingsInputs() {
        // Graphics settings
        const qualitySelect = document.getElementById('setting-quality')
        if (qualitySelect) {
            qualitySelect.addEventListener('change', (e) => {
                if (this.settings) this.settings.graphics.quality = e.target.value
            })
        }

        const shadowToggle = document.getElementById('setting-shadows')
        if (shadowToggle) {
            shadowToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.graphics.shadows = e.target.checked
            })
        }

        const bloomSlider = document.getElementById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider && bloomValue) {
            bloomSlider.addEventListener('input', (e) => {
                bloomValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.graphics.bloom = parseInt(e.target.value)
            })
        }

        const ssaoToggle = document.getElementById('setting-ssao')
        if (ssaoToggle) {
            ssaoToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.graphics.ssao = e.target.checked
            })
        }

        // Audio settings
        const masterSlider = document.getElementById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider && masterValue) {
            masterSlider.addEventListener('input', (e) => {
                masterValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.master = parseInt(e.target.value)
            })
        }

        const sfxSlider = document.getElementById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider && sfxValue) {
            sfxSlider.addEventListener('input', (e) => {
                sfxValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.sfx = parseInt(e.target.value)
            })
        }

        const musicSlider = document.getElementById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider && musicValue) {
            musicSlider.addEventListener('input', (e) => {
                musicValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.audio.music = parseInt(e.target.value)
            })
        }

        // Controls settings
        const sensitivitySlider = document.getElementById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.addEventListener('input', (e) => {
                sensitivityValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.controls.sensitivity = parseInt(e.target.value)
            })
        }

        const invertYToggle = document.getElementById('setting-invert-y')
        if (invertYToggle) {
            invertYToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.controls.invertY = e.target.checked
            })
        }

        // Accessibility settings
        const uiScaleSlider = document.getElementById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider && uiScaleValue) {
            uiScaleSlider.addEventListener('input', (e) => {
                uiScaleValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.accessibility.uiScale = parseInt(e.target.value)
                this.applyUIScale(parseInt(e.target.value))
            })
        }

        const highContrastToggle = document.getElementById('setting-high-contrast')
        if (highContrastToggle) {
            highContrastToggle.addEventListener('change', (e) => {
                if (this.settings) this.settings.accessibility.highContrast = e.target.checked
                this.applyHighContrast(e.target.checked)
            })
        }

        const shakeSlider = document.getElementById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider && shakeValue) {
            shakeSlider.addEventListener('input', (e) => {
                shakeValue.textContent = `${e.target.value}%`
                if (this.settings) this.settings.accessibility.screenShake = parseInt(e.target.value)
            })
        }
    }

    populateSettingsValues() {
        if (!this.settings) return

        const s = this.settings

        // Graphics
        const qualitySelect = document.getElementById('setting-quality')
        if (qualitySelect) qualitySelect.value = s.graphics.quality

        const shadowToggle = document.getElementById('setting-shadows')
        if (shadowToggle) shadowToggle.checked = s.graphics.shadows

        const bloomSlider = document.getElementById('setting-bloom')
        const bloomValue = document.getElementById('value-bloom')
        if (bloomSlider) bloomSlider.value = s.graphics.bloom
        if (bloomValue) bloomValue.textContent = `${s.graphics.bloom}%`

        const ssaoToggle = document.getElementById('setting-ssao')
        if (ssaoToggle) ssaoToggle.checked = s.graphics.ssao

        // Audio
        const masterSlider = document.getElementById('setting-master')
        const masterValue = document.getElementById('value-master')
        if (masterSlider) masterSlider.value = s.audio.master
        if (masterValue) masterValue.textContent = `${s.audio.master}%`

        const sfxSlider = document.getElementById('setting-sfx')
        const sfxValue = document.getElementById('value-sfx')
        if (sfxSlider) sfxSlider.value = s.audio.sfx
        if (sfxValue) sfxValue.textContent = `${s.audio.sfx}%`

        const musicSlider = document.getElementById('setting-music')
        const musicValue = document.getElementById('value-music')
        if (musicSlider) musicSlider.value = s.audio.music
        if (musicValue) musicValue.textContent = `${s.audio.music}%`

        // Controls
        const sensitivitySlider = document.getElementById('setting-sensitivity')
        const sensitivityValue = document.getElementById('value-sensitivity')
        if (sensitivitySlider) sensitivitySlider.value = s.controls.sensitivity
        if (sensitivityValue) sensitivityValue.textContent = `${s.controls.sensitivity}%`

        const invertYToggle = document.getElementById('setting-invert-y')
        if (invertYToggle) invertYToggle.checked = s.controls.invertY

        // Accessibility
        const uiScaleSlider = document.getElementById('setting-ui-scale')
        const uiScaleValue = document.getElementById('value-ui-scale')
        if (uiScaleSlider) uiScaleSlider.value = s.accessibility.uiScale
        if (uiScaleValue) uiScaleValue.textContent = `${s.accessibility.uiScale}%`

        const highContrastToggle = document.getElementById('setting-high-contrast')
        if (highContrastToggle) highContrastToggle.checked = s.accessibility.highContrast

        const shakeSlider = document.getElementById('setting-shake')
        const shakeValue = document.getElementById('value-shake')
        if (shakeSlider) shakeSlider.value = s.accessibility.screenShake
        if (shakeValue) shakeValue.textContent = `${s.accessibility.screenShake}%`
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('marbles3d_settings')
            if (savedSettings) {
                this.settings = JSON.parse(savedSettings)
                // Merge with defaults to ensure all fields exist
                this.settings = this.mergeWithDefaults(this.settings)
                console.log('[SETTINGS] Loaded from localStorage')
            } else {
                this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
                console.log('[SETTINGS] Using default settings')
            }
        } catch (e) {
            console.warn('[SETTINGS] Failed to load settings:', e)
            this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        }

        // Apply loaded settings
        this.applySettings()
    }

    saveSettings() {
        try {
            localStorage.setItem('marbles3d_settings', JSON.stringify(this.settings))
            console.log('[SETTINGS] Saved to localStorage')
        } catch (e) {
            console.warn('[SETTINGS] Failed to save settings:', e)
        }

        this.applySettings()
        this.closeSettings()
    }

    resetSettingsToDefaults() {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        this.populateSettingsValues()
        this.applySettings()
        console.log('[SETTINGS] Reset to defaults')
    }

    mergeWithDefaults(saved) {
        const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
        
        if (saved.graphics) {
            Object.assign(merged.graphics, saved.graphics)
        }
        if (saved.audio) {
            Object.assign(merged.audio, saved.audio)
        }
        if (saved.controls) {
            Object.assign(merged.controls, saved.controls)
        }
        if (saved.accessibility) {
            Object.assign(merged.accessibility, saved.accessibility)
        }
        
        return merged
    }

    applySettings() {
        if (!this.settings) return

        const s = this.settings

        // Apply audio settings
        if (audio) {
            if (audio.setMasterVolume) {
                audio.setMasterVolume(s.audio.master / 100)
            }
            if (audio.setSFXVolume) {
                audio.setSFXVolume(s.audio.sfx / 100)
            }
            if (audio.setMusicVolume) {
                audio.setMusicVolume(s.audio.music / 100)
            }
        }

        // Apply UI scale
        this.applyUIScale(s.accessibility.uiScale)

        // Apply high contrast
        this.applyHighContrast(s.accessibility.highContrast)

        // Apply graphics settings
        this.applyGraphicsSettings()

        console.log('[SETTINGS] Applied settings')
    }

    applyUIScale(scale) {
        const ui = document.getElementById('ui')
        if (ui) {
            ui.style.transform = `scale(${scale / 100})`
            ui.style.transformOrigin = 'bottom left'
        }
    }

    applyHighContrast(enabled) {
        if (enabled) {
            document.body.classList.add('high-contrast')
        } else {
            document.body.classList.remove('high-contrast')
        }
    }

    applyGraphicsSettings() {
        // Graphics settings would be applied here
        // These would affect Filament renderer settings
        const s = this.settings.graphics

        // Example: Adjust shadow quality
        if (this.renderer && s.shadows !== undefined) {
            // Filament-specific shadow configuration would go here
        }

        // Example: Adjust bloom
        if (this.view && s.bloom !== undefined) {
            // Post-processing bloom adjustment would go here
        }
    }

    getMouseSensitivity() {
        if (!this.settings) return 0.002
        // Convert 10-200 range to 0.001-0.01
        return this.settings.controls.sensitivity * 0.00004
    }

    isYAxisInverted() {
        return this.settings?.controls?.invertY ?? false
    }

    getScreenShakeIntensity() {
        if (!this.settings) return 1.0
        return this.settings.accessibility.screenShake / 100
    }

    showLevelSelection() {
        const menu = document.getElementById('level-menu')
        const levelGrid = document.getElementById('level-grid')
        const gameUI = document.getElementById('ui')
        const pauseMenu = document.getElementById('pause-menu')

        // Hide pause menu if open
        if (pauseMenu) pauseMenu.classList.remove('active')

        // Reset menu state
        menu.classList.remove('menu-hidden', 'menu-exiting')
        menu.classList.add('menu-entering')
        
        // Hide game UI
        gameUI.style.display = 'none'
        gameUI.classList.remove('hud-slide-left', 'hud-slide-right', 'hud-slide-up')
        
        levelGrid.innerHTML = ''

        // Create level cards with stagger animation
        Object.entries(LEVELS).forEach(([id, level], index) => {
            const card = document.createElement('div')
            card.className = 'level-card card-stagger'
            card.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <span class="goals">${level.goals.length} Goal${level.goals.length !== 1 ? 's' : ''}</span>
            `
            card.addEventListener('click', () => this.hideLevelSelection(() => this.loadLevel(id)))
            levelGrid.appendChild(card)

            // Trigger stagger animation with delay
            setTimeout(() => {
                card.classList.add('animate')
            }, 50 + (index * 50)) // 50ms base delay + 50ms stagger per card
        })

        // Set up menu camera position (distant overview)
        this.setMenuCamera()
    }

    hideLevelSelection(callback) {
        const menu = document.getElementById('level-menu')
        const cards = menu.querySelectorAll('.level-card')

        // Animate cards out
        cards.forEach((card, index) => {
            card.classList.remove('animate')
            card.classList.add('card-exit')
            card.style.animationDelay = `${index * 30}ms`
        })

        // Animate menu out after cards start exiting
        setTimeout(() => {
            menu.classList.remove('menu-entering')
            menu.classList.add('menu-exiting')
        }, 100)

        // Hide menu after animation completes
        setTimeout(() => {
            menu.classList.remove('menu-entering', 'menu-exiting')
            menu.classList.add('menu-hidden')
            if (callback) callback()
        }, 400)
    }

    returnToMenu() {
        const gameUI = document.getElementById('ui')
        
        // Clear current level
        this.clearLevel()
        this.currentLevel = null
        this.levelComplete = false
        this.isPaused = false

        // Reset camera mode
        this.cameraMode = 'orbit'

        // Show level selection with animation
        this.showLevelSelection()
    }

    showLevelMenu() {
        // Alias for showLevelSelection for consistency
        this.showLevelSelection()
    }

    setMenuCamera() {
        // Position camera for menu overview
        if (this.camera) {
            this.camera.lookAt([0, 15, 40], [0, 0, 0], [0, 1, 0])
        }
    }

    transitionCameraToGameplay(duration = 1000) {
        if (!this.camera || !this.playerMarble) return Promise.resolve()

        const startPos = [0, 15, 40] // Menu camera position
        const startTarget = [0, 0, 0]
        
        const startTime = Date.now()
        
        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                
                // Easing function (ease-out-cubic)
                const ease = 1 - Math.pow(1 - progress, 3)
                
                // We'll let the regular camera update take over smoothly
                // by just resolving when transition is done
                if (progress >= 1) {
                    resolve()
                } else {
                    requestAnimationFrame(animate)
                }
            }
            requestAnimationFrame(animate)
        })
    }

    async loadLevel(levelId) {
        console.log(`[LEVEL] Loading level: ${levelId}`)
        const level = LEVELS[levelId]
        if (!level) {
            console.error(`[LEVEL] Level ${levelId} not found!`)
            return
        }

        this.clearLevel()
        console.log('[LEVEL] Cleared previous level')

        this.ghostRecording = []
        this.ghostPlaybackIndex = 0

        this.currentLevel = levelId
        this.levelNameEl.textContent = level.name
        this.goalDefinitions = level.goals
        this.checkpointDefinitions = level.checkpoints || []
        this.score = 0
        this.scoreEl.textContent = 'Score: 0'
        this.combo = 1
        this.comboTimer = 0
        if (this.comboEl) {
            this.comboEl.style.display = 'none'
            this.comboEl.textContent = 'Combo: x1'
        }
        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'none'
        if (this.combobarEl) this.combobarEl.style.width = '0%'

        if (this.timerEl) this.timerEl.textContent = 'Time: 0.00s'
        this.levelComplete = false

        if (level.nightMode) {
            this.setNightMode(true, level.backgroundColor)
        } else {
            this.setNightMode(false)
        }

        if (level.camera) {
            this.cameraMode = level.camera.mode || 'orbit'
            this.camAngle = level.camera.angle || 0
            this.camHeight = level.camera.height || 10
            this.camRadius = level.camera.radius || 25
        }

        console.log(`[LEVEL] Creating ${level.zones.length} zones...`)
        for (const zone of level.zones) {
            await this.createZone(zone)
        }
        console.log(`[LEVEL] Created ${this.staticEntities.length} static entities`)

        console.log(`[LEVEL] Spawning marbles at ${JSON.stringify(level.spawn)}...`)
        this.createMarbles(level.spawn)
        console.log(`[LEVEL] Created ${this.marbles.length} marbles`)

        if (this.bestGhosts[levelId]) {
            this.createGhostMarble()
        }

        console.log('[LEVEL] Level loading complete!')

        // Start the level entry sequence
        await this.startLevelSequence()
    }

    async startLevelSequence() {
        const gameUI = document.getElementById('ui')
        const fadeOverlay = document.getElementById('fade-overlay')
        const countdownOverlay = document.getElementById('countdown-overlay')
        const countdownDisplay = document.getElementById('countdown-display')

        // Show game UI but keep it hidden until countdown finishes
        gameUI.style.display = 'block'
        gameUI.style.opacity = '0'

        // Start fade from black
        fadeOverlay.classList.remove('fade-out')
        
        // Wait a moment at black screen
        await this.delay(200)

        // Fade out from black
        fadeOverlay.classList.add('fade-out')

        // Show countdown
        countdownOverlay.classList.add('active')

        // 3-2-1 countdown
        const numbers = ['3', '2', '1']
        for (const num of numbers) {
            countdownDisplay.className = 'countdown-number'
            countdownDisplay.textContent = num
            // Force reflow to restart animation
            void countdownDisplay.offsetWidth
            countdownDisplay.className = 'countdown-number'
            await this.delay(800)
        }

        // GO!
        countdownDisplay.className = 'countdown-go'
        countdownDisplay.textContent = 'GO!'
        
        // Start the level timer
        this.levelStartTime = Date.now()
        this.isPaused = false

        // Animate HUD elements in
        gameUI.style.opacity = '1'
        this.animateHUDIn()

        // Hide countdown after GO
        await this.delay(600)
        countdownOverlay.classList.remove('active')

        // Transition camera smoothly
        await this.transitionCameraToGameplay(1000)
    }

    animateHUDIn() {
        const gameUI = document.getElementById('ui')
        const hudAbilities = document.getElementById('hud-abilities')
        
        // Add slide animations to HUD sections
        if (hudAbilities) {
            hudAbilities.classList.add('hud-slide-left')
        }

        // Animate score/timer elements
        const scoreEl = document.getElementById('score')
        const timerEl = document.getElementById('timer')
        const levelNameEl = document.getElementById('level-name')

        if (scoreEl) {
            scoreEl.style.animation = 'hudSlideLeft 0.5s ease-out forwards'
            scoreEl.style.animationDelay = '0.1s'
        }
        if (timerEl) {
            timerEl.style.animation = 'hudSlideLeft 0.5s ease-out forwards'
            timerEl.style.animationDelay = '0.2s'
        }
        if (levelNameEl) {
            levelNameEl.style.animation = 'hudSlideLeft 0.5s ease-out forwards'
            levelNameEl.style.animationDelay = '0.3s'
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    createGhostMarble() {
        this.ghostEntity = this.Filament.EntityManager.get().create()
        this.ghostMaterialInstance = this.material.createInstance()
        this.ghostMaterialInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
        this.ghostMaterialInstance.setFloatParameter('roughness', 0.2)

        // Ghost is slightly larger/smaller or translucent, but we use existing material limits
        // We render it similarly to a regular marble
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, this.ghostMaterialInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, this.ghostEntity)

        this.scene.addEntity(this.ghostEntity)

        this.ghostLightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
            .color([0.0, 1.0, 1.0])
            .intensity(15000.0)
            .falloff(15.0)
            .build(this.engine, this.ghostLightEntity)

        this.scene.addEntity(this.ghostLightEntity)

        console.log('[GAME] Spawned Speedrun Ghost')
    }

    clearLevel() {
        for (const m of this.marbles) {
            this.world.removeRigidBody(m.rigidBody)
            this.scene.remove(m.entity)
            this.engine.destroyEntity(m.entity)
        }
        if (this.activeMarbleLightEntity) {
            this.scene.remove(this.activeMarbleLightEntity)
            this.engine.destroyEntity(this.activeMarbleLightEntity)
            this.Filament.EntityManager.get().destroy(this.activeMarbleLightEntity)
            this.activeMarbleLightEntity = null
        }
        this.marbles = []
        this.playerMarble = null

        for (const body of this.staticBodies) {
            this.world.removeRigidBody(body)
        }
        this.staticBodies = []

        for (const entity of this.staticEntities) {
            this.scene.remove(entity)
            this.engine.destroyEntity(entity)
        }
        this.staticEntities = []

        for (const obj of this.dynamicObjects) {
            this.world.removeRigidBody(obj.rigidBody)
            this.scene.remove(obj.entity)
            this.engine.destroyEntity(obj.entity)
        }
        this.dynamicObjects = []

        for (const cp of this.checkpoints) {
            this.scene.remove(cp.entity)
            this.engine.destroyEntity(cp.entity)
        }
        this.checkpoints = []

        for (const c of this.collectibles) {
            this.scene.remove(c.entity)
            this.engine.destroyEntity(c.entity)
        }
        this.collectibles = []

        for (const p of this.powerUps) {
            this.world.removeRigidBody(p.rigidBody)
            this.scene.remove(p.entity)
            this.engine.destroyEntity(p.entity)
        }
        this.powerUps = []
        this.activeEffects = {}

        for (const platform of this.movingPlatforms) {
            this.world.removeRigidBody(platform.rigidBody)
            this.scene.remove(platform.entity)
            this.engine.destroyEntity(platform.entity)
        }
        this.movingPlatforms = []

        for (const platform of this.rotatingPlatforms) {
            this.world.removeRigidBody(platform.rigidBody)
            this.scene.remove(platform.entity)
            this.engine.destroyEntity(platform.entity)
        }
        this.rotatingPlatforms = []

        if (this.ghostEntity) {
            this.scene.remove(this.ghostEntity)
            if (this.ghostMaterialInstance) this.engine.destroyMaterialInstance(this.ghostMaterialInstance)
            this.engine.destroyEntity(this.ghostEntity)
            this.Filament.EntityManager.get().destroy(this.ghostEntity)
            this.ghostEntity = null
            this.ghostMaterialInstance = null
        }

        if (this.ghostLightEntity) {
            this.scene.remove(this.ghostLightEntity)
            this.engine.destroyEntity(this.ghostLightEntity)
            this.Filament.EntityManager.get().destroy(this.ghostLightEntity)
            this.ghostLightEntity = null
        }

        if (this.portalA) this.destroyPortal(this.portalA)
        if (this.portalB) this.destroyPortal(this.portalB)
        this.portalA = null
        this.portalB = null
        document.getElementById('portal-a-status').style.color = '#444'
        document.getElementById('portal-b-status').style.color = '#444'

        if (this.temporaryPlatforms) {
            for (const p of this.temporaryPlatforms) {
                this.world.removeRigidBody(p.rigidBody)
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
            }
            this.temporaryPlatforms = []
        }

        if (this.visualParticles) {
            for (const p of this.visualParticles) {
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
            }
            this.visualParticles = []
        }

        if (this.activeMissiles) {
            for (const m of this.activeMissiles) {
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
            }
            this.activeMissiles = []
        }

        if (this.activeBombs) {
            for (const b of this.activeBombs) {
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
            }
            this.activeBombs = []
        }

        if (this.activeMissiles) {
            for (const m of this.activeMissiles) {
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
            }
            this.activeMissiles = []
        }

        if (this.activeBlackHoles) {
            for (const bh of this.activeBlackHoles) {
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
            }
            this.activeBlackHoles = []
        }

        this.adrenaline = 0
        if (this.nearMisses) this.nearMisses.clear()

        this.setNightMode(false)
    }

}

export function applyInitMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitMethods.prototype[name];
        }
    }
}

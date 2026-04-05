import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { LEVELS } from './levels.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';

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
                            this.jumpCount++
                            audio.playJump()
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
                }
            }
            this.keys[e.code] = true
            if (e.code === 'KeyC') {
                const modes = ['orbit', 'follow', 'fpv', 'topdown']
                const idx = modes.indexOf(this.cameraMode)
                this.cameraMode = modes[(idx + 1) % modes.length]
                console.log('Camera Mode:', this.cameraMode)
            }
            if (e.code === 'KeyE') {
                this.magnetMode = 'attract'
                this.magnetActive = true
            }
            if (e.code === 'KeyQ') {
                this.magnetMode = 'repel'
                this.magnetActive = true
            }
            if (e.code === 'KeyB' && this.playerMarble) {
                this.spawnHoloPlatform()
            }
            if (e.code === 'KeyH' && this.playerMarble) {
                this.hoverActive = true
            }
            if (e.code === 'KeyG' && this.playerMarble) {
                this.iceActive = true
            }
            if (e.code === 'KeyU' && this.playerMarble) {
                this.flipActive = !this.flipActive
                if (this.flipActive) {
                    this.playerMarble.rigidBody.setGravityScale(-this.playerMarble.baseGravityScale, true)
                } else {
                    this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
                }
            }
            if (e.code === 'KeyV' && this.playerMarble) {
                const now = Date.now()
                if (now - this.lastDashTime > this.dashCooldown) {
                    const rb = this.playerMarble.rigidBody
                    const cosP = Math.cos(this.pitchAngle)
                    const sinP = Math.sin(this.pitchAngle)
                    const dirX = Math.sin(this.aimYaw) * cosP
                    const dirY = sinP
                    const dirZ = Math.cos(this.aimYaw) * cosP

                    // Apply a strong physics impulse instead of teleporting
                    const force = 100.0
                    rb.applyImpulse({
                        x: dirX * force,
                        y: dirY * force,
                        z: dirZ * force
                    }, true)

                    this.lastDashTime = now
                    if (typeof audio !== 'undefined' && audio.playBoost) audio.playBoost()
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
            }
            if (e.code === 'Digit7' && this.playerMarble) {
                this.gliderActive = true
            }
            if (e.code === 'Digit8' && this.playerMarble) {
                this.timeStopActive = !this.timeStopActive
                if (this.timeStopActive) {
                    if (audio && audio.playTrick) audio.playTrick()
                    this.showTrickMessage('TIME STOP!', '#ffffff')
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
            if (e.code === 'KeyX' && this.playerMarble) {
                this.spawnBomb()
            }
            if (e.code === 'KeyO' && this.playerMarble) {
                this.shieldActive = true
            }
            if (e.code === 'KeyL' && this.playerMarble) {
                this.spawnMissile()
            }
            if (e.code === 'KeyT') {
                this.isRewinding = true
            }
            if (e.code === 'KeyP' && this.playerMarble) {
                const now = Date.now()
                if (now - this.lastTeleportTime > this.teleportCooldown) {
                    this.triggerTeleport()
                }
            }
            if (e.code === 'KeyJ' && this.playerMarble) {
                this.jetpackActive = true
            }
            if (e.code === 'KeyY' && this.playerMarble) {
                this.vortexActive = true
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
                this.shieldActive = false
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
        await RAPIER.init()
        const gravity = { x: 0.0, y: -9.81, z: 0.0 }
        this.world = new RAPIER.World(gravity)
        console.log('[INIT] Physics initialized')

        console.log('[INIT] Initializing Filament rendering...')
        this.Filament = await loadFilament()
        console.log('[INIT] Filament loaded')

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

        const Fov = this.Filament.Camera$Fov
        const aspect = width / height
        this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, Fov.VERTICAL)
        this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])

        this.renderer.setClearOptions({ clearColor: [0.1, 0.1, 0.1, 1.0], clear: true })
        console.log('[INIT] Camera and view configured')

        console.log('[INIT] Loading assets...')
        await this.setupAssets()
        console.log('[INIT] Assets loaded')

        this.createLight()
        console.log('[INIT] Lights created')

        this.setupPostProcessing()
        console.log('[INIT] Post-processing enabled')

        this.showLevelSelection()
        console.log('[INIT] Level menu displayed')

        const loading = document.getElementById('loading')
        if (loading) loading.style.display = 'none'
        console.log('[INIT] Loading screen hidden')

        this.resize()
        window.addEventListener('resize', () => this.resize())
        console.log('[INIT] Starting game loop')

        this.loop()
        console.log('[INIT] Initialization complete!')
    }

    showLevelSelection() {
        const menu = document.getElementById('level-menu')
        const levelGrid = document.getElementById('level-grid')
        const gameUI = document.getElementById('ui')

        menu.style.display = 'flex'
        gameUI.style.display = 'none'
        levelGrid.innerHTML = ''

        Object.entries(LEVELS).forEach(([id, level]) => {
            const card = document.createElement('div')
            card.className = 'level-card'
            card.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <span class="goals">${level.goals.length} Goal${level.goals.length !== 1 ? 's' : ''}</span>
            `
            card.addEventListener('click', () => this.loadLevel(id))
            levelGrid.appendChild(card)
        })
    }

    async loadLevel(levelId) {
        console.log(`[LEVEL] Loading level: ${levelId}`)
        const level = LEVELS[levelId]
        if (!level) {
            console.error(`[LEVEL] Level ${levelId} not found!`)
            return
        }

        document.getElementById('level-menu').style.display = 'none'
        document.getElementById('ui').style.display = 'block'

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
        this.levelStartTime = Date.now()
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
            if (m.lightEntity) {
                this.scene.remove(m.lightEntity)
                this.engine.destroyEntity(m.lightEntity)
            }
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

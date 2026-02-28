import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from './sphere.js';
import { createSpaceStationZone } from './space_station.js';
import { createSkateParkZone } from './skate_park.js';
import { createHelixZone } from './helix_zone.js';
import { createPinballZone } from './pinball_zone.js';
import { createClockworkZone } from './clockwork_zone.js';
import { createBumperArenaZone } from './bumper_arena.js';
import { audio } from './audio.js';
import { LEVELS } from './levels.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';
import { CUBE_VERTICES, CUBE_INDICES } from './cube-geometry.js';
import { applyZoneMethods } from './zone-methods.js';
import { marblesInfo } from './marbles_data.js';

async function loadFilament() {
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

class MarblesGame {
    constructor() {
        this.canvas = document.getElementById('canvas')
        this.marbles = []
        this.staticBodies = []
        this.staticEntities = []
        this.dynamicObjects = []
        this.checkpoints = []
        this.collectibles = []
        this.collectibleRotation = 0
        this.powerUps = []
        this.activeEffects = { speed: 0, jump: 0 }
        this.movingPlatforms = []
        this.rotatingPlatforms = []
        this.Filament = null
        this.material = null
        this.cubeMesh = null

        this.camAngle = 0
        this.camHeight = 10
        this.camRadius = 25

        this.keys = {}
        this.cameraMode = 'orbit'
        this.score = 0
        this.scoreEl = document.getElementById('score')
        this.timerEl = document.getElementById('timer')
        this.levelNameEl = document.getElementById('level-name')
        this.selectedEl = document.getElementById('selected')
        this.aimEl = document.getElementById('aim')
        this.powerbarEl = document.getElementById('powerbar')
        this.jumpBarEl = document.getElementById('jumpbar')
        this.boostBarEl = document.getElementById('boostbar')
        this.magnetBarEl = document.getElementById('magnetbar')
        this.focusBarEl = document.getElementById('focusbar')
        this.rewindBarEl = document.getElementById('rewindbar')
        this.effectEl = document.getElementById('effects')
        this.currentMarbleIndex = 0
        this.aimYaw = 0
        this.jumpCharge = 0
        this.lastBoostTime = 0
        this.boostCooldown = 3000
        this.isChargingJump = false
        this.pitchAngle = 0
        this.chargePower = 0
        this.charging = false
        this.isAiming = false
        this.playerMarble = null
        this.cueInst = null
        this.jumpCount = 0
        this.maxJumps = 2
        this.powerUpRotation = 0
        this.isStomping = false

        this.magnetPower = 1.0
        this.magnetActive = false
        this.magnetMode = null

        this.isGrappling = false
        this.grappleTarget = null
        this.grappleEntity = null
        this.grappleInst = null
        this.grappleMaxDist = 50.0
        this.grappleForce = 40.0

        // Focus / Time Slow Mechanic
        this.timeScale = 1.0
        this.focusEnergy = 100
        this.maxFocusEnergy = 100
        this.focusActive = false

        // Rewind Mechanic
        this.rewindHistory = []
        this.isRewinding = false
        this.maxRewindFrames = 300 // 5 seconds at 60fps

        this.currentLevel = null
        this.levelStartTime = 0
        this.levelComplete = false
        this.goalDefinitions = []
        this.checkpointDefinitions = []
    }

    initMouseControls() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault())

        this.canvas.addEventListener('click', () => {
            if (document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock()
            }
        })

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.canvas) {
                const sensitivity = 0.002
                this.aimYaw -= e.movementX * sensitivity
                this.pitchAngle -= e.movementY * sensitivity
                const maxPitch = 1.4
                this.pitchAngle = Math.max(-maxPitch, Math.min(maxPitch, this.pitchAngle))
            }
        })

        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) {
                    this.charging = true
                    this.chargePower = 0
                } else if (e.button === 2) {
                    this.startGrapple()
                }
            }
        })

        document.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) {
                    if (this.charging) {
                        this.charging = false
                        this.shootMarble()
                    }
                } else if (e.button === 2) {
                    this.stopGrapple()
                }
            }
        })
    }

    isGrounded(marble) {
        if (!marble || !marble.rigidBody) return false
        const rb = marble.rigidBody
        const radius = marble.scale * 0.5 || 0.5
        const pos = rb.translation()
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: 0, y: -1, z: 0 }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)
        const maxToi = radius + 0.1
        const hit = this.world.castRay(ray, maxToi, true)

        if (hit) {
            const otherBody = hit.collider.parent()
            if (otherBody && otherBody.handle === rb.handle) {
                return false // Hit self, ignore
            }
            return true
        }
        return false
    }

    getWallContact(marble) {
        if (!marble || !marble.rigidBody) return null
        const rb = marble.rigidBody
        const radius = marble.scale * 0.5 || 0.5
        const pos = rb.translation()

        // 8 directions
        const directions = [
            { x: 1, z: 0 }, { x: -1, z: 0 },
            { x: 0, z: 1 }, { x: 0, z: -1 },
            { x: 0.707, z: 0.707 }, { x: -0.707, z: 0.707 },
            { x: 0.707, z: -0.707 }, { x: -0.707, z: -0.707 }
        ]

        // We need to check collisions that are NOT the marble itself.

        for (const dir of directions) {
             const len = Math.sqrt(dir.x*dir.x + dir.z*dir.z)
             const ndir = { x: dir.x/len, y: 0, z: dir.z/len }

             const startDist = radius + 0.05
             const rayOrigin = {
                 x: pos.x + ndir.x * startDist,
                 y: pos.y,
                 z: pos.z + ndir.z * startDist
             }

             const ray = new RAPIER.Ray(rayOrigin, ndir)
             const checkDist = 0.5

             const hit = this.world.castRay(ray, checkDist, true)

             if (hit) {
                 const otherBody = hit.collider.parent()
                 if (otherBody && otherBody.handle !== rb.handle) {
                     // Found a wall!
                     return { normal: { x: -ndir.x, y: 0, z: -ndir.z } }
                 }
             }
        }
        return null
    }

    async init() {
        console.log('[INIT] Starting game initialization...')

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

                            const upForce = 15.0
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
                            const linvel = this.playerMarble.rigidBody.linvel()
                            this.playerMarble.rigidBody.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)
                            this.playerMarble.rigidBody.applyImpulse({ x: 0, y: 10.0, z: 0 }, true)
                            this.jumpCount++
                            audio.playJump()
                        }
                    }
                }
            }
            if (e.code === 'Tab') {
                e.preventDefault()
                if (this.marbles.length > 0) {
                    this.currentMarbleIndex = (this.currentMarbleIndex + 1) % this.marbles.length
                    this.playerMarble = this.marbles[this.currentMarbleIndex]
                    this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
                    console.log(`[GAME] Switched to marble ${this.currentMarbleIndex}: ${this.playerMarble.name}`)
                }
            }
            this.keys[e.code] = true
            if (e.code === 'KeyC') {
                this.cameraMode = this.cameraMode === 'orbit' ? 'follow' : 'orbit'
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
            if (e.code === 'KeyZ' && this.playerMarble && !this.isGrounded(this.playerMarble)) {
                this.isStomping = true
                this.playerMarble.rigidBody.setLinvel({ x: 0, y: -60.0, z: 0 }, true)

                const rcm = this.engine.getRenderableManager()
                const inst = rcm.getInstance(this.playerMarble.entity)
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.0, 0.0])

                audio.playBoost()
            }
            if (e.code === 'KeyT') {
                this.isRewinding = true
            }
        })

        window.addEventListener('keyup', (e) => {
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
                    this.playerMarble.rigidBody.applyImpulse({ x: 0, y: force, z: 0 }, true)
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
        this.camera.setProjectionFov(45, aspect, 0.1, 1000.0, Fov.VERTICAL)
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

        this.currentLevel = levelId
        this.levelNameEl.textContent = level.name
        this.goalDefinitions = level.goals
        this.checkpointDefinitions = level.checkpoints || []
        this.score = 0
        this.scoreEl.textContent = 'Score: 0'
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
        console.log('[LEVEL] Level loading complete!')
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

        this.setNightMode(false)
    }

    async createZone(zone) {
        const pos = zone.pos || { x: 0, y: 0, z: 0 }
        const offset = { x: pos.x, y: pos.y, z: pos.z }

        switch (zone.type) {
            case 'floor':
                this.createFloorZone(offset, zone.size)
                break
            case 'track':
                this.createTrackZone(offset)
                break
            case 'landing':
                this.createLandingZone(offset)
                break
            case 'jump':
                this.createJumpZone(offset)
                break
            case 'slalom':
                this.createSlalomZone(offset)
                break
            case 'staircase':
                this.createStaircaseZone(offset)
                break
            case 'split':
                this.createSplitZone(offset)
                break
            case 'forest':
                this.createForestZone(offset)
                break
            case 'goal':
                this.createGoalZone(offset, zone.color)
                break
            case 'orchard':
                this.createOrchardZone(zone.center, zone.radius)
                break
            case 'spiral':
                this.createSpiralZone(offset)
                break
            case 'zigzag':
                this.createZigZagZone(offset)
                break
            case 'neon_city':
                this.createNeonCityZone(offset)
                break
            case 'loop':
                this.createLoopZone(offset)
                break
            case 'block':
                this.createBlockZone(offset)
                break
            case 'bowling':
                this.createBowlingZone(offset)
                break
            case 'castle':
                this.createCastleZone(offset)
                break
            case 'checkpoint':
                this.createCheckpointZone(offset, zone.size)
                break
            case 'domino':
                this.createDominoZone(offset)
                break
            case 'pyramid':
                this.createPyramidZone(offset)
                break
            case 'powerup':
                this.createPowerUpZone(offset)
                break
            case 'space_station':
                createSpaceStationZone(this, offset)
                break
            case 'skate_park':
                createSkateParkZone(this, offset)
                break
            case 'helix':
                createHelixZone(this, offset)
                break
            case 'pinball':
                createPinballZone(this, offset)
                break
            case 'moving':
                this.createMovingZone(offset)
                break
            case 'clockwork':
                createClockworkZone(this, offset)
                break
            case 'bumper_arena':
                createBumperArenaZone(this, offset)
                break
        }
    }

    async setupAssets() {
        console.log('[ASSETS] Loading baked_color.filmat...')
        let response
        try {
            response = await fetch('./baked_color.filmat')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
        } catch (e) {
            console.error('[ASSETS] Failed to fetch material:', e)
            throw e
        }
        const buffer = await response.arrayBuffer()
        console.log(`[ASSETS] Loaded ${buffer.byteLength} bytes`)
        this.material = this.engine.createMaterial(new Uint8Array(buffer))
        console.log('[ASSETS] Material created successfully')

        const VertexAttribute = this.Filament['VertexAttribute']
        const AttributeType = this.Filament['VertexBuffer$AttributeType']

        this.vb = this.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
            .build(this.engine)
        this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES)

        this.ib = this.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.ib.setBuffer(this.engine, CUBE_INDICES)

        const sphereData = createSphere(0.5, 64, 32)
        this.sphereVb = this.Filament.VertexBuffer.Builder()
            .vertexCount(sphereData.vertices.length / 7)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
            .build(this.engine)
        this.sphereVb.setBufferAt(this.engine, 0, sphereData.vertices)

        this.sphereIb = this.Filament.IndexBuffer.Builder()
            .indexCount(sphereData.indices.length)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.sphereIb.setBuffer(this.engine, sphereData.indices)

        this.createCueStick()
        this.createGrappleLine()
    }

    createGrappleLine() {
        this.grappleEntity = this.Filament.EntityManager.get().create()
        // Bright cyan/blue color for the grapple line
        const grappleColor = [0.0, 1.0, 1.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, grappleColor)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, this.grappleEntity)

        this.scene.addEntity(this.grappleEntity)

        const tcm = this.engine.getTransformManager()
        this.grappleInst = tcm.getInstance(this.grappleEntity)

        // Hide initially
        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.grappleInst, zeroMat)
    }

    createCueStick() {
        this.cueEntity = this.Filament.EntityManager.get().create()
        const cueColor = [1.0, 1.0, 0.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, cueColor)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, this.cueEntity)

        this.scene.addEntity(this.cueEntity)

        const tcm = this.engine.getTransformManager()
        this.cueInst = tcm.getInstance(this.cueEntity)

        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.cueInst, zeroMat)
    }

    startGrapple() {
        if (!this.playerMarble || !this.world) return

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()

        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)

        const hit = this.world.castRay(ray, this.grappleMaxDist, true)
        if (hit) {
            this.grappleTarget = {
                x: rayOrigin.x + rayDir.x * hit.toi,
                y: rayOrigin.y + rayDir.y * hit.toi,
                z: rayOrigin.z + rayDir.z * hit.toi
            }
            this.isGrappling = true
            console.log("[GAME] Grapple attached at", this.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    stopGrapple() {
        this.isGrappling = false
        this.grappleTarget = null

        if (this.grappleInst) {
            const tcm = this.engine.getTransformManager()
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            tcm.setTransform(this.grappleInst, zeroMat)
        }
    }

    updateGrapple() {
        if (!this.isGrappling || !this.playerMarble || !this.grappleTarget) {
            if (this.isGrappling) this.stopGrapple()
            return
        }

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const target = this.grappleTarget

        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dz = target.z - pos.z
        const dist = Math.hypot(dx, dy, dz)

        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist

        // Apply pulling force
        rb.applyImpulse({
            x: dirX * this.grappleForce,
            y: dirY * this.grappleForce,
            z: dirZ * this.grappleForce
        }, true)

        // Counter-gravity
        if (dirY > 0) {
            rb.applyImpulse({ x: 0, y: 1.0, z: 0 }, true)
        }

        // Visuals
        if (this.grappleInst) {
            let ux = 0, uy = 1, uz = 0
            if (Math.abs(dirY) > 0.99) {
                ux = 1; uy = 0; uz = 0
            }

            let rx = uy * dirZ - uz * dirY
            let ry = uz * dirX - ux * dirZ
            let rz = ux * dirY - uy * dirX
            const rLen = Math.hypot(rx, ry, rz)
            rx /= rLen; ry /= rLen; rz /= rLen

            let newUx = dirY * rz - dirZ * ry
            let newUy = dirZ * rx - dirX * rz
            let newUz = dirX * ry - dirY * rx

            const thick = 0.05

            const midX = (pos.x + target.x) / 2
            const midY = (pos.y + target.y) / 2
            const midZ = (pos.z + target.z) / 2

            const mat = new Float32Array([
                rx * thick, ry * thick, rz * thick, 0,
                newUx * thick, newUy * thick, newUz * thick, 0,
                dx, dy, dz, 0,
                midX, midY, midZ, 1
            ])

            const tcm = this.engine.getTransformManager()
            tcm.setTransform(this.grappleInst, mat)
        }
    }

    shootMarble() {
        if (!this.playerMarble) return

        const force = 50.0 + this.chargePower * 150.0
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        this.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true)

        this.chargePower = 0
        this.powerbarEl.style.width = '0%'
    }

    createLight() {
        this.light = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.95, 0.85])
            .intensity(120000.0)
            .direction([0.5, -1.0, -0.7])
            .castShadows(true)
            .sunAngularRadius(1.9)
            .sunHaloSize(10.0)
            .sunHaloFalloff(80.0)
            .build(this.engine, this.light)
        this.scene.addEntity(this.light)

        this.fillLight = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
            .color([0.7, 0.8, 1.0])
            .intensity(35000.0)
            .direction([-0.5, -0.3, 0.6])
            .castShadows(false)
            .build(this.engine, this.fillLight)
        this.scene.addEntity(this.fillLight)

        this.backLight = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].DIRECTIONAL)
            .color([0.6, 0.6, 0.75])
            .intensity(25000.0)
            .direction([0.0, -0.5, 1.0])
            .castShadows(false)
            .build(this.engine, this.backLight)
        this.scene.addEntity(this.backLight)
    }

    setupPostProcessing() {
        // Bloom - makes bright marbles and lights glow
        this.view.setBloomOptions({
            enabled: true,
            strength: 0.3,
            resolution: 256,
            levels: 6,
            threshold: true,
            highlight: 10.0,
            blendMode: this.Filament['View$BloomOptions$BlendMode'].ADD,
            quality: this.Filament['View$QualityLevel'].MEDIUM,
        })

        // SSAO - ambient occlusion for contact shadows under marbles
        this.view.setAmbientOcclusion(this.Filament['View$AmbientOcclusion'].SSAO)
        this.view.setAmbientOcclusionOptions({
            radius: 0.5,
            power: 1.8,
            bias: 0.005,
            resolution: 0.5,
            intensity: 1.5,
            quality: this.Filament['View$QualityLevel'].MEDIUM,
            enabled: true,
        })

        // MSAA 4x - smooth sphere edges
        this.view.setMultiSampleAntiAliasingOptions({ enabled: true, sampleCount: 4 })

        // ACES tone mapping for cinematic, physically-correct look
        const colorGrading = this.Filament.ColorGrading.Builder()
            .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
            .contrast(1.05)
            .saturation(1.1)
            .build(this.engine)
        this.view.setColorGrading(colorGrading)

        // Indirect Light (IBL) via 2-band Spherical Harmonics
        // Simulates a cool blue sky above with warm ground bounce below
        const iblSh = new Float32Array([
            // L00 - overall ambient (neutral blue-white)
            0.9, 0.92, 1.05,
            // L1-1 - warm floor bounce (Y negative)
            0.12, 0.10, 0.06,
            // L10 - sky direction (Y positive)
            -0.18, -0.18, -0.28,
            // L11 - X side contribution
            0.04, 0.04, 0.05,
        ])
        this.ibl = this.Filament.IndirectLight.Builder()
            .irradianceSh(2, iblSh)
            .intensity(30000.0)
            .build(this.engine)
        this.scene.setIndirectLight(this.ibl)

        // Skybox - replace flat gray background with a deep space blue
        this.skyboxEntity = this.Filament.Skybox.Builder()
            .color([0.08, 0.10, 0.18, 1.0])
            .build(this.engine)
        this.scene.setSkybox(this.skyboxEntity)
    }

    createStaticBox(pos, rotation, halfExtents, color, material = 'wood') {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        this.world.createCollider(colliderDesc, body)
        this.staticBodies.push(body)

        audio.registerBodyMaterial(body, material)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, color)
        matInstance.setFloatParameter('roughness', 0.4)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)

        const mat = quaternionToMat4(pos, rotation)
        const sx = halfExtents.x * 2
        const sy = halfExtents.y * 2
        const sz = halfExtents.z * 2

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)
        this.staticEntities.push(entity)
    }

    createDynamicBox(pos, rotation, halfExtents, color, density = 1.0, material = 'wood', gravityScale = 1.0) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        if (gravityScale !== 1.0) bodyDesc.setGravityScale(gravityScale)
        const body = this.world.createRigidBody(bodyDesc)

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setDensity(density)
        this.world.createCollider(colliderDesc, body)

        audio.registerBodyMaterial(body, material)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.4)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        this.dynamicObjects.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents
        })
    }

    createRotatingBox(pos, halfExtents, color, axis = 'y', speed = 0.01, initialAngle = 0, material = 'metal') {
        const rotation = quatFromEuler(0, initialAngle, 0) // Assume Y axis for now

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        const body = this.world.createRigidBody(bodyDesc)

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        this.world.createCollider(colliderDesc, body)

        if (audio && audio.registerBodyMaterial) {
             audio.registerBodyMaterial(body, material)
        }

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        this.rotatingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents,
            axis: axis,
            speed: speed,
            angle: initialAngle,
            pos: pos
        })
    }

    createMarbles(spawnPos) {
        const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 }

        for (const info of marblesInfo) {
            const radius = info.radius || 0.5
            const scale = radius / 0.5
            const pos = {
                x: baseSpawn.x + info.offset.x,
                y: baseSpawn.y + info.offset.y,
                z: baseSpawn.z + info.offset.z
            }

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setCanSleep(false)

            if (info.gravityScale !== undefined) bodyDesc.setGravityScale(info.gravityScale)
            if (info.linearDamping !== undefined) bodyDesc.setLinearDamping(info.linearDamping)
            if (info.angularDamping !== undefined) bodyDesc.setAngularDamping(info.angularDamping)

            const rigidBody = this.world.createRigidBody(bodyDesc)

            const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                .setRestitution(info.restitution !== undefined ? info.restitution : 0.5)

            if (info.density) colliderDesc.setDensity(info.density)
            if (info.friction !== undefined) colliderDesc.setFriction(info.friction)

            this.world.createCollider(colliderDesc, rigidBody)

            const entity = this.Filament.EntityManager.get().create()
            const matInstance = this.material.createInstance()
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, info.color)
            matInstance.setFloatParameter('roughness', info.roughness !== undefined ? info.roughness : 0.4)

            const vb = info.geometry === 'cube' ? this.vb : this.sphereVb
            const ib = info.geometry === 'cube' ? this.ib : this.sphereIb

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
                .build(this.engine, entity)

            this.scene.addEntity(entity)

            const marbleObj = {
                name: info.name || `Marble ${this.marbles.length + 1}`,
                rigidBody,
                entity,
                scale,
                color: info.color,
                initialPos: pos,
                respawnPos: { ...pos },
                scoredGoals: new Set(),
                rainbow: info.rainbow
            }

            if (info.emissive) {
                const lightEntity = this.Filament.EntityManager.get().create()
                this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                    .color(info.lightColor || info.color)
                    .intensity(info.lightIntensity || 10000.0)
                    .falloff(20.0)
                    .build(this.engine, lightEntity)
                this.scene.addEntity(lightEntity)
                marbleObj.lightEntity = lightEntity
            }

            this.marbles.push(marbleObj)
        }

        this.currentMarbleIndex = 0
        this.playerMarble = this.marbles[0]
        this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
    }

    getLeader() {
        let maxZ = -Infinity
        let leader = null
        for (const m of this.marbles) {
            const t = m.rigidBody.translation()
            if (t.z > maxZ) {
                maxZ = t.z
                leader = m
            }
        }
        return leader
    }

    resetMarbles() {
        audio.stopAllRolling()

        for (const m of this.marbles) {
            m.rigidBody.setTranslation(m.initialPos, true)
            m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
            m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
            m.scoredGoals.clear()
            m.respawnPos = { ...m.initialPos }
        }

        for (const cp of this.checkpoints) {
            cp.activated = false
            if (cp.matInstance) {
                cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
            }
        }

        this.score = 0
        this.scoreEl.textContent = 'Score: 0'
        this.currentMarbleIndex = 0
        this.playerMarble = this.marbles[0]
        this.selectedEl.textContent = `Selected: ${this.playerMarble ? this.playerMarble.name : 'None'}`
        this.aimYaw = 0
        this.chargePower = 0
        this.charging = false
        this.powerbarEl.style.width = '0%'
        this.levelComplete = false
        this.rewindHistory = []
    }

    returnToMenu() {
        audio.stopAllRolling()
        this.clearLevel()
        this.showLevelSelection()
    }

    processCollisionEvents() {
        if (!this.world) return

        const processedCollisions = new Set()
        const touchingSurfaces = new Map()

        for (let i = 0; i < this.marbles.length; i++) {
            const marble = this.marbles[i]
            const rb = marble.rigidBody
            const velocity = rb.linvel()
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
            const angVel = rb.angvel()
            const angularSpeed = Math.hypot(angVel.x, angVel.y, angVel.z)

            const radius = marble.scale * 0.5 || 0.5
            const pos = rb.translation()

            const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
            const rayDir = { x: 0, y: -1, z: 0 }
            const ray = new RAPIER.Ray(rayOrigin, rayDir)
            const maxToi = radius + 0.1

            const hit = this.world.castRay(ray, maxToi, true)
            if (hit) {
                const otherCollider = hit.collider
                const otherBody = otherCollider.parent()

                if (otherBody && otherBody !== rb) {
                    if (otherBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                        const material = audio.getMaterial(otherBody.handle)

                        touchingSurfaces.set(i, { material, speed, angularSpeed, radius })

                        const collisionId = `${rb.handle}-${otherBody.handle}`
                        if (!processedCollisions.has(collisionId) && speed > 2.5) {
                            processedCollisions.add(collisionId)
                            audio.playSurfaceHit(speed, radius, material, `surface-${rb.handle}`)
                        }
                    }
                }
            }
        }

        for (let i = 0; i < this.marbles.length; i++) {
            const marbleId = `marble-${i}`
            const surfaceInfo = touchingSurfaces.get(i)

            if (surfaceInfo && surfaceInfo.speed > 0.3) {
                const rollingId = `${marbleId}-rolling`
                if (!audio.rollingSounds || !audio.rollingSounds.has(rollingId)) {
                    audio.startRolling(rollingId, surfaceInfo.radius, surfaceInfo.material)
                }
                audio.updateRolling(rollingId, surfaceInfo.speed, surfaceInfo.angularSpeed)
            } else {
                audio.stopRolling(`${marbleId}-rolling`)
            }
        }
    }

    performStompImpact() {
        if (!this.playerMarble) return

        if (audio.playStomp) audio.playStomp()

        const center = this.playerMarble.rigidBody.translation()
        const radius = 15.0
        const force = 100.0

        const applyForce = (body) => {
            const t = body.translation()
            const dx = t.x - center.x
            const dy = t.y - center.y
            const dz = t.z - center.z
            const dist = Math.hypot(dx, dy, dz)

            if (dist < radius && dist > 0.1) {
                const factor = 1.0 - (dist / radius)
                const nx = dx / dist
                const ny = dy / dist
                const nz = dz / dist

                body.applyImpulse({
                    x: nx * force * factor,
                    y: (ny * 0.5 + 0.5) * force * factor,
                    z: nz * force * factor
                }, true)
            }
        }

        for (const m of this.marbles) {
            if (m !== this.playerMarble) {
                applyForce(m.rigidBody)
            }
        }
        for (const obj of this.dynamicObjects) {
            applyForce(obj.rigidBody)
        }

        if (this.playerMarble.color) {
            const rcm = this.engine.getRenderableManager()
            const inst = rcm.getInstance(this.playerMarble.entity)
            rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.color)
        }
    }

    checkGameLogic() {
        if (!this.currentLevel || this.levelComplete) return

        if (this.playerMarble && this.isGrounded(this.playerMarble)) {
            const linvel = this.playerMarble.rigidBody.linvel()
            if (linvel.y <= 0.1) {
                this.jumpCount = 0
            }
            if (this.isStomping) {
                this.performStompImpact()
                this.isStomping = false
            }
        }

        const level = LEVELS[this.currentLevel]
        let allGoalsScored = level.goals.length > 0

        for (const m of this.marbles) {
            const t = m.rigidBody.translation()

            if (t.y < -20) {
                const respawn = m.respawnPos || m.initialPos
                m.rigidBody.setTranslation(respawn, true)
                m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
                m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
                m.scoredGoals.clear()
                if (m === this.playerMarble) {
                    this.rewindHistory = []
                }
                continue
            }

            for (const cp of this.checkpoints) {
                if (cp.activated) continue

                const radius = m.scale * 0.5 || 0.5
                const minX = cp.pos.x - cp.halfExtents.x
                const maxX = cp.pos.x + cp.halfExtents.x
                const minZ = cp.pos.z - cp.halfExtents.z
                const maxZ = cp.pos.z + cp.halfExtents.z
                const minY = cp.pos.y - cp.halfExtents.y
                const maxY = cp.pos.y + cp.halfExtents.y

                if (t.x + radius > minX && t.x - radius < maxX &&
                    t.z + radius > minZ && t.z - radius < maxZ &&
                    t.y + radius > minY && t.y - radius < maxY) {
                    cp.activated = true
                    if (cp.matInstance) {
                        cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 0.0])
                    }
                    audio.playGoal()
                    m.respawnPos = { x: cp.pos.x, y: cp.pos.y + 1.0, z: cp.pos.z }
                    console.log(`[GAME] Checkpoint activated by ${m.name}! New respawn set.`)
                }
            }

            for (const goal of this.goalDefinitions) {
                if (!m.scoredGoals.has(goal.id) &&
                    t.x > goal.range.x[0] && t.x < goal.range.x[1] &&
                    t.z > goal.range.z[0] && t.z < goal.range.z[1] &&
                    t.y > goal.range.y[0] && t.y < goal.range.y[1]) {

                    m.scoredGoals.add(goal.id)
                    this.score++
                    this.scoreEl.textContent = 'Score: ' + this.score

                    if (this.score <= 5) {
                        audio.playGoal()
                    }
                }
            }
        }

        for (const goal of level.goals) {
            let goalScored = false
            for (const m of this.marbles) {
                if (m.scoredGoals.has(goal.id)) {
                    goalScored = true
                    break
                }
            }
            if (!goalScored) {
                allGoalsScored = false
                break
            }
        }

        if (this.playerMarble) {
            const pt = this.playerMarble.rigidBody.translation()
            for (let i = this.powerUps.length - 1; i >= 0; i--) {
                const p = this.powerUps[i]
                const dx = pt.x - p.pos.x
                const dy = pt.y - p.pos.y
                const dz = pt.z - p.pos.z
                if (Math.hypot(dx, dy, dz) < 1.0) {
                    const now = Date.now()
                    const duration = 5000
                    this.activeEffects[p.type] = now + duration

                    if (audio.playCollect) audio.playCollect()
                    console.log(`[GAME] Collected ${p.type} powerup!`)

                    this.world.removeRigidBody(p.rigidBody)
                    this.scene.remove(p.entity)
                    this.engine.destroyEntity(p.entity)
                    this.powerUps.splice(i, 1)
                }
            }
        }

        if (this.playerMarble) {
            const pt = this.playerMarble.rigidBody.translation()
            const pv = this.playerMarble.rigidBody.linvel()
            for (const other of this.marbles) {
                if (other === this.playerMarble) continue
                const ot = other.rigidBody.translation()
                const ov = other.rigidBody.linvel()
                const dx = pt.x - ot.x
                const dy = pt.y - ot.y
                const dz = pt.z - ot.z
                const dist = Math.hypot(dx, dy, dz)
                if (dist < 1.0) {
                    const relSpeed = Math.hypot(pv.x - ov.x, pv.y - ov.y, pv.z - ov.z)
                    if (relSpeed > 4) {
                        this.score += Math.floor(relSpeed / 3)
                        this.scoreEl.innerText = `Score: ${this.score}`

                        const playerRadius = this.playerMarble.scale * 0.5 || 0.5
                        const otherRadius = other.scale * 0.5 || 0.5
                        audio.playClink(relSpeed, playerRadius, `player-${this.currentMarbleIndex}`)
                        audio.playClink(relSpeed * 0.7, otherRadius, `other-${this.marbles.indexOf(other)}`)

                        const nx = dx / dist
                        const ny = dy / dist
                        const nz = dz / dist
                        other.rigidBody.applyImpulse({ x: nx * 6, y: ny * 2 + 2, z: nz * 6 }, true)
                    }
                }
            }
        }

        if (allGoalsScored && !this.levelComplete) {
            this.levelComplete = true
            const time = ((Date.now() - this.levelStartTime) / 1000).toFixed(1)
            setTimeout(() => {
                alert(`Level Complete!\nTime: ${time}s\nPress M to return to menu`)
            }, 100)
        }
    }

    resize() {
        const width = window.innerWidth
        const height = window.innerHeight

        this.canvas.style.width = width + 'px'
        this.canvas.style.height = height + 'px'
        this.canvas.width = width
        this.canvas.height = height

        console.log(`[RESIZE] Canvas: ${width}x${height}`)

        if (this.view && this.camera) {
            this.view.setViewport([0, 0, width, height])
            const aspect = width / height
            const Fov = this.Filament.Camera$Fov
            this.camera.setProjectionFov(45, aspect, 0.1, 1000.0, Fov.VERTICAL)
            this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])
        }
    }

    loop() {
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

        const rotSpeed = 0.02
        const zoomSpeed = 0.5

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
        } else {
            let impulseStrength = 0.5
            if (this.activeEffects.speed && Date.now() < this.activeEffects.speed) {
                impulseStrength *= 2.0
            }

            if (this.playerMarble) {
                const rigidBody = this.playerMarble.rigidBody

                if (this.keys['ArrowUp'] || this.keys['KeyW']) rigidBody.applyImpulse({ x: 0, y: 0, z: impulseStrength }, true)
                if (this.keys['ArrowDown'] || this.keys['KeyS']) rigidBody.applyImpulse({ x: 0, y: 0, z: -impulseStrength }, true)
                if (this.keys['ArrowLeft'] || this.keys['KeyA']) rigidBody.applyImpulse({ x: -impulseStrength, y: 0, z: 0 }, true)
                if (this.keys['ArrowRight'] || this.keys['KeyD']) rigidBody.applyImpulse({ x: impulseStrength, y: 0, z: 0 }, true)
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

        if (this.cameraMode === 'follow' && this.currentLevel) {
            const level = LEVELS[this.currentLevel]
            const target = this.playerMarble || this.getLeader()
            if (target) {
                const t = target.rigidBody.translation()
                const height = level?.camera?.height || 10
                const dist = 20

                const eyeX = t.x - Math.sin(this.aimYaw) * dist
                const eyeZ = t.z - Math.cos(this.aimYaw) * dist

                this.camera.lookAt([eyeX, t.y + height, eyeZ], [t.x, t.y, t.z], [0, 1, 0])
            }
        } else {
            const eyeX = this.camRadius * Math.sin(this.camAngle)
            const eyeZ = this.camRadius * Math.cos(this.camAngle)
            this.camera.lookAt([eyeX, this.camHeight, eyeZ], [0, 0, 0], [0, 1, 0])
        }

        // Update Moving Platforms
        const now = Date.now()
        const timeSec = now / 1000
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
            p.angle += p.speed
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
            p.rotation += 0.05
            const q = quatFromEuler(p.rotation, Math.PI / 4, 0)
            const bob = Math.sin(timeSec * 3) * 0.2
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
        this.collectibleRotation += 0.05
        if (this.collectibles && this.collectibles.length > 0) {
            const tcm = this.engine.getTransformManager()
            for (let i = this.collectibles.length - 1; i >= 0; i--) {
                const c = this.collectibles[i]
                const bobOffset = Math.sin(this.collectibleRotation * 2) * 0.2
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
                        this.score += 10
                        this.scoreEl.textContent = 'Score: ' + this.score
                        this.scene.remove(c.entity)
                        this.engine.destroyEntity(c.entity)
                        this.collectibles.splice(i, 1)
                    }
                }
            }
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

applyZoneMethods(MarblesGame);

window.game = new MarblesGame();
window.game.init();
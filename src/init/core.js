import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { initLevelCatalog, loadDevLevels, LEVELS } from '../levels/catalog.js';
import { mergeRegistryMarbles } from '../marbles_data.js';
import {
    resolveWebGLContextOptions,
    resolveGraphicsQualityForInit,
    toWebGPUPowerPreference,
} from '../rendering-defaults.js';
import { loadFilament } from './filament-loader.js';
import { runWebGPUBootProbe } from '../webgpu/boot-probe.js';
import { initMarblePhysicsWasm } from '../wasm-bridge.js';
import {
    activatePhysicsBackendForLevel,
    createPhysicsBackend,
} from '../game/systems/physics-backend.ts';
import { ParticleSystem } from '../particle-system.js';
import { scheduleWebGPUExperiments } from '../webgpu/index.js';
import { LightingSystem } from '../lighting-system.js';
import { VolumetricLightsSystem } from '../rendering/volumetric-lights.js';
import {
    getRequestedRendererMode,
    installRendererModeControls,
    installSimpleDebugBackend,
    setRuntimeRendererGlobals,
} from '../rendering/simple-debug-renderer.js';
import { getRenderDimensions, applyDynamicResolution } from '../render-resolution.js';
import { isEditorMode } from '../editor/mode.js';

export class InitCore {
    constructor(game) {
        this.game = game;
    }

    async init() {
        console.log('[INIT] Starting game initialization...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(0, 'Starting initialization...')
        }

        window.addEventListener('gamepadconnected', (e) => {
            console.log(`[GAMEPAD] Connected: ${e.gamepad.id} at index ${e.gamepad.index}`)
            this.game.gamepadIndices = this.game.gamepadIndices || []
            if (!this.game.gamepadIndices.includes(e.gamepad.index)) {
                this.game.gamepadIndices.push(e.gamepad.index)
            }
        })

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`[GAMEPAD] Disconnected: ${e.gamepad.id} at index ${e.gamepad.index}`)
            if (this.game.gamepadIndices) {
                this.game.gamepadIndices = this.game.gamepadIndices.filter(i => i !== e.gamepad.index)
            }
            if (this.game.gamepadState) {
                delete this.game.gamepadState[e.gamepad.index]
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
                if (this.game.currentLevel) {
                    this.game.togglePause()
                }
                return
            }

            // Don't process game inputs when paused
            if (this.game.isPaused) return

            if (e.code === 'Tab') {
                e.preventDefault()
                if (this.game.marbles.length > 0) {
                    if (this.game.playerMarble && this.game.flipActive) {
                        this.game.playerMarble.rigidBody.setGravityScale(this.game.playerMarble.baseGravityScale, true)
                        this.game.flipActive = false
                    }
                    // Cycle among player-controllable marbles; level rivals aren't selectable.
                    let next = this.game.currentMarbleIndex
                    for (let i = 0; i < this.game.marbles.length; i++) {
                        next = (next + 1) % this.game.marbles.length
                        if (!this.game.marbles[next].isRival) break
                    }
                    this.game.currentMarbleIndex = next
                    this.game.playerMarble = this.game.marbles[this.game.currentMarbleIndex]
                    this.game.selectedEl.textContent = `Selected: ${this.game.playerMarble.name}`
                    console.log(`[GAME] Switched to marble ${this.game.currentMarbleIndex}: ${this.game.playerMarble.name}`)
                    this.game.updateActiveMarbleLight()
                }
            }
            this.game.keys[e.code] = true

            // Every ability key (press / hold / charge) is a registry entry
            // (src/abilities/registry.js); map masks apply there.
            if (this.game.abilitySystem?.handleKeyDown(e.code)) {
                return
            }

            if (e.code === 'KeyC') {
                const modes = ['orbit', 'follow', 'action', 'fpv', 'topdown', 'cinematic', 'side-scroller', 'drone']
                const idx = modes.indexOf(this.game.cameraMode)
                this.game.cameraMode = modes[(idx + 1) % modes.length]
                console.log('Camera Mode:', this.game.cameraMode)
            }
        })

        window.addEventListener('keyup', (e) => {
            this.game.abilitySystem?.handleKeyUp(e.code)
            this.game.keys[e.code] = false
        })

        // The grapple's mouse binding is dispatched by InputSystem, which calls
        // startGrapple / stopGrapple; route those through the registry entry so
        // level ability masks can disable it.
        this.game.startGrappleRaw = this.game.startGrapple
        this.game.stopGrappleRaw = this.game.stopGrapple
        this.game.startGrapple = () => { this.game.abilitySystem?.pressAbility('grapple') }
        this.game.stopGrapple = () => { this.game.abilitySystem?.releaseAbility('grapple') }

        const initAudio = () => {
            audio.init()
            audio.resume()
        }
        window.addEventListener('click', initAudio, { once: true })
        window.addEventListener('keydown', initAudio, { once: true })

        this.game.muteBtn = document.getElementById('mute-btn')
        if (this.game.muteBtn) {
            this.game.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                audio.init()
                const muted = audio.toggleMute()
                this.game.muteBtn.textContent = muted ? '🔇' : '🔊'
                this.game.muteBtn.classList.toggle('muted', muted)
            })
        }

        this.game.initMouseControls()
        this.game.initTouchControls()

        console.log('[INIT] Initializing Rapier physics...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(5, 'Initializing physics engine...')
        }
        await RAPIER.init()
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(15, 'Physics engine ready')
        }
        const gravity = { x: 0.0, y: -9.81, z: 0.0 }
        this.game.physicsWorld.init(gravity)
        this.game.physicsGravity = gravity
        this.game.mainPhysicsBackend = null
        this.game.workerPhysicsBackend = null
        await createPhysicsBackend(this.game, {
            gravity,
            editorMode: isEditorMode(),
        })
        console.log(`[INIT] Physics initialized (rapier: ${this.game.physicsBackend?.getMode?.() || 'main'})`)
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(20, 'Physics initialized')
        }

        // Kick off WASM physics module load in the background (non-blocking).
        // The bridge transparently falls back to JS if the binary is absent.
        initMarblePhysicsWasm().then(ok => {
            console.log(`[INIT] MarblePhysics WASM ${ok ? 'active' : 'using JS fallbacks'}`)
        })

        // WebGL options are resolved first so the WebGPU adapter asks for the
        // same GPU (powerPreference) as the Filament context on this page.
        const glOptions = resolveWebGLContextOptions({
            quality: resolveGraphicsQualityForInit(),
        })

        // WebGPU boot probe — the session's one requestAdapter()/requestDevice()
        // call, made before Filament loads. WebGPU only drives the compute
        // overlay (particles, gpu-chores); Filament renders on WebGL2 either
        // way, so a failed probe is an intentional, recorded fallback — not a
        // hard stop. See docs/WEBGPU_BOOT_PROBE.md.
        console.log('[INIT] Running WebGPU boot probe...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(22, 'Checking WebGPU support...')
        }
        const webgpuProbeResult = await runWebGPUBootProbe({
            powerPreference: toWebGPUPowerPreference(glOptions.powerPreference),
        })
        const webgpuFallbackReason = webgpuProbeResult.ok
            ? ''
            : `WebGPU unavailable (${webgpuProbeResult.error}); WebGL2 only, GPU compute on CPU`
        if (webgpuProbeResult.ok) {
            console.log('[INIT] WebGPU boot probe passed:', window.webgpuProbe)
        } else {
            console.warn(`[INIT] ${webgpuFallbackReason}`, window.webgpuProbe)
        }

        const rendererRequest = getRequestedRendererMode()
        this.game.rendererType = rendererRequest.type
        this.game.rendererFallbackReason = webgpuFallbackReason
        setRuntimeRendererGlobals(this.game.rendererType, this.game.rendererFallbackReason)

        console.log(`[INIT] Initializing ${rendererRequest.type === 'simple-webgl' ? 'Simple WebGL2 debug' : 'Filament'} rendering...`)
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(25, rendererRequest.type === 'simple-webgl'
                ? 'Creating simple WebGL2 debug renderer...'
                : 'Loading Filament rendering engine...')
        }

        const { cssWidth, cssHeight, bufferWidth, bufferHeight, scale } = getRenderDimensions(this.game.settings)
        const width = bufferWidth
        const height = bufferHeight
        this.game.canvas.style.width = cssWidth + 'px'
        this.game.canvas.style.height = cssHeight + 'px'
        this.game.canvas.width = width
        this.game.canvas.height = height
        console.log(`[INIT] Canvas sized to ${width}x${height} (css ${cssWidth}x${cssHeight}, renderScale ${scale})`)

        if (rendererRequest.type === 'simple-webgl') {
            installSimpleDebugBackend(this.game, webgpuFallbackReason)
            console.log('[INIT] Simple WebGL2 debug renderer ready')
        } else {
            try {
                this.game.Filament = await loadFilament()
            } catch (filamentError) {
                const message = filamentError?.message || 'Unknown error'
                console.error('[INIT] Filament failed to load, falling back to simple renderer:', filamentError)
                installSimpleDebugBackend(this.game, `Filament load failed: ${message}`)
            }

            if (this.game.rendererType !== 'simple-webgl') {
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress(45, 'Filament rendering ready')
                }
                console.log('[INIT] Filament loaded')
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress(50, 'Creating rendering engine...')
                }

                try {
                    this.game.webglContextOptions = glOptions
                    console.log('[INIT] WebGL context options:', glOptions)
                    this.game.engine = this.game.Filament.Engine.create(this.game.canvas, glOptions)
                    this.game.scene = this.game.engine.createScene()
                    this.game.swapChain = this.game.engine.createSwapChain()
                    this.game.renderer = this.game.engine.createRenderer()
                    this.game.rendererType = 'filament'
                    this.game.rendererModeLabel = 'Filament'
                    setRuntimeRendererGlobals('filament', webgpuFallbackReason)
                } catch (engineError) {
                    const message = engineError?.message || 'Unknown rendering error'
                    console.error('[INIT] Failed to create Filament engine, falling back to simple renderer:', engineError)
                    installSimpleDebugBackend(this.game, `Filament engine failed: ${message}`)
                }
            }
        }

        if (this.game.rendererType !== 'simple-webgl') {
            console.log('[INIT] Filament engine created')

            const cameraEntity = this.game.Filament.EntityManager.get().create()
            this.game.camera = this.game.engine.createCamera(cameraEntity)
            this.game.view = this.game.engine.createView()
            this.game.view.setCamera(this.game.camera)
            this.game.view.setScene(this.game.scene)
            this.game.view.setViewport([0, 0, width, height])

            const CameraFov = this.game.Filament?.['Camera$Fov']
            const aspect = width / height
            const fovMode = CameraFov ? CameraFov.VERTICAL : 0
            this.game.camera.setProjectionFov(this.game.currentFov, aspect, 0.1, 1000.0, fovMode)
            this.game.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])

            this.game.renderer.setClearOptions({ clearColor: [0.1, 0.1, 0.1, 1.0], clear: true })

            // Dynamic resolution: let the GPU lower the internal render target
            // when it can't hit framerate, then scale back up when it can.
            applyDynamicResolution(this.game.view, this.game.Filament, this.game.settings?.graphics?.dynamicResolution)
        }
        installRendererModeControls(this.game.rendererType)
        console.log(`[INIT] Camera and view configured (${this.game.rendererModeLabel || this.game.rendererType})`)

        console.log('[INIT] Loading assets...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(55, 'Loading materials and assets...')
        }
        await this.game.setupAssets()
        this.game.effectPool?.prewarm()
        console.log('[INIT] Assets loaded')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(70, 'Assets loaded')
        }

        if (this.game.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.game.settings?.graphics?.quality || 'high'
                this.game.particleSystem = new ParticleSystem(this.game.engine, this.game.scene, this.game.Filament, qualityTier)
                this.game.particleSystem._game = this.game
                scheduleWebGPUExperiments(this.game)
                console.log('[INIT] Particle system initialized')
            } catch (e) {
                console.error('[INIT] Particle system initialization failed:', e)
                this.game.particleSystem = null
            }
        } else {
            this.game.particleSystem = null
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(75, 'Creating lights...')
        }
        this.game.createLight()
        console.log('[INIT] Lights created')
        
        if (this.game.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.game.settings?.graphics?.quality || 'high'
                this.game.lightingSystem = new LightingSystem(this.game.engine, this.game.scene, this.game.Filament)
                this.game.lightingSystem.registerLights(this.game.sunLight, this.game.fillLight, this.game.backLight)
                this.game.lightingSystem.setQuality(qualityTier)
                this.game.lightingSystem.isLightActive = (entity) => this.game.lightingBudget?.isBudgetActive(entity) ?? true
                this.game.lightingSystem.isAnimateAllowed = (entity) => this.game.lightingBudget?.isAnimateAllowed(entity) ?? true
                console.log('[INIT] Lighting system initialized')
            } catch (e) {
                console.error('[INIT] Lighting system initialization failed:', e)
                this.game.lightingSystem = null
            }
        } else {
            this.game.lightingSystem = null
        }

        // Initialize volumetric light shaft system
        if (this.game.rendererType !== 'simple-webgl') {
            try {
                const qualityTier = this.game.settings?.graphics?.quality || 'high'
                this.game.volumetricLights = new VolumetricLightsSystem(qualityTier)
                console.log('[INIT] Volumetric lights system initialized')
            } catch (e) {
                console.error('[INIT] Volumetric lights initialization failed (non-fatal):', e)
                this.game.volumetricLights = null
            }
        } else {
            this.game.volumetricLights = null
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(85, 'Setting up post-processing...')
        }
        if (this.game.rendererType !== 'simple-webgl') {
            try {
                this.game.setupPostProcessing()
                console.log('[INIT] Post-processing enabled')
            } catch (e) {
                console.error('[INIT] Post-processing setup failed (non-fatal):', e)
            }
        } else {
            console.log('[INIT] Post-processing skipped for simple debug renderer')
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(95, 'Loading game assets...')
        }

        try {
            const assetRegistry = this.game.levelLoader.assetRegistry
            await assetRegistry.loadAll()
            initLevelCatalog(assetRegistry)
            await loadDevLevels()
            mergeRegistryMarbles(assetRegistry)
            if (audio?.loadFromRegistry) {
                await audio.loadFromRegistry(assetRegistry)
            }
            if (this.game.campaignProgress) {
                this.game.campaignProgress.setCatalog(LEVELS)
            }
            if (this.game.cloudClient?.enabled) {
                void this.game.cloudClient.pullAndMergeCampaign()
            }
            console.log('[INIT] Asset registry loaded')
        } catch (assetError) {
            console.error('[INIT] Asset registry failed:', assetError)
            this.game._showInitError('Failed to load game assets. Check assets/manifest.json.')
            return
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(96, 'Preparing level menu...')
        }
        
        // Initialize pause menu handlers (once only)
        this.game.initPauseMenu()
        this.game.initMultiplayerMenu()
        console.log('[INIT] Pause menu initialized')
        
        if (isEditorMode()) {
            console.log('[INIT] Editor mode — launching map editor')
            // Lazy chunk: the editor (and its ajv validator) never ships in normal play.
            const { bootMapEditor } = await import('../editor/index.js')
            await bootMapEditor(this.game)
        } else {
            this.game.showLevelSelection()
            console.log('[INIT] Level menu displayed')
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(100, 'Ready!')
        }

        window.__FILAMENT_FULLY_READY__ = true;

        this.game.resize()
        window.addEventListener('resize', () => this.game.resize())

        this.game.loadSettings()
        console.log('[INIT] Settings loaded')

        // Initialize speed lines effect
        this.game.initSpeedLines()
        console.log('[INIT] Speed lines initialized')

        console.log('[INIT] Starting game loop')
        this.game.loop()
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

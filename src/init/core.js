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

            if (e.code === 'Tab') {
                e.preventDefault()
                if (this.marbles.length > 0) {
                    if (this.playerMarble && this.flipActive) {
                        this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
                        this.flipActive = false
                    }
                    // Cycle among player-controllable marbles; level rivals aren't selectable.
                    let next = this.currentMarbleIndex
                    for (let i = 0; i < this.marbles.length; i++) {
                        next = (next + 1) % this.marbles.length
                        if (!this.marbles[next].isRival) break
                    }
                    this.currentMarbleIndex = next
                    this.playerMarble = this.marbles[this.currentMarbleIndex]
                    this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
                    console.log(`[GAME] Switched to marble ${this.currentMarbleIndex}: ${this.playerMarble.name}`)
                    this.updateActiveMarbleLight()
                }
            }
            this.keys[e.code] = true

            // Every ability key (press / hold / charge) is a registry entry
            // (src/abilities/registry.js); map masks apply there.
            if (this.abilitySystem?.handleKeyDown(e.code)) {
                return
            }

            if (e.code === 'KeyC') {
                const modes = ['orbit', 'follow', 'action', 'fpv', 'topdown', 'cinematic', 'side-scroller', 'drone']
                const idx = modes.indexOf(this.cameraMode)
                this.cameraMode = modes[(idx + 1) % modes.length]
                console.log('Camera Mode:', this.cameraMode)
            }
        })

        window.addEventListener('keyup', (e) => {
            this.abilitySystem?.handleKeyUp(e.code)
            this.keys[e.code] = false
        })

        // The grapple's mouse binding is dispatched by InputSystem, which calls
        // startGrapple / stopGrapple; route those through the registry entry so
        // level ability masks can disable it.
        this.startGrappleRaw = this.startGrapple
        this.stopGrappleRaw = this.stopGrapple
        this.startGrapple = () => { this.abilitySystem?.pressAbility('grapple') }
        this.stopGrapple = () => { this.abilitySystem?.releaseAbility('grapple') }

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
        this.initTouchControls()

        console.log('[INIT] Initializing Rapier physics...')
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(5, 'Initializing physics engine...')
        }
        await RAPIER.init()
        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(15, 'Physics engine ready')
        }
        const gravity = { x: 0.0, y: -9.81, z: 0.0 }
        this.physicsWorld.init(gravity)
        this.physicsGravity = gravity
        this.mainPhysicsBackend = null
        this.workerPhysicsBackend = null
        await createPhysicsBackend(this, {
            gravity,
            editorMode: isEditorMode(),
        })
        console.log(`[INIT] Physics initialized (rapier: ${this.physicsBackend?.getMode?.() || 'main'})`)
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
        this.rendererType = rendererRequest.type
        this.rendererFallbackReason = webgpuFallbackReason
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
            installSimpleDebugBackend(this, webgpuFallbackReason)
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
                    this.webglContextOptions = glOptions
                    console.log('[INIT] WebGL context options:', glOptions)
                    this.engine = this.Filament.Engine.create(this.canvas, glOptions)
                    this.scene = this.engine.createScene()
                    this.swapChain = this.engine.createSwapChain()
                    this.renderer = this.engine.createRenderer()
                    this.rendererType = 'filament'
                    this.rendererModeLabel = 'Filament'
                    setRuntimeRendererGlobals('filament', webgpuFallbackReason)
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
                scheduleWebGPUExperiments(this)
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
            window.updateLoadingProgress(95, 'Loading game assets...')
        }

        try {
            const assetRegistry = this.levelLoader.assetRegistry
            await assetRegistry.loadAll()
            initLevelCatalog(assetRegistry)
            await loadDevLevels()
            mergeRegistryMarbles(assetRegistry)
            if (audio?.loadFromRegistry) {
                await audio.loadFromRegistry(assetRegistry)
            }
            if (this.campaignProgress) {
                this.campaignProgress.setCatalog(LEVELS)
            }
            if (this.cloudClient?.enabled) {
                void this.cloudClient.pullAndMergeCampaign()
            }
            console.log('[INIT] Asset registry loaded')
        } catch (assetError) {
            console.error('[INIT] Asset registry failed:', assetError)
            this._showInitError('Failed to load game assets. Check assets/manifest.json.')
            return
        }

        if (typeof window.updateLoadingProgress === 'function') {
            window.updateLoadingProgress(96, 'Preparing level menu...')
        }
        
        // Initialize pause menu handlers (once only)
        this.initPauseMenu()
        this.initMultiplayerMenu()
        console.log('[INIT] Pause menu initialized')
        
        if (isEditorMode()) {
            console.log('[INIT] Editor mode — launching map editor')
            // Lazy chunk: the editor (and its ajv validator) never ships in normal play.
            const { bootMapEditor } = await import('../editor/index.js')
            await bootMapEditor(this)
        } else {
            this.showLevelSelection()
            console.log('[INIT] Level menu displayed')
        }

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

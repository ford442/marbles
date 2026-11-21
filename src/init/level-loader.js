// @ts-check
import { getLevel } from '../levels/catalog.js';
import { preloadZoneModules } from '../zone-setup/registry.js';
import { runWebGPUStressBurst } from '../webgpu/index.js';
import { audio } from '../audio.js';
import { loadLevelBehaviors } from '../game/level-behaviors/index.js';
import { activatePhysicsBackendForLevel } from '../game/systems/physics-backend.ts';
import { requireElement } from '../ui/dom.ts';

/** @typedef {import('../types/engine-context.ts').EngineContext} EngineContext */
/** @typedef {import('../types/frame-host.ts').FrameState} FrameState */
/** @typedef {import('../types/frame-host.ts').FrameExtras} FrameExtras */
/** @typedef {import('../game/systems/level-loader.ts').LevelLoader} LevelLoader */
/** @typedef {import('../game/systems/level-loader.ts').LevelStartOptions} LevelStartOptions */
/** @typedef {import('../game/systems/physics-backend.ts').PhysicsBackendHost} PhysicsBackendHost */
/** @typedef {import('../game/systems/input-system.ts').InputSystemHost} InputSystemHost */
/** @typedef {import('../game-logic/level-complete.ts').GameLogicLevelCompleteScratch} GameLogicLevelCompleteScratch */
/** @typedef {import('../zone-setup/core.ts').ZoneSetupCore} ZoneSetupCore */
/** @typedef {import('../zone-setup/environment.ts').ZoneSetupEnvironment} ZoneSetupEnvironment */
/** @typedef {import('../zones/methods/visuals.ts').ZoneVisuals} ZoneVisuals */
/** @typedef {import('./level-menu.ts').InitLevelMenu} InitLevelMenu */
/** @typedef {import('./multiplayer-menu.ts').MultiplayerContext} MultiplayerContext */
/** @typedef {import('./touch-init.ts').TouchControlsContext} TouchControlsContext */

/**
 * What `InitLevelLoader` uses on the game, plus the hosts of the physics
 * backend, level behaviors and WebGPU stress burst it hands the game to.
 * @typedef {GameLogicLevelCompleteScratch
 *     & Pick<EngineContext,
 *         | 'Filament' | 'engine' | 'scene' | 'material' | 'vb' | 'ib' | 'sphereVb' | 'sphereIb'
 *         | 'cullingManager' | 'trackLodManager' | 'marbleLodManager' | 'effectPool' | 'levelEffectBudget'
 *         | 'perfMonitor' | 'cloudClient'>
 *     & Pick<FrameState,
 *         | 'currentLevel' | 'movementModel' | 'goalDefinitions' | 'checkpointDefinitions' | 'score' | 'combo' | 'comboTimer'
 *         | 'levelComplete' | 'levelStartTime' | 'cameraMode' | 'camAngle' | 'camHeight' | 'camRadius'
 *         | 'staticEntities' | 'marbles' | 'ghostEntity' | 'ghostMaterialInstance' | 'ghostLightEntity'
 *         | 'levelNameEl' | 'scoreEl' | 'comboEl' | 'combobarContainerEl' | 'combobarEl' | 'timerEl'>
 *     & Pick<FrameExtras, 'abilitySystem' | 'ghostReplay' | 'collectiblesCollected'>
 *     & Pick<InputSystemHost, 'isPaused'>
 *     & { levelLoader: Pick<LevelLoader, 'getLevel' | 'physicsWorld' | 'marbleRegistry'> }
 *     & Pick<LevelLoader, 'clearLevel'>
 *     & Pick<ZoneSetupCore, 'createZone'>
 *     & Pick<ZoneSetupEnvironment, 'applyColorGradingForEnvironment'>
 *     & Pick<ZoneVisuals, 'setNightMode' | 'setEnvironment'>
 *     & Pick<InitLevelMenu, 'transitionCameraToGameplay'>
 *     & Partial<Pick<MultiplayerContext, 'network'>>
 *     & TouchControlsContext
 *     & PhysicsBackendHost
 *     & Parameters<typeof loadLevelBehaviors>[0]
 *     & Parameters<typeof runWebGPUStressBurst>[0]
 * } InitLevelLoaderHost
 */

/** Level load + entry sequence (`LevelRuntime`); `LevelLoader` delegates here. */
export class InitLevelLoader {
    /** @param {InitLevelLoaderHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {string} levelId
     * @param {LevelStartOptions} [options]
     * @returns {Promise<false | undefined>} `false` when called before boot finished.
     */
    async loadLevel(levelId, options = {}) {
        if (!window.__FILAMENT_FULLY_READY__ || !this.game.engine || !this.game.vb || !this.game.ib) {
            console.error('loadLevel called too early');
            return false;
        }

        console.log(`[LEVEL] Loading level: ${levelId}`)
        const level = this.game.levelLoader.getLevel(levelId)
        if (!level) {
            console.error(`[LEVEL] Level ${levelId} not found!`)
            return undefined
        }

        this.game.clearLevel()
        console.log('[LEVEL] Cleared previous level')
        const rapierMode = await activatePhysicsBackendForLevel(this.game, levelId)
        console.log(`[LEVEL] Physics backend: ${rapierMode}`)
        this.game.perfMonitor?.resetLevel(levelId)
        this.game.cullingManager?.reset()
        this.game.trackLodManager?.reset()
        this.game.marbleLodManager?.reset()
        this.game.effectPool?.reset()
        this.game.levelEffectBudget?.reset()

        this.game.ghostReplay?.beginRecording()
        this.game.ghostReplay?.resetPlayback()

        this.game.currentLevel = levelId
        this.game.movementModel = level.movementModel ?? null
        if (this.game.levelNameEl) this.game.levelNameEl.textContent = level.name
        this.game.goalDefinitions = level.goals
        this.game.checkpointDefinitions = level.checkpoints || []
        this.game.abilitySystem?.applyLevelMask(level.abilities)
        this.game.score = 0
        if (this.game.scoreEl) this.game.scoreEl.textContent = 'Score: 0'
        this.game.combo = 1
        this.game.comboTimer = 0
        if (this.game.comboEl) {
            this.game.comboEl.style.display = 'none'
            this.game.comboEl.textContent = 'Combo: x1'
        }
        if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'none'
        if (this.game.combobarEl) this.game.combobarEl.style.width = '0%'

        if (this.game.timerEl) this.game.timerEl.textContent = 'Time: 0.00s'
        this.game.levelComplete = false
        this.game.collectiblesCollected = 0

        if (level.nightMode) {
            this.game.setNightMode(true, level.backgroundColor)
        } else {
            this.game.setNightMode(false)
        }

        // Apply per-level environment (overrides the nightMode default).
        // Must be called *after* setNightMode() so the explicit env wins.
        if (level.environment) {
            this.game.setEnvironment(level.environment)
        }

        audio?.setChapterMusic?.(level.chapter || level.environment)

        // Apply per-level color grade override when it differs from the IBL environment.
        // e.g. a level can use 'volcanic' IBL but request 'space_nebula' grading for a surreal twist.
        if (level.colorGrade && level.colorGrade !== level.environment) {
            this.game.applyColorGradingForEnvironment(level.colorGrade)
        }

        if (level.camera) {
            this.game.cameraMode = level.camera.mode || 'orbit'
            this.game.camAngle = level.camera.angle || 0
            this.game.camHeight = level.camera.height || 10
            this.game.camRadius = level.camera.radius || 25
        }

        console.log(`[LEVEL] Creating ${level.zones.length} zones...`)
        // Fetch the lazy zone chunks this level references in parallel, then build in order.
        await preloadZoneModules(level.zones)
        for (const zone of level.zones) {
            await this.game.createZone(zone)
        }
        loadLevelBehaviors(this.game, level.behaviors || [], { level, levelId })
        this.game.levelLoader.physicsWorld.flushStaticBatches?.()
        console.log(`[LEVEL] Created ${this.game.staticEntities.length} static entities`)

        console.log(`[LEVEL] Spawning marbles at ${JSON.stringify(level.spawn)}...`)
        this.game.levelLoader.marbleRegistry.createMarbles(level.spawn)
        if (this.game.physicsBackend?.isWorkerMode?.()) {
            await this.game.physicsBackend.commitWorldBuild()
        }
        this.game.effectPool?.recordLevelBaseline()
        console.log(`[LEVEL] Created ${this.game.marbles.length} marbles`)

        if (this.game.ghostReplay?.loadPlayback(levelId)) {
            this.createGhostMarble()
        }

        if (this.game._pendingLeaderboardGhostId && this.game.cloudClient) {
            const ghostId = this.game._pendingLeaderboardGhostId
            this.game._pendingLeaderboardGhostId = null
            const loaded = await this.game.cloudClient.loadLeaderboardGhost(ghostId, levelId)
            if (loaded && this.game.ghostReplay?.playbackFrames?.length) {
                this.createGhostMarble()
            }
        }

        this.game.perfMonitor?.recordLevelLoad(levelId, level)

        console.log('[LEVEL] Level loading complete!')

        runWebGPUStressBurst(this.game)

        // Start the level entry sequence
        await this.startLevelSequence(options)
        return undefined
    }

    /**
     * @param {LevelStartOptions} [options]
     * @returns {Promise<void>}
     */
    async startLevelSequence(options = {}) {
        const { startAtMs, seed } = options;
        if (seed !== undefined && this.game.network) {
            this.game.network.raceSeed = seed;
        }
        const gameUI = requireElement('ui')
        const fadeOverlay = requireElement('fade-overlay')
        const countdownOverlay = requireElement('countdown-overlay')
        const countdownDisplay = requireElement('countdown-display')

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

        if (startAtMs) {
            this.game.isPaused = true;
            const steps = [
                { at: startAtMs - 2400, text: '3', className: 'countdown-number' },
                { at: startAtMs - 1600, text: '2', className: 'countdown-number' },
                { at: startAtMs - 800, text: '1', className: 'countdown-number' },
                { at: startAtMs, text: 'GO!', className: 'countdown-go' },
            ];

            for (const step of steps) {
                await this._waitUntil(step.at);
                countdownDisplay.className = step.className;
                countdownDisplay.textContent = step.text;
                void countdownDisplay.offsetWidth;
                countdownDisplay.className = step.className;
            }

            this.game.levelStartTime = startAtMs;
            this.game.isPaused = false;
        } else {
            const numbers = ['3', '2', '1'];
            for (const num of numbers) {
                countdownDisplay.className = 'countdown-number';
                countdownDisplay.textContent = num;
                void countdownDisplay.offsetWidth;
                countdownDisplay.className = 'countdown-number';
                await this.delay(800);
            }

            countdownDisplay.className = 'countdown-go';
            countdownDisplay.textContent = 'GO!';
            this.game.levelStartTime = Date.now();
            this.game.isPaused = false;
        }

        this.game.touchControls?.setGameplayActive(true);

        // Animate HUD elements in
        gameUI.style.opacity = '1'
        this.animateHUDIn()

        // Hide countdown after GO
        await this.delay(600)
        countdownOverlay.classList.remove('active')

        // Transition camera smoothly
        await this.game.transitionCameraToGameplay(1000)
    }

    /** @returns {void} */
    animateHUDIn() {
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

    /**
     * @param {number} ms
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * @param {number} targetMs epoch ms
     * @returns {Promise<void>}
     */
    _waitUntil(targetMs) {
        const delayMs = targetMs - Date.now();
        if (delayMs <= 0) return Promise.resolve();
        return this.delay(delayMs);
    }

    /** @returns {void} */
    createGhostMarble() {
        this.game.ghostEntity = this.game.Filament.EntityManager.get().create()
        const ghostMaterialInstance = this.game.material.createInstance()
        this.game.ghostMaterialInstance = ghostMaterialInstance
        ghostMaterialInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
        ghostMaterialInstance.setFloatParameter('roughness', 0.2)

        // Ghost is slightly larger/smaller or translucent, but we use existing material limits
        // We render it similarly to a regular marble
        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, ghostMaterialInstance)
            .geometry(0, this.game.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.game.sphereVb, this.game.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.game.engine, this.game.ghostEntity)

        this.game.scene.addEntity(this.game.ghostEntity)

        this.game.ghostLightEntity = this.game.Filament.EntityManager.get().create()
        this.game.Filament.LightManager.Builder(this.game.Filament.LightManager$Type.POINT)
            .color([0.0, 1.0, 1.0])
            .intensity(15000.0)
            .falloff(15.0)
            .build(this.game.engine, this.game.ghostLightEntity)

        this.game.scene.addEntity(this.game.ghostLightEntity)

        console.log('[GAME] Spawned Speedrun Ghost')
    }
}

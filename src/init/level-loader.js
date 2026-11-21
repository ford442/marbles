import { getLevel } from '../levels/catalog.js';
import { preloadZoneModules } from '../zone-setup/registry.js';
import { runWebGPUStressBurst } from '../webgpu/index.js';
import { audio } from '../audio.js';
import { loadLevelBehaviors } from '../game/level-behaviors/index.js';
import { activatePhysicsBackendForLevel } from '../game/systems/physics-backend.ts';

export class InitLevelLoader {
    constructor(game) {
        this.game = game;
    }

    async loadLevel(levelId, options = {}) {
        if (!window.__FILAMENT_FULLY_READY__ || !this.game.engine || !this.game.vb || !this.game.ib) {
            console.error('loadLevel called too early');
            return false;
        }

        console.log(`[LEVEL] Loading level: ${levelId}`)
        const level = this.game.levelLoader.getLevel(levelId)
        if (!level) {
            console.error(`[LEVEL] Level ${levelId} not found!`)
            return
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
        this.game.levelNameEl.textContent = level.name
        this.game.goalDefinitions = level.goals
        this.game.checkpointDefinitions = level.checkpoints || []
        this.game.abilitySystem?.applyLevelMask(level.abilities)
        this.game.score = 0
        this.game.scoreEl.textContent = 'Score: 0'
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
            this.game.createGhostMarble()
        }

        if (this.game._pendingLeaderboardGhostId && this.game.cloudClient) {
            const ghostId = this.game._pendingLeaderboardGhostId
            this.game._pendingLeaderboardGhostId = null
            const loaded = await this.game.cloudClient.loadLeaderboardGhost(ghostId, levelId)
            if (loaded && this.game.ghostReplay?.playbackFrames?.length) {
                this.game.createGhostMarble()
            }
        }

        this.game.perfMonitor?.recordLevelLoad(levelId, level)

        console.log('[LEVEL] Level loading complete!')

        runWebGPUStressBurst(this.game)

        // Start the level entry sequence
        await this.game.startLevelSequence(options)
    }

    async startLevelSequence(options = {}) {
        const { startAtMs, seed } = options;
        if (seed !== undefined && this.game.network) {
            this.game.network.raceSeed = seed;
        }
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
        await this.game.delay(200)

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
                await this.game._waitUntil(step.at);
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
                await this.game.delay(800);
            }

            countdownDisplay.className = 'countdown-go';
            countdownDisplay.textContent = 'GO!';
            this.game.levelStartTime = Date.now();
            this.game.isPaused = false;
        }

        this.game.touchControls?.setGameplayActive(true);

        // Animate HUD elements in
        gameUI.style.opacity = '1'
        this.game.animateHUDIn()

        // Hide countdown after GO
        await this.game.delay(600)
        countdownOverlay.classList.remove('active')

        // Transition camera smoothly
        await this.game.transitionCameraToGameplay(1000)
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

    _waitUntil(targetMs) {
        const delayMs = targetMs - Date.now();
        if (delayMs <= 0) return Promise.resolve();
        return this.game.delay(delayMs);
    }

    createGhostMarble() {
        this.game.ghostEntity = this.game.Filament.EntityManager.get().create()
        this.game.ghostMaterialInstance = this.game.material.createInstance()
        this.game.ghostMaterialInstance.setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
        this.game.ghostMaterialInstance.setFloatParameter('roughness', 0.2)

        // Ghost is slightly larger/smaller or translucent, but we use existing material limits
        // We render it similarly to a regular marble
        this.game.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, this.game.ghostMaterialInstance)
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

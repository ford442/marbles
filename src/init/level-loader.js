import { getLevel } from '../levels/catalog.js';
import { runWebGPUStressBurst } from '../webgpu/index.js';
import { audio } from '../audio.js';
import { loadLevelBehaviors } from '../game/level-behaviors/index.js';

export class InitLevelLoader {
    async loadLevel(levelId, options = {}) {
        if (!window.__FILAMENT_FULLY_READY__ || !this.engine || !this.vb || !this.ib) {
            console.error('loadLevel called too early');
            return false;
        }

        console.log(`[LEVEL] Loading level: ${levelId}`)
        const level = getLevel(levelId)
        if (!level) {
            console.error(`[LEVEL] Level ${levelId} not found!`)
            return
        }

        this.clearLevel()
        console.log('[LEVEL] Cleared previous level')
        const rapierMode = await activatePhysicsBackendForLevel(this, levelId)
        console.log(`[LEVEL] Physics backend: ${rapierMode}`)
        this.perfMonitor?.resetLevel(levelId)
        this.cullingManager?.reset()
        this.trackLodManager?.reset()
        this.marbleLodManager?.reset()
        this.effectPool?.reset()
        this.levelEffectBudget?.reset()

        this.ghostReplay?.beginRecording()
        this.ghostReplay?.resetPlayback()

        this.currentLevel = levelId
        this.levelNameEl.textContent = level.name
        this.goalDefinitions = level.goals
        this.checkpointDefinitions = level.checkpoints || []
        this.abilitySystem?.applyLevelMask(level.abilities)
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
        this.collectiblesCollected = 0

        if (level.nightMode) {
            this.setNightMode(true, level.backgroundColor)
        } else {
            this.setNightMode(false)
        }

        // Apply per-level environment (overrides the nightMode default).
        // Must be called *after* setNightMode() so the explicit env wins.
        if (level.environment) {
            this.setEnvironment(level.environment)
        }

        audio?.setChapterMusic?.(level.chapter || level.environment)

        // Apply per-level color grade override when it differs from the IBL environment.
        // e.g. a level can use 'volcanic' IBL but request 'space_nebula' grading for a surreal twist.
        if (level.colorGrade && level.colorGrade !== level.environment) {
            this.applyColorGradingForEnvironment(level.colorGrade)
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
        loadLevelBehaviors(this, level.behaviors || [], { level, levelId })
        this.flushStaticBatches?.()
        console.log(`[LEVEL] Created ${this.staticEntities.length} static entities`)

        console.log(`[LEVEL] Spawning marbles at ${JSON.stringify(level.spawn)}...`)
        this.createMarbles(level.spawn)
        if (this.physicsBackend?.isWorkerMode?.()) {
            await this.physicsBackend.commitWorldBuild()
        }
        this.effectPool?.recordLevelBaseline()
        console.log(`[LEVEL] Created ${this.marbles.length} marbles`)

        if (this.ghostReplay?.loadPlayback(levelId)) {
            this.createGhostMarble()
        }

        if (this._pendingLeaderboardGhostId && this.cloudClient) {
            const ghostId = this._pendingLeaderboardGhostId
            this._pendingLeaderboardGhostId = null
            const loaded = await this.cloudClient.loadLeaderboardGhost(ghostId, levelId)
            if (loaded && this.ghostReplay?.playbackFrames?.length) {
                this.createGhostMarble()
            }
        }

        this.perfMonitor?.recordLevelLoad(levelId, level)

        console.log('[LEVEL] Level loading complete!')

        runWebGPUStressBurst(this)

        // Start the level entry sequence
        await this.startLevelSequence(options)
    }

    async startLevelSequence(options = {}) {
        const { startAtMs, seed } = options;
        if (seed !== undefined && this.network) {
            this.network.raceSeed = seed;
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
        await this.delay(200)

        // Fade out from black
        fadeOverlay.classList.add('fade-out')

        // Show countdown
        countdownOverlay.classList.add('active')

        if (startAtMs) {
            this.isPaused = true;
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

            this.levelStartTime = startAtMs;
            this.isPaused = false;
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
            this.levelStartTime = Date.now();
            this.isPaused = false;
        }

        this.touchControls?.setGameplayActive(true);

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

    _waitUntil(targetMs) {
        const delayMs = targetMs - Date.now();
        if (delayMs <= 0) return Promise.resolve();
        return this.delay(delayMs);
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
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.sphereVb, this.sphereIb)
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
}

export function applyInitLevelLoader(targetClass) {
    for (const name of Object.getOwnPropertyNames(InitLevelLoader.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = InitLevelLoader.prototype[name];
        }
    }
}

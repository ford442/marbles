import './styles/index.css';
import { mountShell } from './ui/mount-shell.js';

mountShell();

import { createGameState, bindGameState } from './game/state/index.js';
import { installZoneMethods } from './zones/methods/index.js';
import { installInitMethods } from './init/index.js';
import { installZoneSetupMethods } from './zone-setup/index.js';
import { installGameLogicMethods } from './game-logic/index.js';
import { installAbilityMethods } from './abilities/index.js';
import { installGameLoopMethods } from './game-loop/index.js';
import { PerfMonitor } from './perf-monitor.js';
import { CullingManager } from './culling-manager.js';
import { MarbleLodManager } from './marble-lod.js';
import { EffectPoolManager } from './effect-pool.js';
import { AutoQualityGovernor } from './auto-quality-governor.js';
import { LevelEffectBudget } from './level-effect-budget.js';
import { LightingBudgetManager } from './lighting-budget.js';
import { FixedStepClock } from './game/systems/fixed-step-clock.ts';
import { createRuntime } from './game/create-runtime.ts';
import { registerServiceWorker } from './pwa/register-sw.js';
import { initInstallPrompt } from './pwa/install-prompt.js';
import { importSharedWorkshopLevel } from './pwa/share-target.js';
import { applyLaunchShortcut } from './pwa/shortcuts.js';
import { CampaignProgress } from './game/systems/campaign-progress.ts';
import { GhostReplay } from './game/systems/ghost-replay.js';
import { CloudClient } from './game/network/cloud-client.ts';
import { TrackLodManager } from './assets/track-lod-manager.js';

/** Explicit prototype delegation — not the deprecated apply*Methods mixin copier. */
function delegateTo(subsystemKey, methodNames) {
    for (const name of methodNames) {
        MarblesGame.prototype[name] = function delegatedSubsystemMethod(...args) {
            return this[subsystemKey][name](...args);
        };
    }
}

const PHYSICS_WORLD_METHODS = [
    'isStaticBatchingEnabled',
    'resolveStaticSurfacePreset',
    'getStaticBatchKey',
    'createStaticMaterialInstance',
    'queueStaticBoxBatch',
    'getDecorativeBatchKey',
    'queueDecorativeBatch',
    'queueDecorativeBoxes',
    'flushDecorativeBatches',
    'createPhaseBox',
    'createStaticBox',
    'createDynamicBox',
    'createRotatingBox',
];

const INPUT_SYSTEM_METHODS = [
    'initMouseControls',
    'pollGamepads',
    'isGrounded',
    'getWallContact',
    'toggleTargetLockOn',
    'findBestLockOnTarget',
];

const MARBLE_REGISTRY_METHODS = [
    'createMarbles',
    'updateActiveMarbleLight',
    'getLeader',
    'respawnToLastCheckpoint',
    'resetMarbles',
    'returnToMenu',
    'processCollisionEvents',
    'resetPlayerAbilityState',
];

const LEVEL_LOADER_METHODS = [
    'loadLevel',
    'clearLevel',
    'startLevelSequence',
    'animateHUDIn',
    'delay',
    '_waitUntil',
    'createGhostMarble',
];

const RENDER_PIPELINE_METHODS = [
    'renderAndSync',
    'syncTransformsAndRender',
    'flushStaticBatches',
];

class MarblesGame {
    constructor() {
        bindGameState(this, createGameState());

        // Fixed-step simulation clock (see docs/architecture/game-loop.md).
        this.physicsClock = new FixedStepClock();

        // Phase B composed subsystems: physicsQueries, physicsWorld, inputSystem,
        // marbleRegistry, abilitySystem, renderPipeline, levelLoader and
        // hudController. Built (and installed on `this`) by a typed module so a
        // missing host field is a compile error; see game/create-runtime.ts.
        createRuntime(/** @type {import('./types/game-host.ts').GameHost} */ (/** @type {unknown} */ (this)));
        // Compatibility alias while call sites migrate to the composed owner.
        this.hudManager = this.hudController;
        this.campaignProgress = new CampaignProgress();
        this.ghostReplay = new GhostReplay();
        this.cloudClient = new CloudClient(this);
        this.perfMonitor = new PerfMonitor(this);
        this.autoQualityGovernor = new AutoQualityGovernor(this);
        this.levelEffectBudget = new LevelEffectBudget(this);
        this.lightingBudget = new LightingBudgetManager(this);
        this.cullingManager = new CullingManager(this);
        this.trackLodManager = new TrackLodManager(this);
        this.marbleLodManager = new MarbleLodManager(this);
        this.effectPool = new EffectPoolManager(this);
    }
}

delegateTo('physicsWorld', PHYSICS_WORLD_METHODS);
delegateTo('inputSystem', INPUT_SYSTEM_METHODS);
delegateTo('marbleRegistry', MARBLE_REGISTRY_METHODS);
delegateTo('levelLoader', LEVEL_LOADER_METHODS);
delegateTo('renderPipeline', RENDER_PIPELINE_METHODS);

/**
 * Closed compatibility wiring for legacy folders. Each installer owns an
 * explicit method list; first-class subsystems are delegated above.
 */
function installLegacyMethodGroups(targetClass) {
    installZoneMethods(targetClass);
    installInitMethods(targetClass);
    installZoneSetupMethods(targetClass);
    installGameLogicMethods(targetClass);
    installAbilityMethods(targetClass);
    installGameLoopMethods(targetClass);
}

installLegacyMethodGroups(MarblesGame);

registerServiceWorker();
initInstallPrompt();

window.game = new MarblesGame();
(async () => {
    await importSharedWorkshopLevel();
    await window.game.init();
    window.gameReady = true;
    applyLaunchShortcut(window.game);
})().catch(err => {
    console.error('[FATAL] Game initialization failed:', err)
    const loading = document.getElementById('loading')
    if (loading) {
        loading.classList.add('error')
        const textEl = loading.querySelector('.loading-text')
        if (textEl) textEl.textContent = '⚠️ Failed to Start'
    }
    if (typeof window.updateLoadingProgress === 'function') {
        window.updateLoadingProgress(0, 'Error: ' + (err?.message || 'Unknown error'))
    }
});

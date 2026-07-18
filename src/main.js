import './styles/index.css';
import { mountShell } from './ui/mount-shell.js';

mountShell();

import { createGameState, bindGameState } from './game/state/index.js';
import { applyZoneMethods } from './zones/methods/index.js';
import { loadFilament, applyInitMethods } from './init-methods.js';
import { applyZoneSetupMethods } from './zone-setup-methods.js';
import { applyGameLogicMethods } from './game-logic-methods.js';
import { applyAbilityMethods } from './ability-methods.js';
import { applyGameLoop } from './game-loop/index.js';
import { HUDManager } from './hud-manager.js';
import { PerfMonitor } from './perf-monitor.js';
import { CullingManager } from './culling-manager.js';
import { MarbleLodManager } from './marble-lod.js';
import { EffectPoolManager } from './effect-pool.js';
import { AutoQualityGovernor } from './auto-quality-governor.js';
import { LevelEffectBudget } from './level-effect-budget.js';
import { LightingBudgetManager } from './lighting-budget.js';
import { AbilitySystem } from './game/systems/ability-system.js';
import { PhysicsWorld } from './game/systems/physics-world.js';
import { InputSystem } from './game/systems/input-system.js';
import { MarbleRegistry } from './game/systems/marble-registry.js';
import { registerServiceWorker } from './pwa/register-sw.js';
import { CampaignProgress } from './game/systems/campaign-progress.js';
import { GhostReplay } from './game/systems/ghost-replay.js';
import { CloudClient } from './game/network/cloud-client.js';
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
    'flushStaticBatches',
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
];

class MarblesGame {
    constructor() {
        bindGameState(this, createGameState());

        // Phase B composed subsystems
        this.physicsWorld = new PhysicsWorld(this);
        this.inputSystem = new InputSystem(this);
        this.marbleRegistry = new MarbleRegistry(this);
        this.abilitySystem = new AbilitySystem(this);
        this.campaignProgress = new CampaignProgress();
        this.ghostReplay = new GhostReplay();
        this.cloudClient = new CloudClient(this);
        this.hudManager = new HUDManager(this);
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

/**
 * @deprecated Mixin assembly — migrate to composed subsystems (see docs/architecture/).
 * New methods belong in src/<concern>/ or src/game/systems/, not new *-methods.js files.
 */
function applyLegacyMixins(targetClass) {
    applyZoneMethods(targetClass);
    applyInitMethods(targetClass);
    applyZoneSetupMethods(targetClass);
    applyGameLogicMethods(targetClass);
    applyAbilityMethods(targetClass);
    applyGameLoop(targetClass);
}

applyLegacyMixins(MarblesGame);

registerServiceWorker();

window.game = new MarblesGame();
window.game.init().then(() => { window.gameReady = true; }).catch(err => {
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

// @ts-check
/** @typedef {import('./types/marbles-game-host.ts').MarblesGameHost} MarblesGameHost */
/** @template T @typedef {import('./game/systems/slice-composition.ts').MethodNames<T>} MethodNames */
import './styles/index.css';
import { mountShell } from './ui/mount-shell.ts';

mountShell();

import { createGameState, bindGameState } from './game/state/index.js';
import { ZONE_METHOD_SLICES } from './zones/methods/index.ts';
import { INIT_SLICES } from './init/index.ts';
import { ZONE_SETUP_SLICES } from './zone-setup/index.ts';
import { GAME_LOGIC_SLICES } from './game-logic/index.ts';
import { ABILITY_SLICES } from './abilities/index.ts';
import { GAME_LOOP_SLICES } from './game-loop/index.ts';
import { composeSlices, forwardMethods, forwardSliceMethods } from './game/systems/slice-composition.ts';
import { PerfMonitor } from './perf-monitor.js';
import { CullingManager } from './culling-manager.js';
import { MarbleLodManager } from './marble-lod.js';
import { EffectPoolManager } from './effect-pool.ts';
import { AutoQualityGovernor } from './auto-quality-governor.js';
import { LevelEffectBudget } from './level-effect-budget.js';
import { LightingBudgetManager } from './lighting-budget.ts';
import { FixedStepClock } from './game/systems/fixed-step-clock.ts';
import { createRuntime } from './game/create-runtime.ts';
import { registerServiceWorker } from './pwa/register-sw.ts';
import { initInstallPrompt } from './pwa/install-prompt.js';
import { importSharedWorkshopLevel } from './pwa/share-target.ts';
import { applyLaunchShortcut } from './pwa/shortcuts.ts';
import { CampaignProgress } from './game/systems/campaign-progress.ts';
import { GhostReplay } from './game/systems/ghost-replay.ts';
import { CloudClient } from './game/network/cloud-client.ts';
import { TrackLodManager } from './assets/track-lod-manager.js';

/** @type {readonly MethodNames<import('./game/systems/physics-world.ts').PhysicsWorld>[]} */
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

/** @type {readonly MethodNames<import('./game/systems/input-system.ts').InputSystem>[]} */
const INPUT_SYSTEM_METHODS = [
    'initMouseControls',
    'pollGamepads',
    'isGrounded',
    'getWallContact',
    'toggleTargetLockOn',
    'findBestLockOnTarget',
];

/** @type {readonly MethodNames<import('./game/systems/marble-registry.js').MarbleRegistry>[]} */
const MARBLE_REGISTRY_METHODS = [
    'createMarbles',
    'updateActiveMarbleLight',
    'getLeader',
    'respawnToLastCheckpoint',
    'resetMarbles',
    'processCollisionEvents',
    'resetPlayerAbilityState',
];

/** @type {readonly MethodNames<import('./game/systems/level-loader.ts').LevelLoader>[]} */
const LEVEL_LOADER_METHODS = [
    'loadLevel',
    'clearLevel',
    'startLevelSequence',
    'animateHUDIn',
    'delay',
    '_waitUntil',
    'createGhostMarble',
];

/** @type {readonly MethodNames<import('./game/systems/render-pipeline.ts').RenderPipeline>[]} */
const RENDER_PIPELINE_METHODS = [
    'renderAndSync',
    'syncTransformsAndRender',
    'flushStaticBatches',
];

/**
 * Feature slices composed onto the game (each one a class holding the game as
 * `this.game`); see game/systems/slice-composition.ts.
 * @type {import('./game/systems/slice-composition.ts').SliceSpec<MarblesGameHost>[]}
 */
const GAME_SLICES = [
    ...ZONE_METHOD_SLICES,
    ...INIT_SLICES,
    ...ZONE_SETUP_SLICES,
    ...GAME_LOGIC_SLICES,
    ...ABILITY_SLICES,
    ...GAME_LOOP_SLICES,
];

/**
 * Build the game object in place: state slices, feature slices, composed
 * systems and services, each constructed against the typed `MarblesGameHost`
 * contract the object fulfils once this returns.
 * @param {MarblesGameHost} host
 */
function buildGame(host) {
    bindGameState(host, createGameState());
    composeSlices(host, GAME_SLICES);

    // Fixed-step simulation clock (see docs/architecture/game-loop.md).
    host.physicsClock = new FixedStepClock();

    // Phase B composed subsystems: physicsQueries, physicsWorld, inputSystem,
    // marbleRegistry, abilitySystem, renderPipeline, levelLoader and
    // hudController. Built (and installed on the game) by a typed module so a
    // missing host field is a compile error; see game/create-runtime.ts.
    createRuntime(host);
    // Compatibility alias while call sites migrate to the composed owner.
    host.hudManager = host.hudController;
    host.campaignProgress = new CampaignProgress();
    host.ghostReplay = new GhostReplay();
    host.cloudClient = new CloudClient(host);
    host.perfMonitor = new PerfMonitor(host);
    host.autoQualityGovernor = new AutoQualityGovernor(host);
    host.levelEffectBudget = new LevelEffectBudget(host);
    host.lightingBudget = new LightingBudgetManager(host);
    host.cullingManager = new CullingManager(host);
    host.trackLodManager = new TrackLodManager(host);
    host.marbleLodManager = new MarbleLodManager(host);
    host.effectPool = new EffectPoolManager(host);
}

class MarblesGame {
    constructor() {
        buildGame(/** @type {MarblesGameHost} */ (/** @type {unknown} */ (this)));
    }
}

// Explicit forwarding to composed owners: each name is forwarded exactly once.
forwardMethods(MarblesGame, 'physicsWorld', PHYSICS_WORLD_METHODS);
forwardMethods(MarblesGame, 'inputSystem', INPUT_SYSTEM_METHODS);
forwardMethods(MarblesGame, 'marbleRegistry', MARBLE_REGISTRY_METHODS);
forwardMethods(MarblesGame, 'levelLoader', LEVEL_LOADER_METHODS);
forwardMethods(MarblesGame, 'renderPipeline', RENDER_PIPELINE_METHODS);
forwardSliceMethods(MarblesGame, GAME_SLICES);

registerServiceWorker();
initInstallPrompt();

const game = /** @type {MarblesGameHost} */ (/** @type {unknown} */ (new MarblesGame()));
window.game = game;
(async () => {
    await importSharedWorkshopLevel();
    await game.init();
    window.gameReady = true;
    applyLaunchShortcut(game);
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

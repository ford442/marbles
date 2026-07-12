import { createGameState, bindGameState } from './game/state/index.js';
import { applyZoneMethods } from './zones/methods/index.js';
import { applyInputMethods } from './input-methods.js';
import { loadFilament, applyInitMethods } from './init-methods.js';
import { applyZoneSetupMethods } from './zone-setup-methods.js';
import { applyPhysicsFactoryMethods } from './physics-factory-methods.js';
import { applyMarbleManagementMethods } from './marble-management-methods.js';
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
import { registerServiceWorker } from './pwa/register-sw.js';
import { GhostReplay } from './game/systems/ghost-replay.js';
import { TrackLodManager } from './assets/track-lod-manager.js';

class MarblesGame {
    constructor() {
        bindGameState(this, createGameState());

        // Runtime managers (Phase B: move under composed subsystems)
        this.abilitySystem = new AbilitySystem(this);
        this.campaignProgress = new CampaignProgress();
        this.ghostReplay = new GhostReplay();
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

/**
 * @deprecated Mixin assembly — migrate to composed subsystems (see docs/architecture/).
 * New methods belong in src/<concern>/ or src/game/systems/, not new *-methods.js files.
 */
function applyLegacyMixins(targetClass) {
    applyZoneMethods(targetClass);
    applyInputMethods(targetClass);
    applyInitMethods(targetClass);
    applyZoneSetupMethods(targetClass);
    applyPhysicsFactoryMethods(targetClass);
    applyMarbleManagementMethods(targetClass);
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

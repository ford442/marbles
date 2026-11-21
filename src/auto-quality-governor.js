// @ts-check
/**
 * Runtime quality governor — adapts Filament cost to sustained frame time.
 * Filament path only; simple WebGL renderer is unaffected.
 */

import { downgradeQualityTier } from './level-effect-budget.js';
import { applyMarbleMaterialPreset, updateMarbleMaterialTiers, MATERIAL_TIER } from './marble-material-tier.ts';

/** @typedef {import('./types/engine-context.ts').EngineContext} EngineContext */
/** @typedef {import('./types/settings.ts').RuntimeGraphicsOverrides} RuntimeGraphicsOverrides */

/** @typedef {'HEADROOM' | 'TARGET' | 'STRESS' | 'CRITICAL'} PerfState */
/** p95 frame-time ceilings (ms) for each state. */
/** @typedef {{ headroom: number, target: number, stress: number, critical: number }} PerfThresholds */

/**
 * What the governor reads and drives: settings and the runtime override layer,
 * the renderer kind, and every subsystem a downshift step touches (plus what
 * the marble material tiering it re-applies needs).
 * @typedef {import('./marble-material-tier.ts').MaterialTierHost
 *     & Pick<import('./types/settings.ts').SettingsContext, 'settings' | '_runtimeGraphicsOverrides'>
 *     & import('./init/settings.ts').EnvironmentNameContext
 *     & Pick<EngineContext, 'lightingSystem' | 'volumetricLights' | 'particleSystem' | 'lightingBudget' | 'marbleLodManager'>
 *     & Pick<import('./game/systems/physics-world.ts').PhysicsWorldHost, 'rendererType'>
 *     & Pick<import('./zone-setup/environment.ts').ZoneSetupEnvironmentHost, '_iblTexture'>
 *     & {
 *         setupEnvironmentLighting?(envName?: string): void,
 *         applyGraphicsSettings?(): void,
 *     }} AutoQualityGovernorHost
 */

/** @typedef {{ frameMs: number }} FrameTimeSample */

/** @type {readonly PerfState[]} */
export const PERF_STATES = ['HEADROOM', 'TARGET', 'STRESS', 'CRITICAL'];

/** @type {PerfThresholds} */
const DEFAULT_THRESHOLDS = {
    headroom: 14,
    target: 18,
    stress: 25,
    critical: 33,
};

/** @type {Readonly<Partial<Record<number, PerfThresholds>>>} */
const TARGET_FPS_THRESHOLDS = {
    30: { headroom: 28, target: 33, stress: 40, critical: 50 },
    60: DEFAULT_THRESHOLDS,
    120: { headroom: 7, target: 9, stress: 12, critical: 16 },
};

/** @type {ReadonlyArray<{ step: number, label: string }>} */
export const DOWNSHIFT_STEPS = [
    { step: 1, label: 'particles ↓' },
    { step: 2, label: 'zone lights ↓' },
    { step: 3, label: 'shadows ↓' },
    { step: 4, label: 'SSR/blur/volumetrics off' },
    { step: 5, label: 'SSAO off' },
    { step: 6, label: 'marble LOD ↓' },
    { step: 7, label: 'resolution ↓' },
    { step: 8, label: 'cubemap specular off' },
];

const FRAMES_DOWNSHIFT = 20;
const FRAMES_UPSHIFT = 300;
const P95_WINDOW = 120;

/**
 * @param {number} p95
 * @param {PerfThresholds} thresholds
 * @returns {PerfState}
 */
function classifyState(p95, thresholds) {
    if (p95 <= thresholds.headroom) return 'HEADROOM';
    if (p95 <= thresholds.target) return 'TARGET';
    if (p95 <= thresholds.stress) return 'STRESS';
    return 'CRITICAL';
}

/** @type {Readonly<Record<PerfState, number>>} */
const STATE_ORDER = { HEADROOM: 0, TARGET: 1, STRESS: 2, CRITICAL: 3 };

export class AutoQualityGovernor {
    /** @param {AutoQualityGovernorHost} game */
    constructor(game) {
        this.game = game;
        this.enabled = true;
        /** @type {PerfState} */
        this.state = 'TARGET';
        this.autoQualityStep = 0;
        this.lastStepLabel = '';
        this._stateStreak = 0;
        /** @type {PerfState} */
        this._pendingState = 'TARGET';
        /** @type {number | null} User render scale saved while step 7 lowers it. */
        this._savedRenderScale = null;
        this._cubemapWasActive = false;
        if (typeof window !== 'undefined') {
            window.autoQualityGovernor = this;
        }
    }

    /** @returns {boolean} */
    isActive() {
        if (this.game.rendererType === 'simple-webgl' || (typeof window !== 'undefined' && window.usingSimpleRenderer)) return false;
        const mode = this.game.settings?.graphics?.performanceMode || 'auto';
        return mode === 'auto' || mode === 'maxPerformance';
    }

    /** @returns {number | 'unlimited'} */
    getTargetFps() {
        const raw = this.game.settings?.graphics?.targetFps;
        if (raw === 'unlimited' || raw === 0) return 'unlimited';
        return Number(raw) || 60;
    }

    /** @returns {PerfThresholds | null} null when the frame rate is uncapped. */
    getThresholds() {
        const target = this.getTargetFps();
        if (target === 'unlimited') return null;
        return TARGET_FPS_THRESHOLDS[target] || DEFAULT_THRESHOLDS;
    }

    /** @returns {number} Quality tiers to drop zone effects by (0–2). */
    getEffectQualityBias() {
        if (this.autoQualityStep >= 1) return Math.min(2, 1 + Math.floor((this.autoQualityStep - 1) / 3));
        return 0;
    }

    /** @returns {RuntimeGraphicsOverrides} */
    getRuntimeOverrides() {
        return this.game._runtimeGraphicsOverrides || {};
    }

    /**
     * @param {RuntimeGraphicsOverrides} patch
     * @returns {void}
     */
    setRuntimeOverrides(patch) {
        this.game._runtimeGraphicsOverrides = {
            ...(this.game._runtimeGraphicsOverrides || {}),
            ...patch,
        };
    }

    /** @returns {void} */
    clearRuntimeOverrides() {
        this.game._runtimeGraphicsOverrides = null;
        if (this._savedRenderScale !== null && this.game.settings?.graphics) {
            this.game.settings.graphics.renderScale = this._savedRenderScale;
            this._savedRenderScale = null;
        }
    }

    /** Snapshot for the perf overlay / DevTools. */
    getStatus() {
        return {
            enabled: this.isActive(),
            performanceMode: this.game.settings?.graphics?.performanceMode || 'auto',
            targetFps: this.getTargetFps(),
            state: this.state,
            autoQualityStep: this.autoQualityStep,
            lastStepLabel: this.lastStepLabel,
            currentQualityBias: this.getEffectQualityBias(),
            runtimeOverrides: { ...(this.game._runtimeGraphicsOverrides || {}) },
        };
    }

    /** @returns {void} */
    reset() {
        this.state = 'TARGET';
        this._stateStreak = 0;
        this._pendingState = 'TARGET';
        this.setStep(0, 'reset');
    }

    /**
     * @param {number} p95FrameMs Rolling p95 frame time (`computeP95`).
     * @returns {void}
     */
    tick(p95FrameMs) {
        if (!this.isActive()) {
            if (this.autoQualityStep !== 0) this.setStep(0, 'governor off');
            return;
        }

        const mode = this.game.settings?.graphics?.performanceMode || 'auto';
        if (mode === 'maxPerformance') {
            if (this.autoQualityStep < 6) this.setStep(6, 'max performance');
            return;
        }

        const thresholds = this.getThresholds();
        if (!thresholds) return;

        const nextState = classifyState(p95FrameMs, thresholds);
        if (nextState === this._pendingState) {
            this._stateStreak += 1;
        } else {
            this._pendingState = nextState;
            this._stateStreak = 1;
        }

        const needFrames = this._isWorsening(nextState) ? FRAMES_DOWNSHIFT : FRAMES_UPSHIFT;
        if (this._stateStreak < needFrames) return;

        this.state = nextState;
        this._stateStreak = 0;

        if (nextState === 'CRITICAL' || nextState === 'STRESS') {
            if (this.autoQualityStep < DOWNSHIFT_STEPS.length) {
                this.setStep(this.autoQualityStep + 1, nextState);
            }
        } else if (nextState === 'HEADROOM' && this.autoQualityStep > 0) {
            this.setStep(this.autoQualityStep - 1, 'recovering');
        }
    }

    /**
     * @param {PerfState} nextState
     * @returns {boolean}
     */
    _isWorsening(nextState) {
        return STATE_ORDER[nextState] > STATE_ORDER[this.state];
    }

    /**
     * @param {number} step Clamped to 0..DOWNSHIFT_STEPS.length.
     * @param {string} [reason]
     * @returns {void}
     */
    setStep(step, reason = '') {
        step = Math.max(0, Math.min(DOWNSHIFT_STEPS.length, step));
        if (step === this.autoQualityStep) return;

        const prev = this.autoQualityStep;
        this.autoQualityStep = step;
        this.lastStepLabel = step > 0 ? DOWNSHIFT_STEPS[step - 1]?.label ?? '' : '';
        this._applyStep(prev, step);
        console.info(`[AUTO-Q] step ${step}${this.lastStepLabel ? ` — ${this.lastStepLabel}` : ''}${reason ? ` (${reason})` : ''}`);
    }

    /**
     * @param {number} prev
     * @param {number} step
     * @returns {void}
     */
    _applyStep(prev, step) {
        const game = this.game;
        if (step === 0) {
            this.clearRuntimeOverrides();
            game.lightingSystem?.setAnimationsEnabled(true);
            game.volumetricLights?.setQuality(game.settings?.graphics?.quality || 'medium');
            game.marbleLodManager?.setForceMaxLod(null);
            game.particleSystem?.setStressScale(1.0);
            if (this._cubemapWasActive) {
                this._cubemapWasActive = false;
                game.setupEnvironmentLighting?.(game.currentEnvironment || 'default');
            }
            game.applyGraphicsSettings?.();
            return;
        }

        /** @type {RuntimeGraphicsOverrides} */
        const overrides = {};
        if (step >= 1) {
            game.particleSystem?.setStressScale(0.55);
        }
        if (step >= 2) {
            game.lightingSystem?.setAnimationsEnabled(false);
            game.volumetricLights?.setQuality('low');
            game.lightingBudget?.update();
        } else if (prev >= 2 && step < 2) {
            game.lightingSystem?.setAnimationsEnabled(true);
            game.volumetricLights?.setQuality(game.settings?.graphics?.quality || 'medium');
            game.lightingBudget?.update();
        }
        if (step >= 3) {
            overrides.shadowTierDowngrade = Math.min(2, step - 2);
        }
        if (step >= 4) {
            overrides.heavyFxDisabled = true;
            overrides.volumetricDisabled = true;
            game.volumetricLights?.setQuality('low');
        }
        if (step >= 5) {
            overrides.ssaoDisabled = true;
        }
        if (step >= 6) {
            game.marbleLodManager?.setForceMaxLod(1);
            for (const marble of game.marbles || []) {
                applyMarbleMaterialPreset(marble, game, MATERIAL_TIER.BASE);
            }
        } else if (prev >= 6 && step < 6) {
            game.marbleLodManager?.setForceMaxLod(null);
            updateMarbleMaterialTiers(game, performance.now());
        }
        if (step >= 7) {
            overrides.dynamicMinScale = 0.35;
            if (this._savedRenderScale === null && game.settings?.graphics) {
                this._savedRenderScale = game.settings.graphics.renderScale ?? 1.0;
            }
            const base = this._savedRenderScale ?? 1.0;
            // Guarded: settings are unset until boot finishes (this used to throw).
            if (game.settings?.graphics) {
                game.settings.graphics.renderScale = Math.min(base, Math.max(0.65, base * 0.85));
            }
        }
        if (step >= 8) {
            overrides.forceShOnlyIbl = true;
            if (!this._cubemapWasActive && game._iblTexture) {
                this._cubemapWasActive = true;
            }
            game.setupEnvironmentLighting?.(game.currentEnvironment || 'default');
        } else if (prev >= 8 && step < 8) {
            overrides.forceShOnlyIbl = false;
            if (this._cubemapWasActive) {
                this._cubemapWasActive = false;
                game.setupEnvironmentLighting?.(game.currentEnvironment || 'default');
            }
        }

        if (step < 7 && prev >= 7 && this._savedRenderScale !== null && game.settings?.graphics) {
            game.settings.graphics.renderScale = this._savedRenderScale
            this._savedRenderScale = null
        }

        game._runtimeGraphicsOverrides = overrides
        game.applyGraphicsSettings?.()
    }

    /**
     * Rolling p95 from perf samples (~2 s window).
     * @param {readonly FrameTimeSample[]} samples
     * @returns {number}
     */
    static computeP95(samples) {
        const window = samples.slice(-P95_WINDOW).filter(s => s.frameMs > 0);
        if (!window.length) return 16.67;
        const sorted = window.map(s => s.frameMs).sort((a, b) => a - b);
        const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95));
        // 0 <= idx < sorted.length (non-empty), so the fallback never fires.
        return sorted[idx] ?? 16.67;
    }
}

export default AutoQualityGovernor;

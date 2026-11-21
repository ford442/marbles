// @ts-check
/**
 * Per-level caps for expensive zone features (lights, emitters, kinematic movers).
 * Queried during zone setup; dev overlay surfaces exceed events only.
 */

/** @typedef {'low' | 'medium' | 'high' | 'ultra'} QualityTier */
/** @typedef {{ zoneLights: number, particleEmitters: number, kinematicMovers: number }} EffectCounts */
/** @typedef {keyof EffectCounts} EffectKind */

/**
 * The game members the budget reads: the player's quality tier, the governor's
 * downshift bias and whether the perf overlay is on (to log exceed events).
 * @typedef {Pick<import('./types/settings.ts').SettingsContext, 'settings'>
 *     & Pick<import('./types/engine-context.ts').EngineContext, 'autoQualityGovernor' | 'perfMonitor'>} LevelEffectBudgetHost
 */

/** @type {Readonly<Record<QualityTier, Readonly<EffectCounts>>>} */
export const LEVEL_EFFECT_BUDGETS = {
    low: { zoneLights: 4, particleEmitters: 2, kinematicMovers: 6 },
    medium: { zoneLights: 8, particleEmitters: 4, kinematicMovers: 12 },
    high: { zoneLights: 16, particleEmitters: 8, kinematicMovers: 20 },
    ultra: { zoneLights: 24, particleEmitters: 12, kinematicMovers: 30 },
};

/** @type {readonly QualityTier[]} */
const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
/** The same list, widened so arbitrary (user / saved) strings can be looked up. */
/** @type {readonly string[]} */
const QUALITY_NAMES = QUALITY_ORDER;

/**
 * @param {string | null | undefined} quality Tier name (case-insensitive); unknown → 'medium'.
 * @param {number} [steps]
 * @returns {QualityTier}
 */
export function downgradeQualityTier(quality, steps = 1) {
    const idx = QUALITY_NAMES.indexOf((quality || 'medium').toLowerCase());
    const base = idx >= 0 ? idx : 1;
    return QUALITY_ORDER[Math.max(0, base - steps)] || 'low';
}

/** @returns {EffectCounts} */
function emptyCounts() {
    return { zoneLights: 0, particleEmitters: 0, kinematicMovers: 0 };
}

export class LevelEffectBudget {
    /** @param {LevelEffectBudgetHost} game */
    constructor(game) {
        this.game = game;
        this.counts = emptyCounts();
        /** @type {Partial<Record<EffectKind, number>>} Rejected allocations per kind. */
        this.exceeded = {};
    }

    /** @returns {void} */
    reset() {
        this.counts = emptyCounts();
        this.exceeded = {};
    }

    /** @returns {QualityTier} */
    getEffectiveQuality() {
        const base = this.game.settings?.graphics?.quality || 'medium';
        const bias = this.game.autoQualityGovernor?.getEffectQualityBias?.() || 0;
        return downgradeQualityTier(base, bias);
    }

    /** @returns {Readonly<EffectCounts>} */
    get limits() {
        return LEVEL_EFFECT_BUDGETS[this.getEffectiveQuality()] || LEVEL_EFFECT_BUDGETS.medium;
    }

    /**
     * @param {EffectKind} kind
     * @returns {boolean}
     */
    canAllocate(kind) {
        const limit = this.limits[kind];
        if (limit === undefined) return true;
        return (this.counts[kind] || 0) < limit;
    }

    /**
     * @param {EffectKind} kind
     * @returns {boolean} false (and records an exceed) when the kind is at its cap.
     */
    allocate(kind) {
        if (!this.canAllocate(kind)) {
            this.exceeded[kind] = (this.exceeded[kind] || 0) + 1;
            if (this.game.perfMonitor?.enabled) {
                console.debug(`[BUDGET] exceeded ${kind}`, this.counts[kind], '>=', this.limits[kind]);
            }
            return false;
        }
        this.counts[kind] = (this.counts[kind] || 0) + 1;
        return true;
    }
}

export default LevelEffectBudget;

/**
 * Per-level caps for expensive zone features (lights, emitters, kinematic movers).
 * Queried during zone setup; dev overlay surfaces exceed events only.
 */

export const LEVEL_EFFECT_BUDGETS = {
    low: { zoneLights: 4, particleEmitters: 2, kinematicMovers: 6 },
    medium: { zoneLights: 8, particleEmitters: 4, kinematicMovers: 12 },
    high: { zoneLights: 16, particleEmitters: 8, kinematicMovers: 20 },
    ultra: { zoneLights: 24, particleEmitters: 12, kinematicMovers: 30 },
};

const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

export function downgradeQualityTier(quality, steps = 1) {
    const idx = QUALITY_ORDER.indexOf((quality || 'medium').toLowerCase());
    const base = idx >= 0 ? idx : 1;
    return QUALITY_ORDER[Math.max(0, base - steps)] || 'low';
}

export class LevelEffectBudget {
    constructor(game) {
        this.game = game;
        this.counts = { zoneLights: 0, particleEmitters: 0, kinematicMovers: 0 };
        this.exceeded = {};
    }

    reset() {
        this.counts = { zoneLights: 0, particleEmitters: 0, kinematicMovers: 0 };
        this.exceeded = {};
    }

    getEffectiveQuality() {
        const base = this.game.settings?.graphics?.quality || 'medium';
        const bias = this.game.autoQualityGovernor?.getEffectQualityBias?.() || 0;
        return downgradeQualityTier(base, bias);
    }

    get limits() {
        return LEVEL_EFFECT_BUDGETS[this.getEffectiveQuality()] || LEVEL_EFFECT_BUDGETS.medium;
    }

    canAllocate(kind) {
        const limit = this.limits[kind];
        if (limit === undefined) return true;
        return (this.counts[kind] || 0) < limit;
    }

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

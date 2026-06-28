import assert from 'node:assert/strict';
import { EffectBudget, EFFECT_BUDGETS } from '../src/effect-pool.js';
import {
    shouldUpdateParticle,
    shouldSkipParticleColorUpdate,
} from '../src/particle-sync-helpers.js';

function testEffectBudgetMedium() {
    const game = {
        settings: { graphics: { quality: 'medium' } },
        activeMissiles: [{}, {}],
        activeBlackHoles: [{}],
        activeBombs: [],
        visualParticles: new Array(78),
        temporaryPlatforms: [],
    };
    const budget = new EffectBudget(game);
    assert.equal(budget.limits.missile, EFFECT_BUDGETS.medium.missile);
    assert.equal(budget.canSpawnProjectile('missile'), true);
    game.activeMissiles.push({}, {});
    assert.equal(budget.canSpawnProjectile('missile'), false);
    assert.equal(budget.getVisualBurstCount(25), 2);
}

function testParticleUpdateCadence() {
    const p = { duration: 1000 };
    assert.equal(shouldUpdateParticle(p, 100, 50 * 50, 0), true);
    assert.equal(shouldUpdateParticle(p, 100, 80 * 80, 1), false);
    assert.equal(shouldUpdateParticle(p, 950, 10 * 10, 1), false);
}

function testSkipFadedColor() {
    const p = { duration: 500, _lastBaseColor: [0.01, 0.01, 0.01] };
    assert.equal(shouldSkipParticleColorUpdate(p, 480), true);
}

testEffectBudgetMedium();
testParticleUpdateCadence();
testSkipFadedColor();
console.log('effect pool tests passed');

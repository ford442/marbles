import assert from 'node:assert/strict';
import {
    LightingBudgetManager,
    LIGHT_BUDGETS,
    shouldUseMarbleProxyLight,
} from '../src/lighting-budget.js';

function mockGame(quality = 'medium') {
    const scene = {
        entities: new Set(),
        addEntity(e) { this.entities.add(e); },
        remove(e) { this.entities.delete(e); },
    };
    return {
        settings: { graphics: { quality } },
        scene,
        rendererType: 'filament',
        playerMarble: {
            rigidBody: { translation: () => ({ x: 0, y: 0, z: 0 }) },
        },
        cullingManager: { enabled: false },
        autoQualityGovernor: null,
    };
}

function testTierLimits() {
    assert.equal(LIGHT_BUDGETS.low.maxPointSpot, 4);
    assert.equal(LIGHT_BUDGETS.ultra.maxAnimated, 6);
}

function testMarbleProxyQualityGate() {
    assert.equal(shouldUseMarbleProxyLight('low'), false);
    assert.equal(shouldUseMarbleProxyLight('medium'), false);
    assert.equal(shouldUseMarbleProxyLight('high'), true);
    assert.equal(shouldUseMarbleProxyLight('ultra'), true);
}

function testBudgetCapsLowTier() {
    const game = mockGame('low');
    const budget = new LightingBudgetManager(game);
    const limits = budget.getLimits();
    assert.equal(limits.maxDynamic, LIGHT_BUDGETS.low.maxPointSpot - 2);

    for (let i = 0; i < 6; i++) {
        budget.register({
            entity: 100 + i,
            owner: 'zone',
            pos: { x: i * 2, y: 0, z: 0 },
            falloff: 10,
        });
    }
    budget.update();

    assert.equal(budget.stats.active, limits.maxDynamic);
    assert.ok(budget.stats.culledByBudget >= 1);
}

function testPriorityKeepsPlayerLight() {
    const game = mockGame('low');
    const budget = new LightingBudgetManager(game);

    for (let i = 0; i < 4; i++) {
        budget.register({
            entity: 200 + i,
            owner: 'zone',
            pos: { x: 100 + i, y: 0, z: 0 },
            falloff: 8,
        });
    }
    budget.register({
        entity: 999,
        owner: 'player',
        pos: { x: 0, y: 0, z: 0 },
        falloff: 20,
    });

    budget.update();
    assert.equal(budget.isBudgetActive(999), true);
}

function testDistanceFadeRemovesDistantZoneLight() {
    const game = mockGame('ultra');
    game.playerMarble.rigidBody.translation = () => ({ x: 0, y: 0, z: 0 });
    const budget = new LightingBudgetManager(game);

    budget.register({
        entity: 301,
        owner: 'zone',
        pos: { x: 0, y: 0, z: 200 },
        falloff: 10,
    });
    budget.update();

    assert.equal(budget.isBudgetActive(301), false);
    assert.ok(budget.stats.culledByDistance >= 1);
    assert.equal(game.scene.entities.has(301), false);
}

testTierLimits();
testMarbleProxyQualityGate();
testBudgetCapsLowTier();
testPriorityKeepsPlayerLight();
testDistanceFadeRemovesDistantZoneLight();
console.log('lighting budget tests passed');

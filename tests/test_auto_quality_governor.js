import assert from 'node:assert/strict';
import { AutoQualityGovernor, DOWNSHIFT_STEPS } from '../src/auto-quality-governor.js';
import { LevelEffectBudget, downgradeQualityTier, LEVEL_EFFECT_BUDGETS } from '../src/level-effect-budget.js';

function makeGame(overrides = {}) {
    return {
        rendererType: 'filament',
        settings: {
            graphics: {
                quality: 'high',
                performanceMode: 'auto',
                targetFps: 60,
                renderScale: 1.0,
                dynamicResolution: true,
            },
        },
        _runtimeGraphicsOverrides: null,
        _iblTexture: null,
        currentEnvironment: 'default',
        applyGraphicsSettings() {},
        setupEnvironmentLighting() {},
        lightingSystem: { setAnimationsEnabled() {}, setQuality() {} },
        volumetricLights: { setQuality() {} },
        marbleLodManager: { setForceMaxLod() {} },
        particleSystem: { setStressScale() {} },
        ...overrides,
    };
}

function testStateClassification() {
    const game = makeGame();
    const gov = new AutoQualityGovernor(game);
    const samples = Array.from({ length: 120 }, (_, i) => ({
        frameMs: i < 60 ? 12 : 30,
    }));
    const p95 = AutoQualityGovernor.computeP95(samples);
    assert.ok(p95 >= 28, 'p95 should reflect slow tail');
    gov.tick(p95);
    assert.ok(gov.autoQualityStep >= 0);
}

function testDownshiftOnStress() {
    const game = makeGame();
    const gov = new AutoQualityGovernor(game);
    for (let i = 0; i < 25; i++) {
        gov.tick(30);
    }
    assert.equal(gov.autoQualityStep, 1);
    assert.equal(gov.lastStepLabel, DOWNSHIFT_STEPS[0].label);
}

function testLockedModeIgnoresGovernor() {
    const game = makeGame({
        settings: {
            graphics: { quality: 'high', performanceMode: 'locked', targetFps: 60 },
        },
    });
    const gov = new AutoQualityGovernor(game);
    gov.setStep(3, 'test');
    for (let i = 0; i < 40; i++) gov.tick(40);
    assert.equal(gov.autoQualityStep, 0);
}

function testQualityTierDowngrade() {
    assert.equal(downgradeQualityTier('ultra', 1), 'high');
    assert.equal(downgradeQualityTier('high', 1), 'medium');
    assert.equal(downgradeQualityTier('high', 2), 'low');
    assert.equal(downgradeQualityTier('low', 1), 'low');
}

function testLevelEffectBudget() {
    const game = makeGame();
    game.autoQualityGovernor = { getEffectQualityBias: () => 1 };
    const budget = new LevelEffectBudget(game);
    const limit = LEVEL_EFFECT_BUDGETS.medium.zoneLights;
    for (let i = 0; i < limit; i++) {
        assert.equal(budget.allocate('zoneLights'), true);
    }
    assert.equal(budget.allocate('zoneLights'), false);
    assert.ok(budget.exceeded.zoneLights >= 1);
}

testStateClassification();
testDownshiftOnStress();
testLockedModeIgnoresGovernor();
testQualityTierDowngrade();
testLevelEffectBudget();
console.log('auto quality governor tests passed');

import assert from 'node:assert/strict';
import {
    MATERIAL_TIER,
    buildTieredPreset,
    getMaterialDetailConfig,
    resolveMarbleMaterialTier,
} from '../src/marble-material-tier.js';

function mockMarble(overrides = {}) {
    return {
        matInstance: {},
        rigidBody: { translation: () => ({ x: 0, y: 0, z: 0 }) },
        lodLevel: 1,
        materialPresetName: 'obsidianMetal',
        ...overrides,
    };
}

function mockGame(overrides = {}) {
    return {
        hasProceduralMaterial: true,
        settings: { graphics: { quality: 'high' } },
        playerMarble: null,
        autoQualityGovernor: null,
        marbleLodManager: { _nearestLod0Keys: new Set() },
        _cameraState: { eye: [0, 0, 0] },
        ...overrides,
    };
}

function testDetailConfigTiers() {
    assert.equal(getMaterialDetailConfig('low').bumpOctaves, 0);
    assert.equal(getMaterialDetailConfig('medium').bumpOctaves, 1);
    assert.equal(getMaterialDetailConfig('high').bumpOctaves, 4);
    assert.equal(getMaterialDetailConfig('high', 6).bumpOctaves, 0);
}

function testPlayerAlwaysFull() {
    const marble = mockMarble({ lodLevel: 2 });
    const game = mockGame({ playerMarble: marble });
    assert.equal(resolveMarbleMaterialTier(marble, game), MATERIAL_TIER.FULL);
}

function testDistantLod0Simplified() {
    const marble = mockMarble({ lodLevel: 0 });
    const game = mockGame({
        _cameraState: { eye: [100, 0, 0] },
    });
    assert.equal(resolveMarbleMaterialTier(marble, game), MATERIAL_TIER.SIMPLIFIED);
}

function testBaseTierStripsAdvanced() {
    const preset = buildTieredPreset(
        { color: [1, 0, 0], roughness: 0.2, anisotropy: 0.8, subsurfaceScattering: 0.5, bumpScale: 0.1 },
        'obsidianMetal',
        MATERIAL_TIER.BASE,
        'high',
        0
    );
    assert.equal(preset.anisotropyStrength ?? preset.anisotropy, 0);
    assert.equal(preset.subsurfaceStrength, 0);
    assert.equal(preset.bumpOctaves, 0);
}

function testFullTierKeepsDetail() {
    const preset = buildTieredPreset(
        { color: [1, 0, 0], roughness: 0.2, anisotropy: 0.8, subsurfaceScattering: 0.5, bumpScale: 0.1 },
        'obsidianMetal',
        MATERIAL_TIER.FULL,
        'high',
        0
    );
    assert.ok(preset.bumpOctaves >= 1);
    assert.ok(preset.subsurfaceStrength > 0);
    assert.equal(preset.anisotropyStrength, 0.8);
}

testDetailConfigTiers();
testPlayerAlwaysFull();
testDistantLod0Simplified();
testBaseTierStripsAdvanced();
testFullTierKeepsDetail();
console.log('marble material tier tests passed');

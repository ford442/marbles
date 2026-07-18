import assert from 'node:assert/strict';
import {
    getStaticBatchKey,
    isStaticBatchingEnabled,
    resolveStaticSurfacePreset,
    MATERIAL_SURFACE_ALIASES,
} from '../src/game/systems/physics-world-pure.js';
import { findBestLockOnTarget } from '../src/game/systems/input-target-lock.js';
import { extractMarbleMaterialFields } from '../src/game/systems/marble-material-fields.js';

function testMaterialAliases() {
    assert.equal(MATERIAL_SURFACE_ALIASES.glass, 'crystal');
    assert.equal(MATERIAL_SURFACE_ALIASES.lava, 'volcanicRock');
}

function testResolveStaticSurfacePreset() {
    const crystal = resolveStaticSurfacePreset('glass');
    assert.ok(crystal, 'glass alias resolves to crystal preset');
    assert.ok(Array.isArray(crystal.baseColor) || crystal.baseColor === undefined);

    const custom = resolveStaticSurfacePreset({ baseColor: [0.1, 0.2, 0.3] });
    assert.deepEqual(custom.baseColor, [0.1, 0.2, 0.3]);

    assert.equal(resolveStaticSurfacePreset('nonexistent-preset-xyz'), null);
}

function testStaticBatchKey() {
    const keyA = getStaticBatchKey([1, 0, 0], 'glass', null);
    const keyB = getStaticBatchKey([1, 0, 0], 'glass', null);
    assert.equal(keyA, keyB);

    const keyC = getStaticBatchKey([0, 1, 0], 'glass', null);
    assert.notEqual(keyA, keyC);
}

function testStaticBatchingToggle() {
    assert.equal(isStaticBatchingEnabled({ rendererType: 'simple-webgl' }), false);
    assert.equal(isStaticBatchingEnabled({ usingSimpleRenderer: true }), false);
    assert.equal(isStaticBatchingEnabled({ search: '?staticBatch=0' }), false);
    assert.equal(isStaticBatchingEnabled({ search: '' }), true);
}

function testFindBestLockOnTarget() {
    const player = {
        rigidBody: { translation: () => ({ x: 0, y: 0, z: 0 }) },
        name: 'Player',
    };
    const near = {
        rigidBody: { translation: () => ({ x: 1, y: 0, z: 0 }) },
        name: 'Near',
    };
    const far = {
        rigidBody: { translation: () => ({ x: 10, y: 0, z: 0 }) },
        name: 'Far',
    };

    assert.equal(findBestLockOnTarget([player, near, far], player), near);
    assert.equal(findBestLockOnTarget([], player), null);
    assert.equal(findBestLockOnTarget([near], null), null);
}

function testExtractMarbleMaterialFields() {
    const fields = extractMarbleMaterialFields({
        roughness: 0.3,
        metallic: 0.9,
        unrelated: true,
    });
    assert.equal(fields.roughness, 0.3);
    assert.equal(fields.metallic, 0.9);
    assert.equal(fields.unrelated, undefined);
}

testMaterialAliases();
testResolveStaticSurfacePreset();
testStaticBatchKey();
testStaticBatchingToggle();
testFindBestLockOnTarget();
testExtractMarbleMaterialFields();
console.log('All Phase B subsystem pure API tests passed');

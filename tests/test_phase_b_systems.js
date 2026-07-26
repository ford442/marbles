import assert from 'node:assert/strict';
import {
    getStaticBatchKey,
    isStaticBatchingEnabled,
    resolveStaticSurfacePreset,
    MATERIAL_SURFACE_ALIASES,
} from '../src/game/systems/physics-world-pure.js';
import { findBestLockOnTarget } from '../src/game/systems/input-target-lock.js';
import { extractMarbleMaterialFields } from '../src/game/systems/marble-material-fields.js';
import { LevelLoader } from '../src/game/systems/level-loader.js';
import { RenderPipeline } from '../src/game/systems/render-pipeline.js';
import { HudController } from '../src/game/systems/hud-controller.js';
import { installKnownMethods } from '../src/game/systems/method-installer.js';

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

async function testLevelLoaderDependenciesAndDelegation() {
    const game = { marker: 'game' };
    const physicsWorld = {};
    const marbleRegistry = {};
    const assetRegistry = {};
    const calls = [];
    const level = { id: 'factory-test' };
    const loader = new LevelLoader(game, {
        physicsWorld,
        marbleRegistry,
        assetRegistry,
        getLevelById: (id) => id === level.id ? level : null,
        runtime: {
            loadLevel(id) {
                calls.push(['load', this, id]);
                return true;
            },
        },
        cleanupRuntime: {
            clearLevel() {
                calls.push(['clear', this]);
            },
        },
    });

    assert.equal(loader.physicsWorld, physicsWorld);
    assert.equal(loader.marbleRegistry, marbleRegistry);
    assert.equal(loader.assetRegistry, assetRegistry);
    assert.equal(loader.getLevel('factory-test'), level);
    assert.equal(await loader.loadLevel('factory-test'), true);
    loader.clearLevel();
    assert.deepEqual(calls.map(([name]) => name), ['load', 'clear']);
    assert.equal(calls[0][1], game);
    assert.equal(calls[1][1], game);
}

function testRenderPipelineFrameOrder() {
    const calls = [];
    const game = {
        perfMonitor: { beginFrame: () => calls.push('begin') },
        tickFrameInput: () => calls.push('input'),
        updateCamera: () => calls.push('camera'),
        tickSceneDynamics: () => {
            calls.push('dynamics');
            return { culledPowerUps: 2, culledCollectibles: 3 };
        },
        tickActiveProjectiles: () => calls.push('effects'),
        finalizeFrame: (_now, powerUps, collectibles, shouldUpdateHUD) => {
            calls.push(`finalize:${powerUps}:${collectibles}:${typeof shouldUpdateHUD}`);
        },
    };
    const physicsWorld = { flushStaticBatches: () => 'flushed' };
    const pipeline = new RenderPipeline(game, { physicsWorld });
    pipeline.syncTransformsAndRender = () => calls.push('sync');

    pipeline.renderAndSync();

    assert.deepEqual(calls, [
        'begin', 'input', 'camera', 'dynamics', 'effects',
        'finalize:2:3:boolean', 'sync',
    ]);
    assert.equal(pipeline.flushStaticBatches(), 'flushed');
}

function testHudControllerSingleFrameEntry() {
    const calls = [];
    const game = {
        abilitySystem: null,
        playerMarble: { rigidBody: { translation: () => ({ x: 1, y: 2, z: 3 }) } },
        updateGoalEffects: (dt, pos) => calls.push(['goal', dt, pos]),
    };
    const hud = new HudController(game, { initialize: false });
    hud.updateAllAbilities = () => calls.push(['abilities']);

    hud.updateFrame(1000, { shouldUpdateHUD: false });

    assert.deepEqual(calls, [
        ['abilities'],
        ['goal', 0.016, { x: 1, y: 2, z: 3 }],
    ]);
}

function testClosedMethodInstaller() {
    class Source {
        known() { return this.value; }
        accidental() { return 'not installed'; }
    }
    class Target {}
    installKnownMethods(Target, Source, ['known']);
    const target = new Target();
    target.value = 7;
    assert.equal(target.known(), 7);
    assert.equal(target.accidental, undefined);
    assert.throws(() => installKnownMethods(Target, Source, ['missing']), /missing method/);
}

testMaterialAliases();
testResolveStaticSurfacePreset();
testStaticBatchKey();
testStaticBatchingToggle();
testFindBestLockOnTarget();
testExtractMarbleMaterialFields();
await testLevelLoaderDependenciesAndDelegation();
testRenderPipelineFrameOrder();
testHudControllerSingleFrameEntry();
testClosedMethodInstaller();
console.log('All Phase B subsystem pure API tests passed');

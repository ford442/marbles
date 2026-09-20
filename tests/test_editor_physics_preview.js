import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { EditorPhysicsPreview } from '../src/editor/physics-preview.js';

await RAPIER.init();

function createMockGame() {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    let nextEntity = 1;
    const transforms = new Map();
    const destroyedEntities = new Set();

    const builderStub = {
        _mat: null,
        boundingBox() { return this; },
        material(_slot, mat) { this._mat = mat; return this; },
        geometry() { return this; },
        receiveShadows() { return this; },
        castShadows() { return this; },
        build(_engine, entity) { transforms.set(entity, null); },
    };

    return {
        world,
        physicsWorld: { step: () => world.step() },
        engine: {
            getTransformManager: () => ({
                getInstance: (entity) => entity,
                setTransform: (entity, mat) => transforms.set(entity, mat),
            }),
            destroyEntity: (entity) => destroyedEntities.add(entity),
            destroyMaterialInstance: () => {},
        },
        Filament: {
            EntityManager: { get: () => ({ create: () => nextEntity++ }) },
            RenderableManager: { Builder: () => ({ ...builderStub }) },
            RenderableManager$PrimitiveType: { TRIANGLES: 4 },
            RgbType: { sRGB: 0 },
        },
        material: {
            createInstance: () => ({ setColor3Parameter() {}, setFloatParameter() {} }),
        },
        scene: {
            addEntity: () => {},
            remove: () => {},
        },
        sphereVb: {},
        sphereIb: {},
        _transforms: transforms,
        _destroyedEntities: destroyedEntities,
    };
}

function testSpawnAndFall() {
    const game = createMockGame();
    const preview = new EditorPhysicsPreview(game);
    assert.equal(preview.active, false);

    preview.spawn({ x: 0, y: 5, z: 0 });
    assert.equal(preview.active, true);
    assert.equal(game.world.bodies.len(), 1);

    for (let i = 0; i < 60; i++) preview.tick();

    const y = preview.rigidBody.translation().y;
    assert.ok(y < 5, `expected marble to fall, got y=${y}`);

    const mat = game._transforms.get(preview.entity);
    assert.ok(mat, 'entity transform should have been synced');
    assert.ok(Math.abs(mat[13] - y) < 1e-6, 'transform translation should track rigid body y');
}

function testRespawnReplacesPreviousMarble() {
    const game = createMockGame();
    const preview = new EditorPhysicsPreview(game);

    preview.spawn({ x: 0, y: 5, z: 0 });
    const firstEntity = preview.entity;
    preview.spawn({ x: 1, y: 6, z: 2 });

    assert.equal(game.world.bodies.len(), 1, 'respawn should not leak rigid bodies');
    assert.ok(game._destroyedEntities.has(firstEntity), 'previous entity should be destroyed');
    assert.equal(preview.rigidBody.translation().x, 1);
}

function testRemoveClearsMarble() {
    const game = createMockGame();
    const preview = new EditorPhysicsPreview(game);

    preview.spawn({ x: 0, y: 5, z: 0 });
    preview.remove();

    assert.equal(preview.active, false);
    assert.equal(game.world.bodies.len(), 0);

    // tick() with no marble is a no-op, not an error.
    preview.tick();
}

testSpawnAndFall();
testRespawnReplacesPreviousMarble();
testRemoveClearsMarble();
console.log('Editor physics preview tests passed');

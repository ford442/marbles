import assert from 'node:assert/strict';
import {
    shouldUsePhysicsWorker,
    resolvePhysicsHzFromSearch,
    WORKER_SPIKE_LEVEL_ID,
} from '../src/game/systems/physics-backend-pure.js';
import { isManifestLevel, MANIFEST_LEVEL_IDS } from '../src/game/systems/manifest-level-ids.js';
import {
    CMD_RING_BYTES,
    TRANSFORM_BUFFER_BYTES,
    enqueueCommand,
    createCommandViews,
    CMD_OP,
    CMD_HEADER_HEAD,
    CMD_HEADER_TAIL,
} from '../src/game/physics-worker/protocol.js';
import { drainCommandRing } from '../src/game/physics-worker/command-drain.js';

function testWorkerSpikeLevel() {
    assert.equal(WORKER_SPIKE_LEVEL_ID, 'tutorial');
    assert.ok(isManifestLevel('tutorial'));
}

function testManifestAllowlist() {
    assert.ok(MANIFEST_LEVEL_IDS.size >= 24);
    assert.ok(isManifestLevel('space_station'));
    assert.ok(isManifestLevel('mushroom_hop'));
    assert.equal(isManifestLevel('ice_bridges_run'), false);
}

function testShouldUsePhysicsWorkerEnabled() {
    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            levelId: 'tutorial',
        }),
        true,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            levelId: 'mushroom_hop',
        }),
        true,
    );
}

function testShouldUsePhysicsWorkerInitWithoutLevel() {
    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            levelId: null,
        }),
        true,
    );
}

function testShouldUsePhysicsWorkerDisabledFlags() {
    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=0',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            levelId: 'tutorial',
        }),
        false,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: false,
            hasSharedArrayBuffer: true,
            levelId: 'tutorial',
        }),
        false,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            multiplayerMode: true,
            levelId: 'tutorial',
        }),
        false,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            hostAuthorityMode: true,
            levelId: 'tutorial',
        }),
        false,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            editorMode: true,
            levelId: 'tutorial',
        }),
        false,
    );

    assert.equal(
        shouldUsePhysicsWorker({
            search: '?physicsWorker=1',
            crossOriginIsolated: true,
            hasSharedArrayBuffer: true,
            levelId: 'ice_bridges_run',
        }),
        false,
    );
}

function testResolvePhysicsHz() {
    assert.equal(resolvePhysicsHzFromSearch('?physicsHz=60'), 60);
    assert.equal(resolvePhysicsHzFromSearch('?physicsHz=120'), 120);
    assert.equal(resolvePhysicsHzFromSearch(''), 120);
}

function testCommandRingEnqueue() {
    const sab = new SharedArrayBuffer(CMD_RING_BYTES);
    const { u32, f32 } = createCommandViews(sab);
    assert.equal(enqueueCommand(u32, f32, CMD_OP.IMPULSE, 3, 1, 2, 3, 1), true);
    assert.equal(u32[CMD_HEADER_HEAD], 1);
    assert.equal(u32[CMD_HEADER_TAIL], 0);
}

function testCommandRingDrain() {
    const sab = new SharedArrayBuffer(CMD_RING_BYTES);
    const { u32, f32 } = createCommandViews(sab);
    enqueueCommand(u32, f32, CMD_OP.SET_TIMESTEP, 0, 1 / 90);
    enqueueCommand(u32, f32, CMD_OP.KINEMATIC_ROTATION, 2, 0, 0, 0, 1);

    const bodies = [null, null, { removed: false }];
    const removed = new Set();
    const state = { timestep: 1 / 120 };
    const world = { timestep: 1 / 120 };

    bodies[2] = {
        setNextKinematicRotation(q) {
            this.lastQ = q;
        },
    };

    drainCommandRing(u32, f32, bodies, removed, world, state);
    assert.equal(u32[CMD_HEADER_HEAD], u32[CMD_HEADER_TAIL]);
    assert.ok(Math.abs(state.timestep - 1 / 90) < 1e-6);
    assert.deepEqual(bodies[2].lastQ, { x: 0, y: 0, z: 0, w: 1 });
}

function testBufferSizes() {
    assert.ok(TRANSFORM_BUFFER_BYTES > 0);
    assert.ok(CMD_RING_BYTES > TRANSFORM_BUFFER_BYTES);
}

testWorkerSpikeLevel();
testManifestAllowlist();
testShouldUsePhysicsWorkerEnabled();
testShouldUsePhysicsWorkerInitWithoutLevel();
testShouldUsePhysicsWorkerDisabledFlags();
testResolvePhysicsHz();
testCommandRingEnqueue();
testCommandRingDrain();
testBufferSizes();
console.log('All physics backend tests passed');

import assert from 'node:assert/strict';
import {
    shouldUsePhysicsWorker,
    resolvePhysicsHzFromSearch,
    WORKER_SPIKE_LEVEL_ID,
} from '../src/game/systems/physics-backend-pure.ts';
import { isManifestLevel, MANIFEST_LEVEL_IDS } from '../src/game/systems/manifest-level-ids.js';
import {
    CMD_RING_BYTES,
    TRANSFORM_BUFFER_BYTES,
    TRANSFORM_HEADER_BYTES,
    TRANSFORM_HEADER_U32,
    TRANSFORM_SLOT_BYTES,
    BODY_FLOATS,
    enqueueCommand,
    createCommandViews,
    createTransformViews,
    lerpBodyTransform,
    CMD_OP,
    CMD_HEADER_HEAD,
    CMD_HEADER_TAIL,
} from '../src/game/physics-worker/protocol.js';
import { drainCommandRing } from '../src/game/physics-worker/command-drain.js';
import { WorkerPhysicsBackend } from '../src/game/systems/physics-backend.js';

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

function writeBodyTransform(f32, slot, bodyIndex, t) {
    const base = TRANSFORM_HEADER_BYTES / 4 + slot * (TRANSFORM_SLOT_BYTES / 4) + bodyIndex * BODY_FLOATS;
    f32[base] = t.x; f32[base + 1] = t.y; f32[base + 2] = t.z;
    f32[base + 3] = t.qx; f32[base + 4] = t.qy; f32[base + 5] = t.qz; f32[base + 6] = t.qw;
}

function testLerpBodyTransform() {
    const prev = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const curr = { x: 10, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };

    const mid = lerpBodyTransform(prev, curr, 0.5);
    assert.ok(Math.abs(mid.x - 5) < 1e-9);
    assert.ok(Math.abs(mid.qw - 1) < 1e-9);

    assert.deepEqual(lerpBodyTransform(prev, curr, -1), lerpBodyTransform(prev, curr, 0));
    assert.deepEqual(lerpBodyTransform(prev, curr, 2), lerpBodyTransform(prev, curr, 1));

    // Same rotation encoded with opposite quaternion sign must blend without
    // taking the long way around (or collapsing toward a zero vector).
    const a = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: Math.SQRT1_2, qw: Math.SQRT1_2 };
    const b = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: -Math.SQRT1_2, qw: -Math.SQRT1_2 };
    const blended = lerpBodyTransform(a, b, 0.5);
    const len = Math.sqrt(blended.qx ** 2 + blended.qy ** 2 + blended.qz ** 2 + blended.qw ** 2);
    assert.ok(Math.abs(len - 1) < 1e-6);
    assert.ok(Math.abs(Math.abs(blended.qz) - Math.SQRT1_2) < 1e-6);
}

function testGetInterpolatedTransform() {
    const sab = new SharedArrayBuffer(TRANSFORM_BUFFER_BYTES);
    const { u32, f32 } = createTransformViews(sab);

    writeBodyTransform(f32, 0, 0, { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
    writeBodyTransform(f32, 1, 0, { x: 10, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
    Atomics.store(u32, TRANSFORM_HEADER_U32, 1); // slot 1 is "current", slot 0 is "prev"

    const backend = Object.create(WorkerPhysicsBackend.prototype);
    backend.transformViews = { u32, f32 };

    assert.ok(Math.abs(backend.getInterpolatedTransform(0, 0).translation.x - 0) < 1e-6);
    assert.ok(Math.abs(backend.getInterpolatedTransform(0, 0.5).translation.x - 5) < 1e-6);
    assert.ok(Math.abs(backend.getInterpolatedTransform(0, 1).translation.x - 10) < 1e-6);
}

function testGetInterpolationAlpha() {
    const backend = Object.create(WorkerPhysicsBackend.prototype);
    backend.physicsHz = 100; // 10ms tick interval

    backend._lastTickAt = performance.now();
    assert.ok(backend.getInterpolationAlpha() < 0.5); // just ticked, still near the start

    backend._lastTickAt = performance.now() + 1000; // "in the future" clamps to 0
    assert.equal(backend.getInterpolationAlpha(), 0);

    backend._lastTickAt = performance.now() - 10_000; // long past clamps to 1
    assert.equal(backend.getInterpolationAlpha(), 1);
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
testLerpBodyTransform();
testGetInterpolatedTransform();
testGetInterpolationAlpha();
console.log('All physics backend tests passed');

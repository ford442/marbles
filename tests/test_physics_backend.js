import assert from 'node:assert/strict';
import {
    shouldUsePhysicsWorker,
    resolvePhysicsHzFromSearch,
    WORKER_SPIKE_LEVEL_ID,
} from '../src/game/systems/physics-backend-pure.js';
import {
    CMD_RING_BYTES,
    TRANSFORM_BUFFER_BYTES,
    enqueueCommand,
    createCommandViews,
    CMD_OP,
    CMD_HEADER_HEAD,
    CMD_HEADER_TAIL,
} from '../src/game/physics-worker/protocol.js';

function testWorkerSpikeLevel() {
    assert.equal(WORKER_SPIKE_LEVEL_ID, 'tutorial');
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
            levelId: 'space_station',
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

function testBufferSizes() {
    assert.ok(TRANSFORM_BUFFER_BYTES > 0);
    assert.ok(CMD_RING_BYTES > TRANSFORM_BUFFER_BYTES);
}

testWorkerSpikeLevel();
testShouldUsePhysicsWorkerEnabled();
testShouldUsePhysicsWorkerDisabledFlags();
testResolvePhysicsHz();
testCommandRingEnqueue();
testBufferSizes();
console.log('All physics backend tests passed');

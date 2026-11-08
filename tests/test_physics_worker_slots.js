/**
 * Physics worker body-slot recycling (snapshot layout v4) and the Party Race
 * host sim on the worker clock.
 *
 * Runs the real worker state machine (`createWorkerSim`) in-process over
 * SharedArrayBuffers, ticked manually, as in `test_physics_parity.js`.
 */
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { createWorkerSim } from '../src/game/physics-worker/worker-sim.js';
import {
    MAX_BODIES,
    SNAPSHOT_LAYOUT_VERSION,
    TRANSFORM_HEADER_LAYOUT_VERSION,
    WORKER_MSG,
    createTransformViews,
} from '../src/game/physics-worker/protocol.js';
import { createBodyFromDescriptor } from '../src/game/physics-worker/world-builder.js';
import { WorkerPhysicsBackend, MainThreadPhysicsBackend } from '../src/game/systems/physics-backend.ts';
import { FixedStepClock } from '../src/game/systems/fixed-step-clock.ts';
import { PhysicsWorld } from '../src/game/systems/physics-world.ts';
import { HostSim } from '../src/game/network/host-sim.js';

await RAPIER.init();

const GRAVITY = { x: 0, y: -9.81, z: 0 };
const FLOOR = { type: 'fixed', translation: [0, 0, 0], collider: { type: 'cuboid', halfExtents: [200, 0.5, 200] } };

async function makeWorker() {
    let fakeNow = 0;
    const listeners = new Set();
    const sim = createWorkerSim({
        post: (msg) => queueMicrotask(() => { for (const fn of [...listeners]) fn({ data: msg }); }),
        now: () => fakeNow,
        setInterval: () => 1,
        clearInterval: () => {},
    });
    const fakeWorker = {
        postMessage: (msg) => { sim.handleMessage(msg); },
        addEventListener: (_type, fn) => listeners.add(fn),
        removeEventListener: (_type, fn) => listeners.delete(fn),
        terminate() {},
        onerror: null,
    };
    const game = { physicsClock: new FixedStepClock() };
    game.physicsWorld = new PhysicsWorld(game);
    const backend = new WorkerPhysicsBackend(game);
    await backend.init(GRAVITY, { createWorker: () => fakeWorker });
    game.physicsBackend = backend;
    backend.beginLevel('slots');
    const floor = backend.registerBody(FLOOR);
    await backend.commitWorldBuild();

    const tickMs = 1000 / backend.physicsHz;
    /** One worker tick (one 120 Hz step), then the main thread's per-frame drain/reclaim. */
    const tick = () => {
        fakeNow += tickMs;
        sim.tick();
        backend.step();
    };
    return { game, backend, sim, floor, tick };
}

/** Same Rapier calls as `src/abilities/missiles.js`, through the proxy world. */
function spawnMissile(world, x = 0) {
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 5, 0).setLinvel(0, 0, 40).setGravityScale(0),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.2).setDensity(0.5), body);
    return body;
}

async function testSpawnDespawnBeyondMaxBodies() {
    const h = await makeWorker();
    const world = h.game.world;
    const live = [];
    const total = MAX_BODIES * 3;
    for (let i = 0; i < total; i++) {
        live.push(spawnMissile(world, i % 50));
        // Abilities keep a handful alive at once; despawn the oldest.
        if (live.length > 8) world.removeRigidBody(live.shift());
        if (i % 4 === 0) h.tick();
    }
    h.tick(); // drain the last few removals
    assert.ok(h.backend.isWorkerMode(), 'still on the worker');
    assert.ok(h.backend._nextBodyIndex < 64, `indices recycled (high-water ${h.backend._nextBodyIndex})`);
    // Rapier world holds floor + the live missiles only.
    assert.equal(h.sim.getWorld().bodies.len(), 1 + live.length);
    for (const body of live) assert.ok(body.isValid());
}

async function testNoReuseBeforeWorkerAck() {
    const h = await makeWorker();
    const world = h.game.world;
    const a = spawnMissile(world);
    h.tick();
    const index = a._bodyIndex;
    world.removeRigidBody(a);
    // The worker has not drained the REMOVE_BODY yet: the index stays booked.
    const b = spawnMissile(world);
    assert.notEqual(b._bodyIndex, index, 'index reused before the worker applied the removal');
    h.tick();
    const c = spawnMissile(world);
    assert.equal(c._bodyIndex, index, 'index recycled once acked');
}

async function testStaleProxyNeverObservesSuccessor() {
    const h = await makeWorker();
    const world = h.game.world;
    const a = spawnMissile(world, -20);
    for (let i = 0; i < 4; i++) h.tick();
    const frozen = a.translation();
    world.removeRigidBody(a);
    h.tick();

    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(30, 5, 30).setGravityScale(0));
    world.createCollider(RAPIER.ColliderDesc.ball(0.5), b);
    assert.equal(b._bodyIndex, a._bodyIndex, 'precondition: b reuses a\'s index');
    h.tick();

    assert.ok(!a.isValid(), 'removed proxy reports invalid');
    assert.ok(b.isValid());
    assert.deepEqual(a.translation(), frozen, 'stale proxy reads its last pose, not the new body');
    assert.deepEqual(h.backend.getRenderTransform(a).translation, frozen);
    const bPos = b.translation();
    assert.ok(Math.abs(bPos.x - 30) < 1e-4 && Math.abs(bPos.z - 30) < 1e-4, JSON.stringify(bPos));

    // Writes and a second remove through the stale proxy must not reach b.
    a.setLinvel({ x: 100, y: 0, z: 0 }, true);
    a.applyImpulse({ x: 100, y: 0, z: 0 }, true);
    world.removeRigidBody(a);
    h.tick();
    assert.ok(b.isValid(), 'stale remove did not remove the successor');
    assert.ok(Math.abs(b.linvel().x) < 1e-6, `stale write moved the successor: ${JSON.stringify(b.linvel())}`);
    assert.equal(h.sim.getWorld().bodies.len(), 2);
}

async function testFullTableStillRefuses() {
    const h = await makeWorker();
    const world = h.game.world;
    for (let i = 1; i < MAX_BODIES; i++) spawnMissile(world, i % 50);
    // All 1024 live: no wrap into the next slot.
    assert.throws(() => spawnMissile(world), RangeError);
}

async function testLayoutMismatchRejected() {
    // A worker built against an older layout stamps its own version.
    const fakeWorker = {
        listeners: new Set(),
        postMessage(msg) {
            if (msg.type !== WORKER_MSG.INIT_BUFFERS) return;
            createTransformViews(msg.transformSab).u32[TRANSFORM_HEADER_LAYOUT_VERSION] = SNAPSHOT_LAYOUT_VERSION - 1;
            queueMicrotask(() => { for (const fn of this.listeners) fn({ data: { type: WORKER_MSG.WORKER_READY } }); });
        },
        addEventListener(_t, fn) { this.listeners.add(fn); },
        removeEventListener(_t, fn) { this.listeners.delete(fn); },
        terminate() {},
    };
    const backend = new WorkerPhysicsBackend({ physicsWorld: { step() {}, init() {} } });
    await assert.rejects(backend.init(GRAVITY, { createWorker: () => fakeWorker }), /snapshot layout v3, expected v4/);
    assert.equal(backend._ready, false, 'mismatched worker never becomes ready (caller falls back to main thread)');
}

/**
 * `?hostAuth=1` Party Race host. One remote player holds forward for 1 s.
 * HostSim must never step the world itself; the frame loop's single clock
 * does (worker: its 120 Hz FixedStepClock; main: 60 Hz `physicsWorld.step`).
 */
function hostGame(game) {
    Object.assign(game, {
        network: {
            isHost: true,
            playerId: 'host',
            room: null,
            _remoteInputBuffers: new Map([['guest', [{ bits: 1, yaw: 0 }]]]),
        },
        keys: {},
        levelStartTime: 1,
        networkMarbles: new Map(),
        dynamicBodies: new Set(),
    });
    let hostSimSteps = 0;
    const realStep = game.physicsWorld.step.bind(game.physicsWorld);
    let inHostSim = false;
    game.physicsWorld.step = () => { if (inHostSim) hostSimSteps++; realStep(); };
    const hostSim = new HostSim(game);
    hostSim.active = true;
    return {
        hostSim,
        tick(now) { inHostSim = true; try { hostSim.tick(now); } finally { inHostSim = false; } },
        get hostSimSteps() { return hostSimSteps; },
    };
}

function addNetworkMarble(game, playerId, x) {
    const rb = game.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.0, 0).setCanSleep(false).setCcdEnabled(true),
    );
    game.world.createCollider(RAPIER.ColliderDesc.ball(0.5).setRestitution(0.5).setFriction(0.5).setDensity(1), rb);
    game.networkMarbles.set(playerId, { rigidBody: rb });
    return rb;
}

async function runHostOnWorker(frames) {
    const h = await makeWorker();
    const host = hostGame(h.game);
    const guest = addNetworkMarble(h.game, 'guest', 0);
    addNetworkMarble(h.game, 'host', 5);
    let worldSteps = 0;
    const w = h.sim.getWorld();
    const realWorldStep = w.step.bind(w);
    w.step = () => { worldSteps++; realWorldStep(); };
    h.tick();
    worldSteps = 0;
    for (let f = 0; f < frames; f++) {
        // Frame loop: HostSim queues inputs, the worker's 120 Hz clock steps
        // twice per 60 Hz frame, `physicsWorld.step()` just drains/reclaims.
        h.game.simDt = 1 / 60;
        host.tick(f * 16);
        h.tick();
        h.tick();
    }
    return { v: guest.linvel(), hostSimSteps: host.hostSimSteps, worldSteps };
}

function runHostOnMain(frames) {
    const world = new RAPIER.World(GRAVITY);
    createBodyFromDescriptor(world, FLOOR);
    const game = { world, physicsClock: new FixedStepClock() };
    game.physicsWorld = new PhysicsWorld(game);
    game.physicsBackend = new MainThreadPhysicsBackend(game);
    const host = hostGame(game);
    const guest = addNetworkMarble(game, 'guest', 0);
    addNetworkMarble(game, 'host', 5);
    world.step();
    let loopSteps = 0;
    for (let f = 0; f < frames; f++) {
        const n = game.physicsClock.advance(1 / 60);
        game.simDt = game.physicsClock.lastSimDt;
        host.tick(f * 16);
        for (let i = 0; i < n; i++) { game.physicsWorld.step(); loopSteps++; }
    }
    return { v: guest.linvel(), hostSimSteps: host.hostSimSteps, loopSteps };
}

async function testHostSimOnWorkerClock() {
    const frames = 60;
    const worker = await runHostOnWorker(frames);
    const main = runHostOnMain(frames);

    assert.equal(worker.hostSimSteps, 0, 'HostSim must not step the world (worker)');
    assert.equal(main.hostSimSteps, 0, 'HostSim must not step the world (main)');
    // One clock: 120 Hz worker steps for 1 s of frames, not 120 + HostSim extras.
    assert.equal(worker.worldSteps, frames * 2);
    assert.equal(main.loopSteps, frames);

    // The same input applied on both backends: guest rolls +z at matching speed.
    assert.ok(main.v.z > 1, `main: guest did not move (${JSON.stringify(main.v)})`);
    assert.ok(worker.v.z > 1, `worker: guest did not move (${JSON.stringify(worker.v)})`);
    const rel = Math.abs(worker.v.z - main.v.z) / main.v.z;
    assert.ok(rel < 0.1, `worker vz ${worker.v.z} vs main vz ${main.v.z} (${(rel * 100).toFixed(1)}% apart)`);
}

await testSpawnDespawnBeyondMaxBodies();
await testNoReuseBeforeWorkerAck();
await testStaleProxyNeverObservesSuccessor();
await testFullTableStillRefuses();
await testLayoutMismatchRejected();
await testHostSimOnWorkerClock();

console.log('Physics worker slot recycling + host sim tests passed');

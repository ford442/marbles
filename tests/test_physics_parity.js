/**
 * Gameplay physics contract, run against both backends on headless Rapier:
 *   - main thread: a real `RAPIER.World`
 *   - worker: `WorkerPhysicsBackend` talking to the real worker state machine
 *     (`createWorkerSim`) in-process over SharedArrayBuffers, ticked manually
 *
 * Every scenario builds the same scene from the same body descriptors and
 * drives the real ability / input code (`triggerBlink`, `startGrapple`,
 * `InputSystem.isGrounded`, …), so a regression in either backend's raycast,
 * readback or time-scale path fails here.
 */
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBodyFromDescriptor } from '../src/game/physics-worker/world-builder.js';
import { createWorkerSim } from '../src/game/physics-worker/worker-sim.js';
import { WorkerPhysicsBackend, MainThreadPhysicsBackend } from '../src/game/systems/physics-backend.ts';
import { GamePhysicsQueries } from '../src/game/systems/physics-queries.ts';
import { FixedStepClock } from '../src/game/systems/fixed-step-clock.ts';
import { InputSystem } from '../src/game/systems/input-system.ts';
import { MarbleRegistry } from '../src/game/systems/marble-registry.js';
import { AbilityBlink } from '../src/abilities/blink.js';
import { AbilityDoubleJump } from '../src/abilities/double-jump.js';
import { AbilityMissiles } from '../src/abilities/missiles.js';
import { ZoneSetupGrapple } from '../src/zone-setup/grapple.js';

await RAPIER.init();

const GRAVITY = { x: 0, y: -9.81, z: 0 };
/** The default player marble (Juggernaut Prism): r 1.2, density 100 → mass ≈ 724. */
const PLAYER_RADIUS = 1.2;
const PLAYER_SCALE = PLAYER_RADIUS / 0.5;
const PLAYER_REST_Y = 0.5 + PLAYER_RADIUS;
const WALL_Z = 8;

const SCENE = {
    floor: { type: 'fixed', translation: [0, 0, 0], collider: { type: 'cuboid', halfExtents: [40, 0.5, 40] } },
    // 0.1 m thick wall straight ahead (+z) of the player.
    wall: { type: 'fixed', translation: [0, 3, WALL_Z], collider: { type: 'cuboid', halfExtents: [10, 3, 0.05] } },
    // Light dynamic crate to the player's right (+x): a grapple-yank target.
    crate: {
        type: 'dynamic',
        translation: [6, 1.5, 0],
        collider: { type: 'cuboid', halfExtents: [1, 1, 1], density: 1 },
    },
    player: {
        type: 'dynamic',
        translation: [0, PLAYER_REST_Y, 0],
        canSleep: false,
        ccd: true,
        collider: { type: 'ball', radius: PLAYER_RADIUS, density: 100, restitution: 0 },
    },
};

const quietConsole = (fn) => {
    const log = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = log; }
};

function makeMainHarness() {
    const world = new RAPIER.World(GRAVITY);
    const bodies = {};
    for (const [name, desc] of Object.entries(SCENE)) bodies[name] = createBodyFromDescriptor(world, desc);

    const game = { world, physicsClock: new FixedStepClock() };
    game.physicsWorld = { step() { world.timestep = game.physicsClock.step; world.step(); }, init() {} };
    game.physicsBackend = new MainThreadPhysicsBackend(game);
    game.physicsQueries = new GamePhysicsQueries(game);

    return {
        name: 'main',
        game,
        bodies,
        stepTime(seconds) {
            const steps = Math.round(seconds / game.physicsClock.step);
            for (let i = 0; i < steps; i++) game.physicsWorld.step();
        },
        setTimeScale(scale) { game.physicsBackend.setTimeScale(scale); },
        /** Wall time → simulated time through the clock (the main loop's contract). */
        runWallClock(seconds) {
            const clock = game.physicsClock;
            const before = clock.simTime;
            for (let f = 0; f < Math.round(seconds * 60); f++) {
                const n = clock.advance(1 / 60);
                for (let i = 0; i < n; i++) game.physicsWorld.step();
            }
            return clock.simTime - before;
        },
        createRigidBody: (desc) => world.createRigidBody(desc),
        createCollider: (desc, body) => world.createCollider(desc, body),
    };
}

async function makeWorkerHarness() {
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

    const game = {
        physicsClock: new FixedStepClock(),
        physicsWorld: { step() {}, init() {} },
    };
    const backend = new WorkerPhysicsBackend(game);
    await backend.init(GRAVITY, { createWorker: () => fakeWorker });
    game.physicsBackend = backend;
    backend.beginLevel('parity');

    const bodies = {};
    for (const [name, desc] of Object.entries(SCENE)) bodies[name] = backend.registerBody(desc);
    await backend.commitWorldBuild();
    game.physicsQueries = new GamePhysicsQueries(game);

    const tickMs = 1000 / backend.physicsHz;
    const tick = () => { fakeNow += tickMs; sim.tick(); };

    return {
        name: 'worker',
        game,
        bodies,
        sim,
        stepTime(seconds) {
            const ticks = Math.round(seconds * backend.physicsHz);
            for (let i = 0; i < ticks; i++) tick();
        },
        setTimeScale(scale) { backend.setTimeScale(scale); },
        runWallClock(seconds) {
            const clock = sim.getClock();
            const before = clock.simTime;
            for (let i = 0; i < Math.round(seconds * backend.physicsHz); i++) tick();
            return clock.simTime - before;
        },
        createRigidBody: (desc) => game.world.createRigidBody(desc),
        createCollider: (desc, body) => game.world.createCollider(desc, body),
    };
}

/** Minimal game object the mixin methods run against. */
function mixinGame(h, overrides = {}) {
    return {
        physicsQueries: h.game.physicsQueries,
        world: h.game.world,
        playerMarble: { rigidBody: h.bodies.player, scale: PLAYER_SCALE },
        aimYaw: 0,
        pitchAngle: 0,
        simDt: 1 / 60,
        spawnBlinkParticle() {},
        awardTrickPoints() {},
        cancelGrapple() { ZoneSetupGrapple.prototype.cancelGrapple.call(this); },
        ...overrides,
    };
}

function assertFiniteVec(v, label) {
    assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z), `${label} not finite: ${JSON.stringify(v)}`);
}

function resetPlayer(h, pos = { x: 0, y: PLAYER_REST_Y, z: 0 }) {
    const rb = h.bodies.player;
    rb.setTranslation(pos, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

function testGrounding(h) {
    const input = new InputSystem(h.game);
    const marble = { rigidBody: h.bodies.player, scale: PLAYER_SCALE };

    h.stepTime(0.25);
    assert.equal(input.isGrounded(marble), true, `${h.name}: resting on the floor is grounded`);

    resetPlayer(h, { x: 0, y: 10, z: 0 });
    h.stepTime(1 / 60);
    assert.equal(input.isGrounded(marble), false, `${h.name}: in the air is not grounded`);
}

function testVelocityReadback(h) {
    resetPlayer(h, { x: 0, y: 30, z: 0 });
    h.stepTime(0.5);
    const rb = h.bodies.player;
    const v = rb.linvel();
    assert.ok(v.y < -3, `${h.name}: falling body reports real velocity (got ${v.y})`);
    assert.ok(Math.abs(rb.mass() - 723.82) < 0.5, `${h.name}: mass readback (got ${rb.mass()})`);
    assertFiniteVec(rb.angvel(), `${h.name} angvel`);
}

function testBlinkTargetFinite(h) {
    resetPlayer(h);
    h.stepTime(0.1);
    const g = mixinGame(h, { lastBlinkTime: 0, blinkCooldown: 0, aimYaw: 0 });
    quietConsole(() => AbilityBlink.prototype.triggerBlink.call(g));
    h.stepTime(1 / 60);

    const t = h.bodies.player.translation();
    assertFiniteVec(t, `${h.name}: blink target`);
    // Ray hits the wall face at z = 7.95; blink stops radius + 0.1 short.
    const expectedZ = WALL_Z - 0.05 - PLAYER_RADIUS - 0.1;
    assert.ok(Math.abs(t.z - expectedZ) < 0.15, `${h.name}: blink stops before the wall (z=${t.z}, want ≈${expectedZ})`);
}

function testGrappleNeverTargetsCaster(h) {
    resetPlayer(h);
    h.stepTime(0.1);
    const crate = h.bodies.crate;

    // Aim at the crate (+x).
    const g = mixinGame(h, { aimYaw: Math.PI / 2, grappleMaxDist: 50 });
    quietConsole(() => ZoneSetupGrapple.prototype.startGrapple.call(g));
    assert.equal(g.isGrappling, true, `${h.name}: grapple attached`);
    assert.notEqual(g.grappleTargetBody, h.bodies.player, `${h.name}: grapple target is not the caster`);
    assert.equal(g.grappleTargetBody, crate, `${h.name}: grapple yanks the dynamic crate`);
    assertFiniteVec(g.grappleTarget, `${h.name}: grapple anchor`);
    assert.ok(Number.isFinite(g.grappleRestLength) && g.grappleRestLength > 0);

    // Reel in hard: the spring pulls player and crate toward each other.
    g.grappleRestLength = 1;
    for (let i = 0; i < 12; i++) {
        ZoneSetupGrapple.prototype.updateGrapple.call(g);
        h.stepTime(1 / 60);
    }
    assert.ok(h.bodies.player.linvel().x > 0.5, `${h.name}: player pulled toward crate (vx=${h.bodies.player.linvel().x})`);
    assert.ok(crate.linvel().x < -0.5, `${h.name}: crate yanked toward player (vx=${crate.linvel().x})`);
    ZoneSetupGrapple.prototype.cancelGrapple.call(g);

    // Aim straight down: the floor is a fixed anchor, not a yank target.
    resetPlayer(h);
    h.stepTime(1 / 60);
    const down = mixinGame(h, { pitchAngle: -Math.PI / 2 + 1e-3, grappleMaxDist: 50 });
    quietConsole(() => ZoneSetupGrapple.prototype.startGrapple.call(down));
    assert.equal(down.isGrappling, true, `${h.name}: floor grapple attached`);
    assert.equal(down.grappleTargetBody, null, `${h.name}: fixed body is an anchor`);
    assert.ok(Math.abs(down.grappleTarget.y - 0.5) < 0.05, `${h.name}: anchor on the floor surface`);
}

function testDoubleJump(h) {
    resetPlayer(h, { x: 0, y: 20, z: 0 });
    h.stepTime(0.3); // falling
    const rb = h.bodies.player;
    const before = rb.linvel().y;
    assert.ok(before < 0);

    const g = mixinGame(h, { hasDoubleJumped: false });
    AbilityDoubleJump.prototype.executeDoubleJump.call(g);
    h.stepTime(1 / 60);
    const dv = rb.linvel().y - Math.max(0, before);
    assert.ok(dv >= 4, `${h.name}: double jump Δv ${dv.toFixed(2)} m/s on the default marble`);
    assert.equal(g.hasDoubleJumped, true);

    // A second press in the same airtime does nothing.
    const vy = rb.linvel().y;
    AbilityDoubleJump.prototype.executeDoubleJump.call(g);
    h.stepTime(1 / 60);
    assert.ok(rb.linvel().y < vy, `${h.name}: no second double jump`);

    // Landing clears it: `updateGameState` resets `hasDoubleJumped` whenever
    // `isGrounded(player)` holds, so the probe must flip from air to ground.
    const input = new InputSystem(h.game);
    assert.equal(input.isGrounded(g.playerMarble), false, `${h.name}: airborne after double jump`);
    h.stepTime(4);
    assert.equal(input.isGrounded(g.playerMarble), true, `${h.name}: grounded after landing`);

    // Respawn clears it.
    g.hasDoubleJumped = true;
    new MarbleRegistry(g).resetPlayerAbilityState();
    assert.equal(g.hasDoubleJumped, false, `${h.name}: respawn resets double jump`);
}

function testMissileDoesNotTunnel(h) {
    resetPlayer(h);
    h.stepTime(0.1);
    const g = mixinGame(h, {
        aimYaw: 0, // +z, at the 0.1 m wall
        lastMissileTime: 0,
        missileCooldown: 0,
        activeMissiles: [],
        dynamicBodies: new Set(),
        effectPool: {
            budget: { canSpawnProjectile: () => true },
            acquireProjectile: () => ({ entity: 1 }),
            bindProjectileLight() {},
        },
    });
    AbilityMissiles.prototype.spawnMissile.call(g);
    assert.equal(g.activeMissiles.length, 1);
    const missile = g.activeMissiles[0].rigidBody;
    h.stepTime(1 / 60);
    assert.ok(missile.linvel().z > 30, `${h.name}: missile fired at ~40 m/s (vz=${missile.linvel().z})`);

    h.stepTime(0.5);
    const z = missile.translation().z;
    assert.ok(z < WALL_Z, `${h.name}: 40 m/s missile stopped by the 0.1 m wall (z=${z})`);
}

function testTimeScale(h) {
    h.setTimeScale(1);
    const normal = h.runWallClock(1);
    h.setTimeScale(0.2);
    const slow = h.runWallClock(1);
    h.setTimeScale(1);
    assert.ok(Math.abs(normal - 1) < 0.02, `${h.name}: 1 s wall → ${normal} s sim`);
    assert.ok(Math.abs(slow - 0.2) < 0.02, `${h.name}: slow-mo 0.2× → ${slow} s sim`);
}

function testCcdControl() {
    // Control for testMissileDoesNotTunnel: the same missile without CCD does
    // pass through the wall, so the assertion above is meaningful.
    const world = new RAPIER.World(GRAVITY);
    createBodyFromDescriptor(world, SCENE.wall);
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.7, 1.5).setLinvel(0, 0, 40).setGravityScale(0),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.2).setDensity(0.5), body);
    for (let i = 0; i < 30; i++) world.step();
    assert.ok(body.translation().z > WALL_Z, 'without CCD the missile tunnels (control)');
}

const SCENARIOS = [
    testGrounding,
    testVelocityReadback,
    testBlinkTargetFinite,
    testGrappleNeverTargetsCaster,
    testDoubleJump,
    testMissileDoesNotTunnel,
    testTimeScale,
];

for (const make of [makeMainHarness, makeWorkerHarness]) {
    for (const scenario of SCENARIOS) {
        // Fresh world per scenario so state can't leak between them.
        const h = await make();
        try {
            scenario(h);
        } catch (err) {
            err.message = `[${h.name}] ${scenario.name}: ${err.message}`;
            throw err;
        }
    }
}
testCcdControl();

console.log('Physics parity tests passed (main + worker)');

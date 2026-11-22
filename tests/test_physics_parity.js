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
import { AbilitySystem } from '../src/game/systems/ability-system.ts';
import { HOVER_DRAIN_PER_SEC, HOVER_GRAVITY_FACTOR, HOVER_LIFT_ACCEL } from '../src/abilities/hover.js';
import { MarbleRegistry } from '../src/game/systems/marble-registry.js';
import { AbilityBlink } from '../src/abilities/blink.ts';
import { AbilityDoubleJump } from '../src/abilities/double-jump.ts';
import { AbilityMissiles } from '../src/abilities/missiles.ts';
import { ZoneSetupGrapple } from '../src/zone-setup/grapple.ts';

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
    // Sensor volume well away from the other scenarios: rays must be able to skip it.
    trigger: { type: 'fixed', translation: [-12, 4, -12], collider: { type: 'sensor_ball', radius: 1 } },
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
        /** `n` whole fixed steps; `before(dt)` is the registry tick `sync.js` runs ahead of each. */
        fixedSteps(n, before) {
            for (let i = 0; i < n; i++) {
                before(game.physicsClock.step);
                game.physicsWorld.step();
            }
        },
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
        /**
         * `n` fixed steps of the main-thread clock (1/60 s, what `sync.js` ticks
         * per `physicsSubsteps`). The worker's own clock steps at `physicsHz`
         * (120), polled once per step, so one main step is `physicsHz * step`
         * polls; commands queued by `before` drain at the first poll.
         */
        fixedSteps(n, before) {
            const step = game.physicsClock.step;
            const polls = Math.round(backend.physicsHz * step);
            for (let i = 0; i < n; i++) {
                before(step);
                for (let p = 0; p < polls; p++) tick();
            }
        },
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
        cancelGrapple() { new ZoneSetupGrapple(this).cancelGrapple(); },
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
    quietConsole(() => new AbilityBlink(g).triggerBlink());
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
    quietConsole(() => new ZoneSetupGrapple(g).startGrapple());
    assert.equal(g.isGrappling, true, `${h.name}: grapple attached`);
    assert.notEqual(g.grappleTargetBody, h.bodies.player, `${h.name}: grapple target is not the caster`);
    assert.equal(g.grappleTargetBody, crate, `${h.name}: grapple yanks the dynamic crate`);
    assertFiniteVec(g.grappleTarget, `${h.name}: grapple anchor`);
    assert.ok(Number.isFinite(g.grappleRestLength) && g.grappleRestLength > 0);

    // Reel in hard: the spring pulls player and crate toward each other.
    g.grappleRestLength = 1;
    for (let i = 0; i < 12; i++) {
        new ZoneSetupGrapple(g).updateGrapple();
        h.stepTime(1 / 60);
    }
    assert.ok(h.bodies.player.linvel().x > 0.5, `${h.name}: player pulled toward crate (vx=${h.bodies.player.linvel().x})`);
    assert.ok(crate.linvel().x < -0.5, `${h.name}: crate yanked toward player (vx=${crate.linvel().x})`);
    new ZoneSetupGrapple(g).cancelGrapple();

    // Aim straight down: the floor is a fixed anchor, not a yank target.
    resetPlayer(h);
    h.stepTime(1 / 60);
    const down = mixinGame(h, { pitchAngle: -Math.PI / 2 + 1e-3, grappleMaxDist: 50 });
    quietConsole(() => new ZoneSetupGrapple(down).startGrapple());
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
    new AbilityDoubleJump(g).executeDoubleJump();
    h.stepTime(1 / 60);
    const dv = rb.linvel().y - Math.max(0, before);
    assert.ok(dv >= 4, `${h.name}: double jump Δv ${dv.toFixed(2)} m/s on the default marble`);
    assert.equal(g.hasDoubleJumped, true);

    // A second press in the same airtime does nothing.
    const vy = rb.linvel().y;
    new AbilityDoubleJump(g).executeDoubleJump();
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
    new AbilityMissiles(g).spawnMissile();
    assert.equal(g.activeMissiles.length, 1);
    const missile = g.activeMissiles[0].rigidBody;
    h.stepTime(1 / 60);
    assert.ok(missile.linvel().z > 30, `${h.name}: missile fired at ~40 m/s (vz=${missile.linvel().z})`);

    h.stepTime(0.5);
    const z = missile.translation().z;
    assert.ok(z < WALL_Z, `${h.name}: 40 m/s missile stopped by the 0.1 m wall (z=${z})`);
}

/**
 * Hover runs on the fixed step: engage lowers the gravity scale and arrests the
 * fall, lift is a mass-independent acceleration, energy drains per step, and
 * running dry (or release) restores the gravity scale. Identical on both backends.
 */
function testHover(h) {
    resetPlayer(h, { x: 0, y: 15, z: 0 });
    const rb = h.bodies.player;
    const g = mixinGame(h, {
        hoverActive: false, hoverEnergy: 100, maxHoverEnergy: 100, hoverSavedGravity: null,
    });
    const system = new AbilitySystem(g);
    system.init();
    g.abilitySystem = system;
    const stepSec = 1 / 60;
    const tick = (dt) => system.tickFixedStep(dt);

    // Fall for 0.3 s so there is velocity to arrest.
    h.stepTime(0.3);
    assert.ok(rb.linvel().y < -2, `${h.name}: falling before hover (vy=${rb.linvel().y})`);

    assert.equal(system.handleKeyDown('KeyH'), true);
    assert.equal(g.hoverActive, true, `${h.name}: press engages`);
    assert.equal(g.hoverSavedGravity, null, `${h.name}: gravity untouched until the first fixed step`);

    h.fixedSteps(1, tick);
    assert.ok(Math.abs(rb.gravityScale() - HOVER_GRAVITY_FACTOR) < 1e-6, `${h.name}: gravity scale lowered on the fixed step`);
    assert.equal(g.hoverSavedGravity, 1);
    assert.ok(Math.abs(g.hoverEnergy - (100 - HOVER_DRAIN_PER_SEC * stepSec)) < 1e-9, `${h.name}: one step drains one step of energy`);

    // 30 steps (0.5 s): fall arrested, then a mass-independent slow rise at
    // (lift - reduced gravity) ≈ 4.02 m/s² on the 724 kg default marble.
    h.fixedSteps(29, tick);
    const expectedVy = (HOVER_LIFT_ACCEL - 9.81 * HOVER_GRAVITY_FACTOR) * 30 * stepSec;
    const vy = rb.linvel().y;
    assert.ok(Math.abs(vy - expectedVy) < 0.4, `${h.name}: hover rise vy=${vy.toFixed(2)}, want ≈${expectedVy.toFixed(2)}`);
    const expectedEnergy = 100 - HOVER_DRAIN_PER_SEC * 30 * stepSec;
    assert.ok(Math.abs(g.hoverEnergy - expectedEnergy) < 1e-6, `${h.name}: energy ${g.hoverEnergy} want ${expectedEnergy}`);

    // Release restores gravity at once and energy regenerates per step.
    system.handleKeyUp('KeyH');
    assert.equal(g.hoverActive, false);
    assert.equal(rb.gravityScale(), 1, `${h.name}: release restores gravity`);
    const spent = g.hoverEnergy;
    h.fixedSteps(60, tick);
    assert.ok(g.hoverEnergy > spent + 20, `${h.name}: energy regenerates (${spent} → ${g.hoverEnergy})`);

    // Held to exhaustion (2 s from full): hover ends itself and gravity returns.
    g.hoverEnergy = 100;
    resetPlayer(h, { x: 0, y: 40, z: 0 });
    system.handleKeyUp('KeyH');
    system.handleKeyDown('KeyH');
    h.fixedSteps(125, tick);
    assert.equal(g.hoverActive, false, `${h.name}: hover ends when energy runs out`);
    assert.equal(rb.gravityScale(), 1, `${h.name}: gravity restored after exhaustion`);
    assert.equal(g.hoverSavedGravity, null);

    // Respawn mid-hover clears it.
    g.hoverEnergy = 100;
    system.handleKeyUp('KeyH');
    system.handleKeyDown('KeyH');
    h.fixedSteps(3, tick);
    assert.ok(Math.abs(rb.gravityScale() - HOVER_GRAVITY_FACTOR) < 1e-6);
    new MarbleRegistry(g).resetPlayerAbilityState();
    assert.equal(g.hoverActive, false, `${h.name}: respawn drops hover`);
    assert.equal(rb.gravityScale(), 1, `${h.name}: respawn restores gravity`);
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

/**
 * The `RayQueryOptions` contract (toi units, self-hit, filters), identical on
 * both backends. The filter half pins a Rapier 0.13 → 0.21 change: 0.13's JS
 * `QueryFilterFlags` were one bit off, so `excludeSensors` really excluded
 * dynamic bodies and still hit sensors.
 */
function testRayQueryContract(h) {
    resetPlayer(h);
    h.stepTime(0.25);
    const queries = h.game.physicsQueries;
    const DOWN = { x: 0, y: -1, z: 0 };
    const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-3, `${h.name}: ${label} (got ${a}, want ${b})`);

    // toi is in units of |dir|, and point = origin + dir * toi.
    const floorFrom = { x: 20, y: 10, z: 20 };
    const unit = queries.castRay(floorFrom, DOWN, 100);
    near(unit.toi, 9.5, 'floor toi');
    assert.equal(unit.bodyType, 'fixed', `${h.name}: floor is fixed`);
    near(unit.point.y, 0.5, 'hit point on the floor surface');
    near(unit.normal.y, 1, 'floor normal');
    const doubled = queries.castRay(floorFrom, { x: 0, y: -2, z: 0 }, 100);
    near(doubled.toi, 4.75, 'toi scales with 1/|dir|');
    near(doubled.point.y, 0.5, 'point uses dir * toi');
    assert.equal(queries.castRay(floorFrom, DOWN, 9.4), null, `${h.name}: maxToi bounds the ray`);

    // Self-hit: a solid ray from inside the caster hits it at toi 0 unless excluded.
    const centre = h.bodies.player.translation();
    const self = queries.castRay(centre, DOWN, 100);
    assert.equal(self.body, h.bodies.player, `${h.name}: unfiltered ray from the centre hits the caster`);
    near(self.toi, 0, 'self-hit toi');
    const below = queries.castRay(centre, DOWN, 100, { excludeBody: h.bodies.player });
    assert.equal(below.bodyType, 'fixed', `${h.name}: excludeBody skips the caster`);
    near(below.toi, PLAYER_RADIUS, 'ground distance from the centre');
    // Sideways, so the caster's boundary doesn't tie with the floor it rests on.
    const hollow = queries.castRay(centre, { x: -1, y: 0, z: 0 }, 100, { solid: false });
    assert.equal(hollow.body, h.bodies.player, `${h.name}: solid:false hits the caster's own boundary`);
    near(hollow.toi, PLAYER_RADIUS, 'solid:false toi from the centre');

    // Sensors: hit by default, skipped by excludeSensors (also when the ray starts inside one).
    const aboveTrigger = { x: -12, y: 10, z: -12 };
    const sensorHit = queries.castRay(aboveTrigger, DOWN, 100);
    near(sensorHit.toi, 5, 'default ray stops at the sensor');
    assert.equal(sensorHit.body, h.bodies.trigger, `${h.name}: sensor hit names its body`);
    near(queries.castRay(aboveTrigger, DOWN, 100, { excludeSensors: true }).toi, 9.5, 'excludeSensors reaches the floor');
    near(queries.castRay({ x: -12, y: 4, z: -12 }, DOWN, 100, { excludeSensors: true }).toi, 3.5, 'excludeSensors from inside a sensor');

    // Dynamic bodies: still hit with excludeSensors, skipped only by excludeDynamic.
    const aboveCrate = { x: 6, y: 10, z: 0 };
    for (const opts of [undefined, { excludeSensors: true }]) {
        const hit = queries.castRay(aboveCrate, DOWN, 100, opts);
        assert.equal(hit.body, h.bodies.crate, `${h.name}: ${JSON.stringify(opts)} hits the dynamic crate`);
        assert.equal(hit.bodyType, 'dynamic');
        near(hit.toi, 7.5, 'crate top');
    }
    const past = queries.castRay(aboveCrate, DOWN, 100, { excludeSensors: true, excludeDynamic: true });
    assert.equal(past.bodyType, 'fixed', `${h.name}: excludeDynamic skips the crate`);
    near(past.toi, 9.5, 'excludeDynamic reaches the floor');
}

/**
 * Control for testMissileDoesNotTunnel: the same missile without CCD passes
 * through a thin plate, so the CCD flag is what stops it.
 *
 * The plate is dynamic. Since Rapier 0.21 a fast body is stopped by a thin
 * *fixed* wall even without CCD (the 0.13 control tunnelled there), so only a
 * dynamic target still tells the two apart.
 */
function testCcdControl() {
    const PLATE_Z = 8;
    const fire = (ccd) => {
        const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
        const plate = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.7, PLATE_Z));
        world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.05).setDensity(50), plate);
        const body = world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.7, 1.5).setLinvel(0, 0, 40).setCcdEnabled(ccd),
        );
        world.createCollider(RAPIER.ColliderDesc.ball(0.2).setDensity(0.5), body);
        for (let i = 0; i < 30; i++) world.step();
        return { z: body.translation().z, plateVz: plate.linvel().z };
    };
    const off = fire(false);
    assert.ok(off.z > PLATE_Z + 5 && off.plateVz === 0, `without CCD the missile tunnels a thin dynamic plate (control, z=${off.z})`);
    const on = fire(true);
    assert.ok(on.z < PLATE_Z + 1 && on.plateVz > 0, `with CCD the same missile hits the plate (z=${on.z})`);

    // Fixed thin walls stop it either way on this Rapier.
    const world = new RAPIER.World(GRAVITY);
    createBodyFromDescriptor(world, SCENE.wall);
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.7, 1.5).setLinvel(0, 0, 40).setGravityScale(0),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.2).setDensity(0.5), body);
    for (let i = 0; i < 30; i++) world.step();
    assert.ok(body.translation().z < WALL_Z, 'a thin fixed wall stops the missile even without CCD');
}

const SCENARIOS = [
    testGrounding,
    testRayQueryContract,
    testVelocityReadback,
    testBlinkTargetFinite,
    testGrappleNeverTargetsCaster,
    testDoubleJump,
    testMissileDoesNotTunnel,
    testHover,
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

/**
 * Seeded physics scenario for the determinism checks.
 *
 * One scene and one input stream, generated from a seed, are run through the
 * game's two physics backends:
 *   - main thread: `PhysicsWorld` + `MainThreadPhysicsBackend` on a real `RAPIER.World`
 *   - worker: `WorkerPhysicsBackend` + proxy world, talking to the real worker
 *     state machine (`createWorkerSim`) in-process over SharedArrayBuffers
 *
 * After every fixed step the Rapier world is serialised (`takeSnapshot()`)
 * and hashed. Same build + same seed must give the same hash on every step,
 * on both backends, in Node and in the browser (`tests/test_physics_determinism.js`,
 * `tests/e2e/determinism.mjs`).
 *
 * The input stream only uses IEEE-exact arithmetic (+ − × ÷ √): `Math.sin`
 * and friends are allowed to differ in the last bit between JS engines, which
 * would make the *inputs* differ rather than the simulation.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { createWorkerSim } from '../../src/game/physics-worker/worker-sim.js';
import { WorkerPhysicsBackend, MainThreadPhysicsBackend } from '../../src/game/systems/physics-backend.ts';
import { GamePhysicsQueries } from '../../src/game/systems/physics-queries.ts';
import { FixedStepClock } from '../../src/game/systems/fixed-step-clock.ts';
import { PhysicsWorld } from '../../src/game/systems/physics-world.ts';

export const GRAVITY = Object.freeze({ x: 0, y: -9.81, z: 0 });
export const DEFAULT_SEED = 0x5eed2026;
export const DEFAULT_STEPS = 480;

/** Small seeded PRNG (integer arithmetic only, so every engine agrees). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Unit quaternion from four seeded components (√ only). */
function seededQuat(rnd) {
    const q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() + 0.25];
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    return { x: q[0] / len, y: q[1] / len, z: q[2] / len, w: q[3] / len };
}

/** Triangle wave in [-1, 1] with the given period (in steps). */
function triangle(step, period) {
    const phase = (step % period) / period;
    return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
}

// ── Harnesses ────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Harness
 * @property {'main' | 'worker'} name
 * @property {number} hz
 * @property {any} world game-facing world (`createRigidBody` / `createCollider` / `removeRigidBody`)
 * @property {import('../../src/game/systems/physics-queries.ts').PhysicsQueries} queries
 * @property {() => Promise<void>} commit level build finished
 * @property {() => void} step one fixed step
 * @property {() => import('@dimforge/rapier3d-compat').World} rapierWorld the simulated world
 */

/** @returns {Harness} */
export function createMainHarness({ hz }) {
    const game = { physicsClock: new FixedStepClock({ step: 1 / hz }) };
    game.physicsWorld = new PhysicsWorld(game);
    game.physicsBackend = new MainThreadPhysicsBackend(game);
    game.physicsBackend.init(GRAVITY);
    game.physicsWorld.init({ ...GRAVITY });
    const queries = new GamePhysicsQueries(game);
    return {
        name: 'main',
        hz,
        world: game.world,
        queries,
        commit: async () => {},
        step: () => game.physicsBackend.step(),
        rapierWorld: () => game.world,
    };
}

/** @returns {Promise<Harness>} */
export async function createWorkerHarness({ hz }) {
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
        physicsClock: new FixedStepClock({ step: 1 / hz }),
        physicsWorld: { step() {}, init() {} },
    };
    const backend = new WorkerPhysicsBackend(game);
    await backend.init({ ...GRAVITY }, { createWorker: () => fakeWorker, physicsHz: hz });
    game.physicsBackend = backend;
    backend.beginLevel('determinism');
    const queries = new GamePhysicsQueries(game);
    const tickMs = 1000 / hz;

    return {
        name: 'worker',
        hz,
        world: game.world,
        queries,
        commit: async () => { await backend.commitWorldBuild(); },
        step() {
            // Frame loop: `physicsWorld.step()` → `backend.step()` flushes the
            // ring; the worker's own timer then runs the fixed step.
            backend.step();
            fakeNow += tickMs;
            sim.tick();
            const ran = sim.getClock().lastSubsteps;
            if (ran !== 1) throw new Error(`worker harness: tick ran ${ran} fixed steps, expected exactly 1`);
        },
        rapierWorld: () => sim.getWorld(),
    };
}

// ── Scenario ─────────────────────────────────────────────────────────────────

const MARBLES = 10;
const PROJECTILE_EVERY = 24;
const PROJECTILE_LIFETIME = 60;
const ARENA = 22;

/**
 * Build the scene on `h` and return a function that applies one step's
 * inputs. The scene and the inputs depend only on `seed`, the step index and
 * values read back through the backend.
 * @param {Harness} h
 * @param {number} seed
 */
export async function buildScenario(h, seed) {
    const rnd = mulberry32(seed);
    const world = h.world;
    const body = (bodyDesc, colliderDesc) => {
        const rb = world.createRigidBody(bodyDesc);
        world.createCollider(colliderDesc, rb);
        return rb;
    };

    // Static geometry: floor, walls, a ramp, a bumpy trimesh patch, a sensor.
    body(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0), RAPIER.ColliderDesc.cuboid(ARENA, 0.5, ARENA).setFriction(0.7));
    for (const [x, z, hx, hz] of [[ARENA, 0, 0.5, ARENA], [-ARENA, 0, 0.5, ARENA], [0, ARENA, ARENA, 0.5], [0, -ARENA, ARENA, 0.5]]) {
        body(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 2, z), RAPIER.ColliderDesc.cuboid(hx, 2.5, hz).setRestitution(0.4));
    }
    // 20° about x: sin(10°), cos(10°) as literals.
    body(
        RAPIER.RigidBodyDesc.fixed().setTranslation(-10, 1.2, 8).setRotation({ x: 0.17364817766693033, y: 0, z: 0, w: 0.984807753012208 }),
        RAPIER.ColliderDesc.cuboid(4, 0.25, 6).setFriction(0.3),
    );
    {
        const n = 7;
        const vertices = [];
        const indices = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) vertices.push(i * 1.5, rnd() * 0.8, j * 1.5);
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - 1; j++) {
                const a = i * n + j;
                indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
            }
        }
        body(
            RAPIER.RigidBodyDesc.fixed().setTranslation(6, 0, -14),
            RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)).setFriction(0.5),
        );
    }
    body(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.5, 0), RAPIER.ColliderDesc.ball(3).setSensor(true));

    // A kinematic platform sweeping through the middle.
    const platform = body(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.6, -6),
        RAPIER.ColliderDesc.cuboid(3, 0.3, 1.5).setFriction(0.9),
    );

    // Marbles: reference-marble-like balls with varied material and damping.
    const marbles = [];
    for (let i = 0; i < MARBLES; i++) {
        const desc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation((i % 5) * 3 - 6 + rnd(), 1 + rnd() * 4, Math.floor(i / 5) * 4 - 2 + rnd())
            .setLinvel(rnd() * 4 - 2, 0, rnd() * 4 - 2)
            .setLinearDamping(i % 3 === 0 ? 0.1 : 0)
            .setAngularDamping(i % 4 === 0 ? 0.05 : 0)
            .setCcdEnabled(i % 2 === 0)
            .setCanSleep(i >= 5);
        if (i === 7) desc.setGravityScale(0.5);
        marbles.push(body(desc, RAPIER.ColliderDesc.ball(i === 0 ? 1.2 : 0.5)
            .setDensity(i === 0 ? 100 : 1.5)
            .setFriction(0.015 + rnd() * 0.6)
            .setRestitution(0.3 + rnd() * 0.6)));
    }

    // Props: boxes (a stack that can go to sleep), capsules, cylinders, cones.
    const props = [];
    for (let i = 0; i < 6; i++) {
        props.push(body(
            RAPIER.RigidBodyDesc.dynamic().setTranslation(12, 0.5 + i * 1.01, 12),
            RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setDensity(1).setFriction(0.6),
        ));
    }
    for (let i = 0; i < 6; i++) {
        const shape = i % 3 === 0 ? RAPIER.ColliderDesc.capsule(0.5, 0.3)
            : i % 3 === 1 ? RAPIER.ColliderDesc.cylinder(0.4, 0.5)
                : RAPIER.ColliderDesc.cone(0.5, 0.5);
        props.push(body(
            RAPIER.RigidBodyDesc.dynamic().setTranslation(-12 + i * 2, 3 + rnd() * 3, -8 + rnd() * 2).setRotation(seededQuat(rnd)),
            shape.setDensity(0.8 + rnd()).setFriction(0.4).setRestitution(0.2),
        ));
    }

    await h.commit();

    /** @type {Array<{ body: any, dieAt: number }>} */
    const projectiles = [];
    const player = marbles[0];
    const queries = h.queries;
    const DOWN = { x: 0, y: -1, z: 0 };

    /**
     * Apply step `s`'s inputs. Returns the numbers read back this step (ray
     * hits), which are hashed alongside the world.
     * @param {number} s
     * @returns {number[]}
     */
    return function applyInputs(s) {
        /** @type {number[]} */
        const observed = [];

        // Queries and readbacks first: they see the world as of the last step.
        const pp = player.translation();
        const pv = player.linvel();
        const ground = queries.castRay(pp, DOWN, 1.2 + 0.1, { excludeBody: player, excludeSensors: true });
        observed.push(ground ? ground.toi : -1, ground ? ground.point.y : 0);

        const tx = triangle(s, 300) * 14;
        const tz = triangle(s + 75, 420) * 14;
        const ex = tx - pp.x - pv.x * 0.4;
        const ez = tz - pp.z - pv.z * 0.4;
        const elen = Math.sqrt(ex * ex + ez * ez) || 1;
        const aim = { x: ex / elen, y: 0, z: ez / elen };

        let blinkTo = null;
        if (s % 97 === 96) {
            const hit = queries.castRay(pp, aim, 18, { excludeBody: player });
            observed.push(hit ? hit.toi : -1, hit ? hit.point.x : 0, hit ? hit.point.z : 0, hit?.normal ? hit.normal.x : 0);
            const d = hit ? Math.max(0, hit.toi - 1.3) : 6;
            blinkTo = { x: pp.x + aim.x * d, y: pp.y + 0.2, z: pp.z + aim.z * d };
        }

        // Creations before any queued command (the worker applies ADD_BODY on arrival).
        if (s % PROJECTILE_EVERY === 5) {
            const from = marbles[1 + ((s / PROJECTILE_EVERY) | 0) % (MARBLES - 1)].translation();
            const dx = rnd() - 0.5;
            const dz = rnd() - 0.5;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            const missile = body(
                RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(from.x + (dx / len) * 1.2, from.y + 0.6, from.z + (dz / len) * 1.2)
                    .setLinvel((dx / len) * 40, 0, (dz / len) * 40)
                    .setGravityScale(0)
                    .setCcdEnabled(true),
                RAPIER.ColliderDesc.ball(0.2).setDensity(0.5),
            );
            projectiles.push({ body: missile, dieAt: s + PROJECTILE_LIFETIME });
        }

        // Player: held-key style steering impulse, jumps, blink.
        player.applyImpulse({ x: aim.x * 360, y: 0, z: aim.z * 360 }, true);
        if (ground && s % 53 === 0) player.setLinvel({ x: pv.x, y: 6.5, z: pv.z }, true);
        if (blinkTo) player.setTranslation(blinkTo, true);

        // Everyone else: random shoves, spins, respawns and state toggles.
        for (let i = 1; i < MARBLES; i++) {
            const m = marbles[i];
            if (rnd() < 0.35) m.applyImpulse({ x: (rnd() - 0.5) * 0.9, y: 0, z: (rnd() - 0.5) * 0.9 }, true);
            if (rnd() < 0.1) m.applyTorqueImpulse({ x: (rnd() - 0.5) * 0.05, y: (rnd() - 0.5) * 0.05, z: (rnd() - 0.5) * 0.05 }, true);
            if (rnd() < 0.004) {
                m.setTranslation({ x: (rnd() - 0.5) * 20, y: 3 + rnd() * 5, z: (rnd() - 0.5) * 20 }, true);
                m.setLinvel({ x: 0, y: 0, z: 0 }, true);
                m.setAngvel({ x: rnd() * 6 - 3, y: 0, z: rnd() * 6 - 3 }, true);
                m.setRotation(seededQuat(rnd), true);
            }
            if (rnd() < 0.004) m.setGravityScale(rnd() < 0.5 ? -0.6 : 1, true);
            if (rnd() < 0.004) m.enableCcd(rnd() < 0.5);
        }
        if (s % 180 === 90) {
            // Knock the sleeping stack over.
            const top = props[5];
            if (top) top.applyImpulse({ x: -3, y: 1, z: -2 }, true);
        }

        platform.setNextKinematicTranslation({ x: triangle(s, 360) * 9, y: 0.6 + triangle(s, 150) * 0.4, z: -6 });
        const half = triangle(s, 600) * 0.15;
        const qlen = Math.sqrt(1 + half * half);
        platform.setNextKinematicRotation({ x: 0, y: half / qlen, z: 0, w: 1 / qlen });

        // Removals last, in the same order on both backends.
        while (projectiles.length && projectiles[0].dieAt <= s) {
            world.removeRigidBody(projectiles.shift().body);
        }
        return observed;
    };
}

// ── Hashing ──────────────────────────────────────────────────────────────────

/** Pose, velocities and sleep state of every body, in handle order, as raw f32 bits. */
export function bodyStateBytes(rapierWorld) {
    /** @type {number[]} */
    const out = [];
    rapierWorld.forEachRigidBody((rb) => {
        const t = rb.translation();
        const r = rb.rotation();
        const v = rb.linvel();
        const w = rb.angvel();
        out.push(rb.handle, t.x, t.y, t.z, r.x, r.y, r.z, r.w, v.x, v.y, v.z, w.x, w.y, w.z, rb.isSleeping() ? 1 : 0);
    });
    return new Uint8Array(new Float64Array(out).buffer);
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** SHA-256 of the concatenated chunks, as hex (Web Crypto: Node ≥ 20 and browsers). */
export async function sha256Hex(...chunks) {
    let length = 0;
    for (const c of chunks) length += c.byteLength;
    const all = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) { all.set(c, offset); offset += c.byteLength; }
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', all));
    let hex = '';
    for (const b of digest) hex += HEX[b];
    return hex;
}

/**
 * @typedef {object} StepRecord
 * @property {string} hash SHA-256 of the full Rapier snapshot + this step's readbacks
 * @property {string} stateHash SHA-256 of `bodyStateBytes` alone (narrows a mismatch)
 */

/**
 * Run the scenario on one harness.
 * @param {Harness} h
 * @param {{ seed?: number, steps?: number, onStep?: (s: number, rec: StepRecord, h: Harness) => void }} [options]
 * @returns {Promise<{ backend: string, hz: number, seed: number, steps: StepRecord[], digest: string }>}
 */
export async function runScenario(h, { seed = DEFAULT_SEED, steps = DEFAULT_STEPS, onStep } = {}) {
    const applyInputs = await buildScenario(h, seed);
    /** @type {StepRecord[]} */
    const records = [];
    for (let s = 0; s < steps; s++) {
        const observed = new Uint8Array(new Float64Array(applyInputs(s)).buffer);
        h.step();
        const world = h.rapierWorld();
        const rec = {
            hash: await sha256Hex(world.takeSnapshot(), observed),
            stateHash: await sha256Hex(bodyStateBytes(world), observed),
        };
        records.push(rec);
        onStep?.(s, rec, h);
    }
    const digest = await sha256Hex(new TextEncoder().encode(records.map((r) => r.hash).join('')));
    return { backend: h.name, hz: h.hz, seed, steps: records, digest };
}

/**
 * Both backends at `hz`, compared step by step.
 * @param {{ hz: number, seed?: number, steps?: number }} options
 */
export async function runBothBackends({ hz, seed = DEFAULT_SEED, steps = DEFAULT_STEPS }) {
    await RAPIER.init();
    const main = await runScenario(createMainHarness({ hz }), { seed, steps });
    const worker = await runScenario(await createWorkerHarness({ hz }), { seed, steps });
    let firstMismatch = -1;
    let stateMismatch = false;
    for (let s = 0; s < steps; s++) {
        if (main.steps[s].hash !== worker.steps[s].hash) {
            firstMismatch = s;
            stateMismatch = main.steps[s].stateHash !== worker.steps[s].stateHash;
            break;
        }
    }
    return { hz, seed, stepCount: steps, rapier: RAPIER.version(), main, worker, firstMismatch, stateMismatch };
}

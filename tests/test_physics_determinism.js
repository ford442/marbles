/**
 * Physics determinism: the same seed and inputs through the main-thread and
 * worker backends must leave the Rapier world in the same state, bit for bit,
 * after every fixed step (`tests/support/physics-determinism.js`).
 *
 * Three checks:
 *   1. main vs worker — SHA-256 of `world.takeSnapshot()` per step, at both
 *      tick rates the game uses (worker default 120 Hz, main thread 60 Hz).
 *   2. golden digest — the run's digest matches the one recorded in
 *      `tests/fixtures/physics-determinism.json`. A mismatch on an unchanged
 *      tree means this machine / runtime computed different bits from the
 *      one that recorded it, i.e. cross-machine determinism is broken.
 *   3. controls — a repeat run agrees, and a different seed does not.
 *
 * After a deliberate change (Rapier upgrade, scenario edit) re-record with
 *   node --experimental-strip-types tests/test_physics_determinism.js --update
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    DEFAULT_SEED, DEFAULT_STEPS, bodyStateBytes, createMainHarness, createWorkerHarness,
    buildScenario, runBothBackends, runScenario,
} from './support/physics-determinism.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/physics-determinism.json', import.meta.url));
const UPDATE = process.argv.includes('--update');
const RATES = [120, 60];

await RAPIER.init();

/** Re-run both backends in lockstep up to `step` and describe the first body that differs. */
async function describeMismatch(hz, step) {
    const main = createMainHarness({ hz });
    const worker = await createWorkerHarness({ hz });
    const inputs = [await buildScenario(main, DEFAULT_SEED), await buildScenario(worker, DEFAULT_SEED)];
    for (let s = 0; s <= step; s++) {
        inputs[0](s);
        inputs[1](s);
        main.step();
        worker.step();
    }
    const a = new Float64Array(bodyStateBytes(main.rapierWorld()).buffer);
    const b = new Float64Array(bodyStateBytes(worker.rapierWorld()).buffer);
    if (a.length !== b.length) return `body count differs (main ${a.length / 15}, worker ${b.length / 15})`;
    const FIELDS = ['handle', 'x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'vx', 'vy', 'vz', 'wx', 'wy', 'wz', 'sleeping'];
    for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) return `body #${(i / 15) | 0} ${FIELDS[i % 15]}: main ${a[i]} vs worker ${b[i]}`;
    }
    return 'body poses and velocities match; the snapshots differ in solver / broad-phase internals';
}

const digests = {};
for (const hz of RATES) {
    const r = await runBothBackends({ hz });
    if (r.firstMismatch >= 0) {
        assert.fail(`${hz} Hz: main and worker diverge at step ${r.firstMismatch} of ${r.stepCount} — ${await describeMismatch(hz, r.firstMismatch)}`);
    }
    assert.equal(r.main.digest, r.worker.digest, `${hz} Hz: run digests`);
    digests[hz] = r.main.digest;
}

// ── Controls: the hash is repeatable and input-sensitive ─────────────────────
{
    const hz = 120;
    const steps = 120;
    const first = await runScenario(createMainHarness({ hz }), { steps });
    const again = await runScenario(createMainHarness({ hz }), { steps });
    assert.equal(first.digest, again.digest, 'the same seed replays to the same digest');
    const other = await runScenario(createMainHarness({ hz }), { steps, seed: DEFAULT_SEED + 1 });
    assert.notEqual(first.digest, other.digest, 'a different seed changes the digest (control)');
    assert.notEqual(first.steps[0].hash, other.steps[0].hash, 'a different seed changes step 0 (control)');
}

// ── The scenario still exercises what it is meant to ─────────────────────────
{
    const h = await createWorkerHarness({ hz: 120 });
    let maxBodies = 0;
    let minBodiesAfterPeak = Infinity;
    let slept = false;
    let contacts = false;
    await runScenario(h, {
        onStep: (_s, _rec, harness) => {
            const world = harness.rapierWorld();
            const n = world.bodies.len();
            if (n > maxBodies) maxBodies = n;
            else if (n < maxBodies) minBodiesAfterPeak = Math.min(minBodiesAfterPeak, n);
            world.forEachRigidBody((rb) => { if (rb.isSleeping() && rb.isDynamic()) slept = true; });
            if (!contacts) world.forEachCollider((c) => { world.contactPairsWith(c, () => { contacts = true; }); });
        },
    });
    assert.ok(maxBodies >= 31, `projectiles are spawned at run time (peak ${maxBodies} bodies)`);
    assert.ok(minBodiesAfterPeak < maxBodies, 'projectiles are removed at run time');
    assert.ok(slept, 'at least one dynamic body goes to sleep (island sleeping is covered)');
    assert.ok(contacts, 'bodies are in contact (the solver is covered)');
}

// ── Golden digest: same build ⇒ same bits on every machine ───────────────────
const recorded = { rapier: RAPIER.version(), seed: DEFAULT_SEED, steps: DEFAULT_STEPS, digests };
if (UPDATE) {
    fs.writeFileSync(FIXTURE, `${JSON.stringify(recorded, null, 2)}\n`);
    console.log(`Recorded ${FIXTURE}`);
} else {
    const golden = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const rerecord = 're-record with: node --experimental-strip-types tests/test_physics_determinism.js --update';
    assert.equal(golden.rapier, recorded.rapier, `golden digests were recorded on Rapier ${golden.rapier}; ${rerecord}`);
    assert.deepEqual({ seed: golden.seed, steps: golden.steps }, { seed: recorded.seed, steps: recorded.steps }, `scenario parameters changed; ${rerecord}`);
    for (const hz of RATES) {
        assert.equal(
            digests[hz], golden.digests[hz],
            `${hz} Hz: this run's digest differs from the recorded one. On an unchanged tree that means this machine/runtime `
            + `(${process.arch}, node ${process.version}) simulates different bits; if the scenario or physics changed on purpose, ${rerecord}`,
        );
    }
}

console.log(`Physics determinism: main == worker for ${DEFAULT_STEPS} steps at ${RATES.join(' and ')} Hz (Rapier ${RAPIER.version()})`);

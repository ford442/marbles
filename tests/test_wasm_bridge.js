/**
 * test_wasm_bridge.js
 *
 * Unit tests for the pure-JS fallback implementations in src/wasm-bridge.js.
 * These run without building the WASM binary and validate that every fallback
 * function returns numerically correct results.
 *
 * Run with:
 *   node tests/test_wasm_bridge.js
 */

import { _testExports, FORCE_BATCH_THRESHOLD } from '../src/wasm-bridge.js';

const { jsFallback, computeForceFieldScalar, applyVelocityDampingScalar } = _testExports;

// ── Minimal test harness ──────────────────────────────────────────────────────

let pass = 0, fail = 0;

function approxEq(a, b, tol = 1e-5) {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < tol;
    if (typeof a === 'object' && typeof b === 'object') {
        return Object.keys(b).every(k => Math.abs(a[k] - b[k]) < tol);
    }
    return a === b;
}

function test(name, got, expected, tol = 1e-5) {
    if (approxEq(got, expected, tol)) {
        console.log(`  ✅  ${name}`);
        pass++;
    } else {
        console.error(`  ❌  ${name}`);
        console.error(`       got     :`, got);
        console.error(`       expected:`, expected);
        fail++;
    }
}

function runScalarBatchParity(name, scalarFn, batchFn, argsList, tol = 1e-5) {
    const count = argsList.length;
    const positions = new Float32Array(count * 3);
    const strengths = new Float32Array(count);
    const out = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const args = argsList[i];
        const scalar = scalarFn(...args);
        const base = i * 3;
        positions[base] = args[3];
        positions[base + 1] = args[4];
        positions[base + 2] = args[5];
        strengths[i] = args[6];
        out[base] = scalar.x;
        out[base + 1] = scalar.y;
        out[base + 2] = scalar.z;
    }

    const batchOut = new Float32Array(count * 3);
    batchFn(positions, strengths, batchOut, count, ...argsList[0].slice(0, 3), ...argsList[0].slice(7));

    for (let i = 0; i < count * 3; i++) {
        if (Math.abs(out[i] - batchOut[i]) > tol) {
            test(`${name} parity [${i}]`, batchOut[i], out[i], tol);
            return;
        }
    }
    test(`${name} batch matches scalar`, true, true);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('MarblePhysics JS fallback tests\n');
test('FORCE_BATCH_THRESHOLD is positive', FORCE_BATCH_THRESHOLD > 0, true);

// vec3Distance
console.log('vec3Distance / vec3DistanceSq');
test('3-4-5 triangle', jsFallback.vec3Distance(0, 0, 0, 3, 4, 0), 5);
test('same point = 0', jsFallback.vec3Distance(1, 2, 3, 1, 2, 3), 0);
test('distanceSq(0,0,0, 1,1,1) = 3', jsFallback.vec3DistanceSq(0, 0, 0, 1, 1, 1), 3);

// vec3Dot / vec3Length / vec3Normalize
console.log('\nvec3Dot / vec3Length / vec3Normalize');
test('dot product (1,0,0)·(0,1,0) = 0', jsFallback.vec3Dot(1, 0, 0, 0, 1, 0), 0);
test('dot product (1,1,0)·(1,1,0) = 2', jsFallback.vec3Dot(1, 1, 0, 1, 1, 0), 2);
test('length(3,4,0) = 5', jsFallback.vec3Length(3, 4, 0), 5);
test('normalize(3,0,0) = (1,0,0)', jsFallback.vec3Normalize(3, 0, 0), { x: 1, y: 0, z: 0 });
test('normalize(0,0,0) = (0,0,0)', jsFallback.vec3Normalize(0, 0, 0), { x: 0, y: 0, z: 0 });

// applyVelocityDamping
console.log('\napplyVelocityDamping');
const dv = jsFallback.applyVelocityDamping(10, 0, 0, 0.5, 0.016, 0);
test('velocity decays correctly', dv.x, 10 * (1 - 0.5 * 0.016), 1e-4);
test('no y/z change', dv, { x: dv.x, y: 0, z: 0 });
const dvCap = jsFallback.applyVelocityDamping(100, 0, 0, 0, 0.016, 10);
test('speed cap enforced', dvCap.x, 10, 1e-4);
const dvFull = jsFallback.applyVelocityDamping(5, 0, 0, 1.0, 1.0, 0);
test('full stop (dampingFactor=1, dt=1)', dvFull, { x: 0, y: 0, z: 0 });

// computeForceField
console.log('\ncomputeForceField');
const ff = jsFallback.computeForceField(0, 0, 0, 5, 0, 0, 20, 1.0, 0.5, 25);
test('force points toward field origin', ff, { x: -4, y: 0, z: 0 });
const ffFar = jsFallback.computeForceField(0, 0, 0, 30, 0, 0, 20, 1.0, 0.5, 25);
test('zero force beyond maxDist', ffFar, { x: 0, y: 0, z: 0 });
const ff2 = jsFallback.computeForceField(0, 0, 0, 2, 0, 0, 4, 2.0, 0.5, 25);
test('inverse-square at dist=2', ff2.x, -1, 1e-4);

// softening (magnet-style)
console.log('\ncomputeForceField softening');
const magnet = jsFallback.computeForceField(0, 0, 0, 2, 0, 0, 150, 2.0, 0.5, 20, 1.0);
test('soft inverse-square at dist=2', magnet.x, -150 / 5, 1e-4);

// computeSpringForce
console.log('\ncomputeSpringForce');
const sf = jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
test('spring extension 5 → force 5', sf, { x: 5, y: 0, z: 0 });
const sfComp = jsFallback.computeSpringForce(8, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
test('compressed spring pushes away', sfComp.x, -3, 1e-4);
const sfDamp = jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 2, 2, 0, 0);
test('damping subtracts from spring force', sfDamp.x, 5 - 2 * 2, 1e-4);

// reflectVelocity
console.log('\nreflectVelocity');
const rv = jsFallback.reflectVelocity(0, -10, 0, 0, 1, 0, 1.0);
test('elastic bounce off floor', rv, { x: 0, y: 10, z: 0 });
const rvIn = jsFallback.reflectVelocity(0, -10, 0, 0, 1, 0, 0.0);
test('inelastic: normal component zeroed', rvIn, { x: 0, y: 0, z: 0 });
const rvOb = jsFallback.reflectVelocity(3, -4, 0, 0, 1, 0, 1.0);
test('tangential component unchanged', rvOb.x, 3, 1e-4);
test('normal component reversed', rvOb.y, 4, 1e-4);

// closestPointOnSegment
console.log('\nclosestPointOnSegment');
const cp1 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 4, 3, 0);
test('closest point on horizontal segment', cp1, { x: 4, y: 0, z: 0 });
const cp2 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, -5, 0, 0);
test('clamp to segment start', cp2, { x: 0, y: 0, z: 0 });
const cp3 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 15, 0, 0);
test('clamp to segment end', cp3, { x: 10, y: 0, z: 0 });
const cp4 = jsFallback.closestPointOnSegment(5, 5, 5, 5, 5, 5, 0, 0, 0);
test('degenerate segment returns p0', cp4, { x: 5, y: 5, z: 5 });

// batch parity (field parameters must be uniform across the batch)
console.log('\ncomputeForceFieldsBatch parity');
runScalarBatchParity(
    'black-hole style',
    computeForceFieldScalar,
    (positions, strengths, out, count, fx, fy, fz, falloff, minDist, maxDist, softening) =>
        jsFallback.computeForceFieldsBatch(
            positions, strengths, out, count, fx, fy, fz, falloff, minDist, maxDist, softening
        ),
    [
        [0, 0, 0, 5, 0, 0, 20, 1.0, 0.5, 25, 0],
        [0, 0, 0, 30, 0, 0, 20, 1.0, 0.5, 25, 0],
        [0, 0, 0, 8, 0, 0, 20, 1.0, 0.5, 25, 0],
    ]
);

const invSqScalar = computeForceFieldScalar(0, 0, 0, 2, 0, 0, 4, 2.0, 0.5, 25, 0);
const invSqPositions = new Float32Array([2, 0, 0]);
const invSqStrengths = new Float32Array([4]);
const invSqOut = new Float32Array(3);
jsFallback.computeForceFieldsBatch(
    invSqPositions, invSqStrengths, invSqOut, 1,
    0, 0, 0, 2.0, 0.5, 25, 0
);
test('inverse-square batch matches scalar', invSqOut[0], invSqScalar.x, 1e-4);

runScalarBatchParity(
    'magnet style',
    computeForceFieldScalar,
    (positions, strengths, out, count, fx, fy, fz, falloff, minDist, maxDist, softening) =>
        jsFallback.computeForceFieldsBatch(
            positions, strengths, out, count, fx, fy, fz, falloff, minDist, maxDist, softening
        ),
    [
        [0, 0, 0, 2, 0, 0, 150, 2.0, 0.5, 20, 1.0],
        [0, 0, 0, 10, 0, 0, 150, 2.0, 0.5, 20, 1.0],
    ]
);

console.log('\napplyVelocityDampingBatch parity');
const dampCases = [
    [10, 0, 0, 0.5, 0.016, 0],
    [100, 0, 0, 0, 0.016, 10],
    [5, 0, 0, 1.0, 1.0, 0],
];
const velIn = new Float32Array(dampCases.length * 3);
const velOut = new Float32Array(dampCases.length * 3);
const velExpected = new Float32Array(dampCases.length * 3);

for (let i = 0; i < dampCases.length; i++) {
    const [vx, vy, vz, df, dt, max] = dampCases[i];
    const damped = applyVelocityDampingScalar(vx, vy, vz, df, dt, max);
    const base = i * 3;
    velIn[base] = vx;
    velIn[base + 1] = vy;
    velIn[base + 2] = vz;
    velExpected[base] = damped.x;
    velExpected[base + 1] = damped.y;
    velExpected[base + 2] = damped.z;
}

jsFallback.applyVelocityDampingBatch(velIn, velOut, dampCases.length, 0.5, 0.016, 0);
// Only first case used shared params in batch call above — run per-case batch for parity
let dampParityOk = true;
for (let i = 0; i < dampCases.length; i++) {
    const [vx, vy, vz, df, dt, max] = dampCases[i];
    const singleIn = new Float32Array([vx, vy, vz]);
    const singleOut = new Float32Array(3);
    jsFallback.applyVelocityDampingBatch(singleIn, singleOut, 1, df, dt, max);
    const base = i * 3;
    if (!approxEq(
        { x: singleOut[0], y: singleOut[1], z: singleOut[2] },
        { x: velExpected[base], y: velExpected[base + 1], z: velExpected[base + 2] }
    )) {
        dampParityOk = false;
        break;
    }
}
test('applyVelocityDampingBatch matches scalar', dampParityOk, true);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

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

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// ── Re-implement the jsFallback object locally so we can test without loading
// the full ES-module graph (which imports Vite / browser APIs).
// The code is kept identical to the corresponding block in src/wasm-bridge.js.

const jsFallback = {
    vec3Distance(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    vec3DistanceSq(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        return dx * dx + dy * dy + dz * dz;
    },
    vec3Dot(ax, ay, az, bx, by, bz) {
        return ax * bx + ay * by + az * bz;
    },
    vec3Length(x, y, z) {
        return Math.sqrt(x * x + y * y + z * z);
    },
    vec3Normalize(x, y, z) {
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len < 1e-8) return { x: 0, y: 0, z: 0 };
        return { x: x / len, y: y / len, z: z / len };
    },
    applyVelocityDamping(vx, vy, vz, dampingFactor, dt, maxSpeed) {
        const decay = 1.0 - Math.min(Math.max(dampingFactor * dt, 0), 1);
        let nx = vx * decay, ny = vy * decay, nz = vz * decay;
        if (maxSpeed > 0) {
            const speed = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (speed > maxSpeed) {
                const s = maxSpeed / speed;
                nx *= s; ny *= s; nz *= s;
            }
        }
        return { x: nx, y: ny, z: nz };
    },
    computeForceField(fieldX, fieldY, fieldZ, marbleX, marbleY, marbleZ,
                      strength, falloffExp, minDist, maxDist) {
        const dx = fieldX - marbleX, dy = fieldY - marbleY, dz = fieldZ - marbleZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist || dist < 1e-6) return { x: 0, y: 0, z: 0 };
        const cd = Math.max(dist, minDist);
        const falloff = Math.pow(cd, falloffExp);
        const f = strength / falloff;
        return { x: (dx / dist) * f, y: (dy / dist) * f, z: (dz / dist) * f };
    },
    computeSpringForce(mx, my, mz, ax, ay, az, restL, k, d, vx, vy, vz) {
        const dx = ax - mx, dy = ay - my, dz = az - mz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1e-6) return { x: 0, y: 0, z: 0 };
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        const ext = dist - restL;
        const vProj = vx * nx + vy * ny + vz * nz;
        const fMag = k * ext - d * vProj;
        return { x: nx * fMag, y: ny * fMag, z: nz * fMag };
    },
    reflectVelocity(vx, vy, vz, nx, ny, nz, r) {
        const dot = vx * nx + vy * ny + vz * nz;
        const s = (1 + r) * dot;
        return { x: vx - s * nx, y: vy - s * ny, z: vz - s * nz };
    },
    closestPointOnSegment(p0x, p0y, p0z, p1x, p1y, p1z, qx, qy, qz) {
        const dx = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
        const lenSq = dx * dx + dy * dy + dz * dz;
        if (lenSq < 1e-12) return { x: p0x, y: p0y, z: p0z };
        const t = Math.min(1, Math.max(0,
            ((qx - p0x) * dx + (qy - p0y) * dy + (qz - p0z) * dz) / lenSq));
        return { x: p0x + t * dx, y: p0y + t * dy, z: p0z + t * dz };
    }
};

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

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('MarblePhysics JS fallback tests\n');

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
// marble at (5,0,0), field at origin, strength=20, falloffExp=1, minDist=0.5, maxDist=25
const ff = jsFallback.computeForceField(0, 0, 0, 5, 0, 0, 20, 1.0, 0.5, 25);
test('force points toward field origin', ff, { x: -4, y: 0, z: 0 });
// beyond maxDist → zero
const ffFar = jsFallback.computeForceField(0, 0, 0, 30, 0, 0, 20, 1.0, 0.5, 25);
test('zero force beyond maxDist', ffFar, { x: 0, y: 0, z: 0 });
// inverse-square law
const ff2 = jsFallback.computeForceField(0, 0, 0, 2, 0, 0, 4, 2.0, 0.5, 25);
test('inverse-square at dist=2', ff2.x, -1, 1e-4); // 4/(2^2) = 1, pointing -x

// computeSpringForce
console.log('\ncomputeSpringForce');
// marble at origin, anchor at (10,0,0), restLen=5, k=1, d=0, vel=0
const sf = jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
test('spring extension 5 → force 5', sf, { x: 5, y: 0, z: 0 });
// compression: marble at (8,0,0), anchor at (10,0,0), restLen=5 → dist=2, ext=-3
const sfComp = jsFallback.computeSpringForce(8, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
test('compressed spring pushes away', sfComp.x, -3, 1e-4);
// damping reduces force when velocity is along spring
const sfDamp = jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 2, 2, 0, 0);
test('damping subtracts from spring force', sfDamp.x, 5 - 2 * 2, 1e-4); // k*ext - d*velProj

// reflectVelocity
console.log('\nreflectVelocity');
// ball moving -y, hitting floor (normal +y), elastic
const rv = jsFallback.reflectVelocity(0, -10, 0, 0, 1, 0, 1.0);
test('elastic bounce off floor', rv, { x: 0, y: 10, z: 0 });
// inelastic (restitution=0): velocity component along normal removed
const rvIn = jsFallback.reflectVelocity(0, -10, 0, 0, 1, 0, 0.0);
test('inelastic: normal component zeroed', rvIn, { x: 0, y: 0, z: 0 });
// oblique incidence
const rvOb = jsFallback.reflectVelocity(3, -4, 0, 0, 1, 0, 1.0);
test('tangential component unchanged', rvOb.x, 3, 1e-4);
test('normal component reversed', rvOb.y, 4, 1e-4);

// closestPointOnSegment
console.log('\nclosestPointOnSegment');
const cp1 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 4, 3, 0);
test('closest point on horizontal segment', cp1, { x: 4, y: 0, z: 0 });
// clamp to start
const cp2 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, -5, 0, 0);
test('clamp to segment start', cp2, { x: 0, y: 0, z: 0 });
// clamp to end
const cp3 = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 15, 0, 0);
test('clamp to segment end', cp3, { x: 10, y: 0, z: 0 });
// degenerate segment (p0 == p1)
const cp4 = jsFallback.closestPointOnSegment(5, 5, 5, 5, 5, 5, 0, 0, 0);
test('degenerate segment returns p0', cp4, { x: 5, y: 5, z: 5 });

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

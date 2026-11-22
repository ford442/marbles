/**
 * test_wasm_parity_ulp.js
 *
 * ULP bound between the C++ WASM kernels (float32) and the JS fallbacks
 * (float64) in `src/wasm-bridge.js`, plus NaN / Infinity parity.
 *
 * The WASM module is built without `-ffast-math` (see `wasm/CMakeLists.txt`),
 * so every float32 operation is correctly rounded and comparisons follow
 * IEEE 754. That makes the gap to the float64 fallback a small, fixed number
 * of float32 ULPs, which this test pins per kernel over a seeded sweep.
 *
 * How the error is measured: `|wasm − fround(js)| / ulp32(scale)`, where
 * `scale` is the magnitude of the terms the kernel adds up (not just the
 * result). A kernel that subtracts nearly equal terms returns something far
 * smaller than its terms, and rounding differences are proportional to the
 * terms.
 *
 * What the bound does not cover: inputs within rounding distance of a
 * kernel's cut-off (`maxDist`, the 1e-6 zero-length guards). There float32
 * and float64 can land on different sides of the comparison. The sweep skips
 * those samples.
 *
 * Skips when public/wasm/marble_physics.wasm is absent.
 * Run with:  npm run test:wasm:parity
 * `--report` prints the measured maxima without failing (for PERFORMANCE_BASELINE.md).
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _testExports } from '../src/wasm-bridge.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmDir = path.join(repoRoot, 'public', 'wasm');
const wasmBinPath = path.join(wasmDir, 'marble_physics.wasm');
const wasmJsPath = path.join(wasmDir, 'marble_physics.js');
const { jsFallback, WasmBatchRunner } = _testExports;
const REPORT = process.argv.includes('--report');

/**
 * Largest allowed error per kernel, in float32 ULPs of the term scale: the
 * measured maximum over the sweep below (recorded in
 * docs/PERFORMANCE_BASELINE.md) rounded up with roughly 2× headroom. The
 * force field is the loosest because `pow(dist, falloffExp)` multiplies the
 * distance's rounding error by the exponent (up to 3 here).
 */
const ULP_BOUND = {
    vec3Distance: 4,
    vec3DistanceSq: 8,
    vec3Dot: 4,
    vec3Length: 4,
    vec3Normalize: 6,
    computeDopplerRate: 4,
    applyVelocityDamping: 4,
    computeForceField: 24,
    computeSpringForce: 8,
    reflectVelocity: 12,
    closestPointOnSegment: 12,
    applyVelocityDampingBatch: 4,
    computeForceFieldsBatch: 24,
    computeSpringForcesBatch: 12,
    closestPointsOnSegmentBatch: 12,
};

const SAMPLES = 20000;
const BATCH_SIZES = [1, 2, 3, 4, 5, 7, 8, 9, 16, 31, 64, 257];

// ── float32 helpers ──────────────────────────────────────────────────────────

const f32 = Math.fround;
const scratchF = new Float32Array(1);
const scratchU = new Uint32Array(scratchF.buffer);
const MIN_NORMAL = 1.1754943508222875e-38;

/** Spacing of float32 values at magnitude |x|. */
function ulp32(x) {
    const a = Math.max(Math.abs(x), MIN_NORMAL);
    if (!Number.isFinite(a)) return Infinity;
    scratchF[0] = a;
    scratchU[0] += 1;
    return scratchF[0] - a;
}

/** Error of `got` against the float64 reference `want`, in float32 ULPs at `scale`. */
function ulpError(got, want, scale) {
    const ref = f32(want);
    if (Number.isNaN(got) || Number.isNaN(ref)) return Number.isNaN(got) && Number.isNaN(ref) ? 0 : Infinity;
    if (got === ref) return 0;
    if (!Number.isFinite(got) || !Number.isFinite(ref)) return Infinity;
    return Math.abs(got - ref) / ulp32(Math.max(Math.abs(got), Math.abs(ref), Math.abs(scale)));
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rnd = mulberry32(0xb0b5eed);
const MAGNITUDES = [1e-3, 0.1, 1, 1, 10, 50, 1e3, 1e4];
/** Signed float32 value at a random magnitude. */
const value = (magnitudes = MAGNITUDES) => f32((rnd() * 2 - 1) * magnitudes[(rnd() * magnitudes.length) | 0]);
/** Positive float32 in [lo, hi). */
const positive = (lo, hi) => f32(lo + rnd() * (hi - lo));
const vec = (magnitudes) => [value(magnitudes), value(magnitudes), value(magnitudes)];
/** A sample is too close to a cut-off for float32 and float64 to agree on the branch. */
const nearCutoff = (x, cutoff) => Math.abs(x - cutoff) <= 1e-4 * Math.max(Math.abs(cutoff), 1e-6);

// ── Kernels: JS reference, WASM call, term scale ─────────────────────────────

const absDot = (ax, ay, az, bx, by, bz) => Math.abs(ax * bx) + Math.abs(ay * by) + Math.abs(az * bz);
const XYZ = ['x', 'y', 'z'];

/**
 * Each entry: `gen()` → args or null (skip), `scale(args, jsResult)` → one
 * scale or [sx, sy, sz]. `wasm(args)` returns a number or [x, y, z].
 */
function kernels(wasm, runner) {
    const out = () => [runner._scalarOutView[0], runner._scalarOutView[1], runner._scalarOutView[2]];
    const ptr = runner._scalarOutPtr;
    const obj = (o) => [o.x, o.y, o.z];
    return {
        vec3Distance: {
            gen: () => [...vec(), ...vec()],
            js: (a) => jsFallback.vec3Distance(...a),
            wasm: (a) => wasm.vec3Distance(...a),
            scale: (_a, r) => r,
        },
        vec3DistanceSq: {
            gen: () => [...vec(), ...vec()],
            js: (a) => jsFallback.vec3DistanceSq(...a),
            wasm: (a) => wasm.vec3DistanceSq(...a),
            scale: (_a, r) => r,
        },
        vec3Dot: {
            gen: () => [...vec(), ...vec()],
            js: (a) => jsFallback.vec3Dot(...a),
            wasm: (a) => wasm.vec3Dot(...a),
            scale: (a) => absDot(...a),
        },
        vec3Length: {
            gen: () => vec(),
            js: (a) => jsFallback.vec3Length(...a),
            wasm: (a) => wasm.vec3Length(...a),
            scale: (_a, r) => r,
        },
        vec3Normalize: {
            gen: () => vec(),
            js: (a) => obj(jsFallback.vec3Normalize(...a)),
            wasm: (a) => obj(wasm.vec3Normalize(...a)),
            scale: (_a, r) => r,
        },
        computeDopplerRate: {
            // velocity, camera, marble, speedOfSound, maxShift
            gen: () => [...vec([1, 10, 40]), ...vec([1, 10, 50]), ...vec([1, 10, 50]), positive(5, 400), positive(0.05, 0.9)],
            js: (a) => jsFallback.computeDopplerRate(...a),
            wasm: (a) => wasm.computeDopplerRate(...a),
            scale: (a) => {
                const dx = a[3] - a[6], dy = a[4] - a[7], dz = a[5] - a[8];
                return 1 + absDot(a[0], a[1], a[2], dx, dy, dz) / Math.hypot(dx, dy, dz) / a[9];
            },
        },
        applyVelocityDamping: {
            // velocity, dampingFactor, dt, maxSpeed (0 = uncapped)
            gen: () => [...vec(), positive(0, 3), positive(1 / 240, 1 / 20), rnd() < 0.3 ? 0 : positive(0.5, 60)],
            js: (a) => obj(jsFallback.applyVelocityDamping(...a)),
            wasm: (a) => { wasm.applyVelocityDampingOut(ptr, ...a); return out(); },
            scale: (a) => [a[0], a[1], a[2]],
        },
        computeForceField: {
            // field, marble, strength, falloffExp, minDist, maxDist, softening
            gen: () => {
                const a = [...vec([1, 10, 50]), ...vec([1, 10, 50]), value([1, 20, 500]),
                    [0, 1, 1.5, 2, 3][(rnd() * 5) | 0], positive(0.05, 2), positive(5, 120), rnd() < 0.5 ? 0 : positive(0.1, 2)];
                const dist = Math.hypot(a[0] - a[3], a[1] - a[4], a[2] - a[5]);
                return nearCutoff(dist, a[9]) || dist < 1e-3 ? null : a;
            },
            js: (a) => obj(jsFallback.computeForceField(...a)),
            wasm: (a) => { wasm.computeForceFieldOut(ptr, ...a); return out(); },
            scale: (_a, r) => r,
        },
        computeSpringForce: {
            // marble, anchor, restLength, stiffness, damping, velocity
            gen: () => {
                const a = [...vec([1, 10, 50]), ...vec([1, 10, 50]), positive(0, 30), positive(0, 200), positive(0, 20), ...vec([1, 10, 40])];
                return Math.hypot(a[3] - a[0], a[4] - a[1], a[5] - a[2]) < 1e-3 ? null : a;
            },
            js: (a) => obj(jsFallback.computeSpringForce(...a)),
            wasm: (a) => { wasm.computeSpringForceOut(ptr, ...a); return out(); },
            scale: (a) => {
                const dx = a[3] - a[0], dy = a[4] - a[1], dz = a[5] - a[2];
                const dist = Math.hypot(dx, dy, dz);
                const terms = a[7] * (dist + a[6]) + a[8] * absDot(a[9], a[10], a[11], dx / dist, dy / dist, dz / dist);
                return [dx, dy, dz].map((d) => (Math.abs(d) / dist) * terms);
            },
        },
        reflectVelocity: {
            // velocity, normal (unit-ish), restitution
            gen: () => {
                const n = vec([1]);
                const len = Math.hypot(...n) || 1;
                return [...vec(), f32(n[0] / len), f32(n[1] / len), f32(n[2] / len), positive(0, 1.5)];
            },
            js: (a) => obj(jsFallback.reflectVelocity(...a)),
            wasm: (a) => { wasm.reflectVelocityOut(ptr, ...a); return out(); },
            scale: (a) => {
                const terms = (1 + a[6]) * absDot(a[0], a[1], a[2], a[3], a[4], a[5]);
                return [0, 1, 2].map((i) => Math.abs(a[i]) + terms * Math.abs(a[3 + i]));
            },
        },
        closestPointOnSegment: {
            // p0, p1, q
            gen: () => {
                const a = [...vec([1, 10, 50]), ...vec([1, 10, 50]), ...vec([1, 10, 50])];
                return Math.hypot(a[3] - a[0], a[4] - a[1], a[5] - a[2]) < 1e-3 ? null : a;
            },
            js: (a) => obj(jsFallback.closestPointOnSegment(...a)),
            wasm: (a) => { wasm.closestPointOnSegmentOut(ptr, ...a); return out(); },
            scale: (a) => {
                const d = [a[3] - a[0], a[4] - a[1], a[5] - a[2]];
                const lenSq = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
                const t = Math.min(1, absDot(a[6] - a[0], a[7] - a[1], a[8] - a[2], ...d) / lenSq);
                return [0, 1, 2].map((i) => Math.abs(a[i]) + t * Math.abs(d[i]));
            },
        },
    };
}

/** Max ULP error of `got` vs `want` (numbers or xyz arrays) at `scale`. */
function worstUlp(got, want, scale) {
    if (typeof got === 'number') return ulpError(got, want, scale);
    let worst = 0;
    for (let i = 0; i < 3; i++) worst = Math.max(worst, ulpError(got[i], want[i], Array.isArray(scale) ? scale[i] : scale));
    return worst;
}

let failures = 0;
const measured = {};
function check(name, ok, detail) {
    if (ok) {
        console.log(`  ✅  ${name}`);
    } else {
        failures++;
        console.error(`  ❌  ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

async function loadWasmInNode() {
    const wasmBinary = new Uint8Array(readFileSync(wasmBinPath));
    const factory = (await import(pathToFileURL(wasmJsPath).href)).default;
    return factory({ wasmBinary, locateFile: (file) => path.join(wasmDir, file) });
}

async function main() {
    console.log('MarblePhysics WASM vs JS fallback: float32 ULP bound\n');
    if (!existsSync(wasmBinPath) || !existsSync(wasmJsPath)) {
        console.log('  ⏭  Skipping — public/wasm/marble_physics.wasm not found (run npm run build:wasm)');
        return;
    }
    const wasm = await loadWasmInNode();
    const runner = new WasmBatchRunner(wasm);
    const table = kernels(wasm, runner);

    // ── Scalar sweep ─────────────────────────────────────────────────────────
    console.log(`Scalar kernels (${SAMPLES} seeded samples each)`);
    for (const [name, k] of Object.entries(table)) {
        let worst = 0;
        let worstArgs = null;
        let ran = 0;
        while (ran < SAMPLES) {
            const args = k.gen();
            if (!args) continue;
            ran++;
            const want = k.js(args);
            const err = worstUlp(k.wasm(args), want, k.scale(args, want));
            if (err > worst) { worst = err; worstArgs = args; }
        }
        measured[name] = worst;
        check(`${name}: max ${worst.toFixed(2)} ULP (bound ${ULP_BOUND[name]})`, REPORT || worst <= ULP_BOUND[name], `worst inputs: ${JSON.stringify(worstArgs)}`);
    }

    // ── Batch kernels: SIMD lanes and the scalar tail both stay inside the bound ──
    console.log(`\nBatch kernels (sizes ${BATCH_SIZES.join(', ')})`);
    const batches = {
        applyVelocityDampingBatch: (n) => {
            const k = table.applyVelocityDamping;
            const params = k.gen().slice(3);
            const velocities = new Float32Array(n * 3).map(() => value());
            const got = new Float32Array(n * 3);
            const want = new Float32Array(n * 3);
            runner.applyVelocityDampingBatch(velocities, got, n, ...params);
            jsFallback.applyVelocityDampingBatch(velocities, want, n, ...params);
            return { got, want, scale: (i) => k.scale([velocities[i * 3], velocities[i * 3 + 1], velocities[i * 3 + 2]]) };
        },
        computeForceFieldsBatch: (n) => {
            const k = table.computeForceField;
            const positions = new Float32Array(n * 3);
            const strengths = new Float32Array(n);
            // Shared field parameters; resample any element that sits on a cut-off.
            let shared = null;
            while (!shared) shared = k.gen();
            const field = shared.slice(0, 3);
            const params = shared.slice(7);
            for (let i = 0; i < n; i++) {
                for (;;) {
                    const p = vec([1, 10, 50]);
                    const dist = Math.hypot(field[0] - p[0], field[1] - p[1], field[2] - p[2]);
                    if (nearCutoff(dist, params[2]) || dist < 1e-3) continue;
                    positions.set(p, i * 3);
                    break;
                }
                strengths[i] = value([1, 20, 500]);
            }
            const got = new Float32Array(n * 3);
            const want = new Float32Array(n * 3);
            runner.computeForceFieldsBatch(positions, strengths, got, n, ...field, ...params);
            jsFallback.computeForceFieldsBatch(positions, strengths, want, n, ...field, ...params);
            return { got, want, scale: (i) => [want[i * 3], want[i * 3 + 1], want[i * 3 + 2]] };
        },
        computeSpringForcesBatch: (n) => {
            const k = table.computeSpringForce;
            const positions = new Float32Array(n * 3);
            const anchors = new Float32Array(n * 3);
            const velocities = new Float32Array(n * 3);
            const rest = new Float32Array(n);
            const stiff = new Float32Array(n);
            const damp = new Float32Array(n);
            const args = [];
            for (let i = 0; i < n; i++) {
                let a = null;
                while (!a) a = k.gen();
                args.push(a);
                positions.set(a.slice(0, 3), i * 3);
                anchors.set(a.slice(3, 6), i * 3);
                rest[i] = a[6]; stiff[i] = a[7]; damp[i] = a[8];
                velocities.set(a.slice(9, 12), i * 3);
            }
            const got = new Float32Array(n * 3);
            const want = new Float32Array(n * 3);
            runner.computeSpringForcesBatch(positions, anchors, velocities, rest, stiff, damp, got, n);
            jsFallback.computeSpringForcesBatch(positions, anchors, velocities, rest, stiff, damp, want, n);
            return { got, want, scale: (i) => k.scale(args[i]) };
        },
        closestPointsOnSegmentBatch: (n) => {
            const k = table.closestPointOnSegment;
            const p0 = new Float32Array(n * 3);
            const p1 = new Float32Array(n * 3);
            const q = new Float32Array(n * 3);
            const args = [];
            for (let i = 0; i < n; i++) {
                let a = null;
                while (!a) a = k.gen();
                args.push(a);
                p0.set(a.slice(0, 3), i * 3);
                p1.set(a.slice(3, 6), i * 3);
                q.set(a.slice(6, 9), i * 3);
            }
            const got = new Float32Array(n * 3);
            const want = new Float32Array(n * 3);
            runner.closestPointsOnSegmentBatch(p0, p1, q, got, n);
            jsFallback.closestPointsOnSegmentBatch(p0, p1, q, want, n);
            return { got, want, scale: (i) => k.scale(args[i]) };
        },
    };
    for (const [name, build] of Object.entries(batches)) {
        let worst = 0;
        for (let round = 0; round < 40; round++) {
            for (const n of BATCH_SIZES) {
                const { got, want, scale } = build(n);
                for (let i = 0; i < n; i++) {
                    const s = scale(i);
                    for (let c = 0; c < 3; c++) worst = Math.max(worst, ulpError(got[i * 3 + c], want[i * 3 + c], Array.isArray(s) ? s[c] : s));
                }
            }
        }
        measured[name] = worst;
        check(`${name}: max ${worst.toFixed(2)} ULP (bound ${ULP_BOUND[name]})`, REPORT || worst <= ULP_BOUND[name]);
    }

    // ── NaN / Infinity: the same class of result as the JS fallback ──────────
    // With -ffast-math the compiler may assume neither occurs, so guards such
    // as `dist < 1e-6` can be compiled away for them. Built without it, a NaN
    // or infinite input must come out exactly as the fallback reports it.
    console.log('\nNon-finite inputs (NaN / ±Infinity in each vector slot)');
    const classOf = (v) => (Number.isNaN(v) ? 'nan' : v === Infinity ? '+inf' : v === -Infinity ? '-inf' : 'finite');
    const sameClass = (got, want) => {
        const g = typeof got === 'number' ? [got] : got;
        const w = typeof want === 'number' ? [want] : want;
        return g.every((v, i) => classOf(v) === classOf(f32(w[i])) && (classOf(v) !== 'finite' || ulpError(v, w[i], w[i]) <= 16));
    };
    const BASE = {
        vec3Distance: [1, 2, 3, 4, 6, 8],
        vec3DistanceSq: [1, 2, 3, 4, 6, 8],
        vec3Dot: [1, 2, 3, 4, 6, 8],
        vec3Length: [1, 2, 3],
        vec3Normalize: [1, 2, 3],
        computeDopplerRate: [5, 1, 0, 10, 2, 0, 0, 0, 1, 20, 0.3],
        applyVelocityDamping: [3, 4, 5, 0.8, 1 / 60, 4],
        computeForceField: [0, 0, 0, 5, 1, 2, 20, 2, 0.5, 25, 0],
        computeSpringForce: [0, 1, 0, 10, 2, 3, 5, 40, 2, 1, 2, 3],
        reflectVelocity: [3, -4, 5, 0, 1, 0, 0.8],
        closestPointOnSegment: [0, 0, 0, 10, 1, 2, 4, 3, 1],
    };
    /** Vector slots only: scalar tuning parameters are never non-finite in game code. */
    const VECTOR_SLOTS = {
        computeDopplerRate: 9, applyVelocityDamping: 3, computeForceField: 6, computeSpringForce: 6, reflectVelocity: 6,
    };
    for (const [name, base] of Object.entries(BASE)) {
        const k = table[name];
        const slots = VECTOR_SLOTS[name] ?? base.length;
        /** @type {string[]} */
        const bad = [];
        for (const special of [NaN, Infinity, -Infinity]) {
            for (let i = 0; i < slots; i++) {
                const args = base.slice();
                args[i] = special;
                const got = k.wasm(args);
                const want = k.js(args);
                if (!sameClass(got, want)) bad.push(`arg ${i} = ${special}: wasm ${JSON.stringify(got)} vs js ${JSON.stringify(want)}`);
            }
        }
        check(`${name}: NaN / ±Infinity inputs match the fallback (${slots * 3} cases)`, bad.length === 0, bad.slice(0, 4).join('\n       '));
    }

    // Batch kernels: a non-finite element behaves the same in a SIMD lane (index 1)
    // and in the scalar tail (index 4), and never leaks into its neighbours.
    {
        const n = 5;
        /** @type {string[]} */
        const bad = [];
        const compare = (label, got, want) => {
            for (let i = 0; i < n * 3; i++) {
                if (classOf(got[i]) !== classOf(want[i])) { bad.push(`${label} out[${i}]: wasm ${got[i]} vs js ${want[i]}`); break; }
            }
        };
        for (const special of [NaN, Infinity]) {
            for (const at of [1, 4]) {
                const fill = (base) => {
                    const a = new Float32Array(n * 3);
                    for (let i = 0; i < n; i++) a.set(base.map((v, c) => v + i * 0.5 + c * 0.25), i * 3);
                    return a;
                };
                const poison = (a) => { const b = a.slice(); b[at * 3 + 1] = special; return b; };
                const got = new Float32Array(n * 3);
                const want = new Float32Array(n * 3);
                const ones = new Float32Array(n).fill(1);

                const positions = poison(fill([5, 1, 2]));
                runner.computeForceFieldsBatch(positions, ones, got, n, 0, 0, 0, 2, 0.5, 25, 0);
                jsFallback.computeForceFieldsBatch(positions, ones, want, n, 0, 0, 0, 2, 0.5, 25, 0);
                compare(`forceFields(${special}@${at})`, got, want);

                const anchors = fill([10, 2, 3]);
                const vels = fill([1, 2, 3]);
                runner.computeSpringForcesBatch(positions, anchors, vels, ones, ones, ones, got, n);
                jsFallback.computeSpringForcesBatch(positions, anchors, vels, ones, ones, ones, want, n);
                compare(`springForces(${special}@${at})`, got, want);

                const p1 = poison(fill([10, 1, 2]));
                const p0 = fill([0, 0, 0]);
                const q = fill([4, 3, 1]);
                runner.closestPointsOnSegmentBatch(p0, p1, q, got, n);
                jsFallback.closestPointsOnSegmentBatch(p0, p1, q, want, n);
                compare(`closestPoints(${special}@${at})`, got, want);

                const v = poison(fill([3, 4, 5]));
                runner.applyVelocityDampingBatch(v, got, n, 0.8, 1 / 60, 4);
                jsFallback.applyVelocityDampingBatch(v, want, n, 0.8, 1 / 60, 4);
                compare(`damping(${special}@${at})`, got, want);
            }
        }
        check('batch kernels: non-finite element matches the fallback in a SIMD lane and in the scalar tail', bad.length === 0, bad.slice(0, 6).join('\n       '));
    }

    // ── Cut-offs: both sides agree on which side a clearly-inside input falls ──
    console.log('\nCut-offs (zero-length and range guards)');
    {
        const zero = (v) => v.every((c) => c === 0);
        const cases = [
            ['vec3Normalize below 1e-6 → zero vector', 'vec3Normalize', [3e-7, 0, 4e-7], zero],
            ['vec3Normalize above 1e-6 → unit vector', 'vec3Normalize', [1.2e-6, 0, 1.6e-6], (v) => Math.abs(Math.hypot(...v) - 1) < 1e-6],
            ['computeForceField closer than 1e-6 → zero', 'computeForceField', [1, 2, 3, 1, f32(2 + 4e-7), 3, 20, 2, 0.5, 25, 0], zero],
            ['computeForceField beyond maxDist → zero', 'computeForceField', [0, 0, 0, 25.5, 0, 0, 20, 2, 0.5, 25, 0], zero],
            ['computeForceField inside maxDist → non-zero', 'computeForceField', [0, 0, 0, 24.5, 0, 0, 20, 2, 0.5, 25, 0], (v) => v[0] < 0],
            ['computeSpringForce coincident ends → zero', 'computeSpringForce', [1, 2, 3, 1, f32(2 + 4e-7), 3, 5, 40, 2, 1, 2, 3], zero],
            ['closestPointOnSegment degenerate segment → p0', 'closestPointOnSegment', [1, 2, 3, 1, f32(2 + 4e-7), 3, 9, 9, 9], (v) => v[0] === 1 && v[1] === 2 && v[2] === 3],
            ['computeDopplerRate listener on the source → 1', 'computeDopplerRate', [5, 1, 0, 1, 2, 3, 1, f32(2 + 4e-7), 3, 20, 0.3], (v) => v === 1],
        ];
        for (const [label, name, args, expect] of cases) {
            const got = table[name].wasm(args);
            const want = table[name].js(args);
            const wantF32 = typeof want === 'number' ? f32(want) : want.map(f32);
            check(label, expect(got) && expect(wantF32), `wasm ${JSON.stringify(got)} vs js ${JSON.stringify(want)}`);
        }
    }

    if (REPORT) {
        console.log('\nMeasured maxima (float32 ULPs of the term scale):');
        for (const [name, worst] of Object.entries(measured)) console.log(`  ${name.padEnd(30)} ${worst.toFixed(2)}`);
    }
    console.log(failures ? `\n${failures} check(s) failed` : '\nAll ULP parity checks passed');
    if (failures && !REPORT) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

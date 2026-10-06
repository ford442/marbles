/**
 * test_wasm_bridge_wasm.js
 *
 * Parity tests comparing the built C++ WASM module against JS fallbacks.
 * Skips gracefully when public/wasm/marble_physics.wasm is absent.
 *
 * Run with:
 *   npm run build:wasm   # optional, when Emscripten is available
 *   node tests/test_wasm_bridge_wasm.js
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

let pass = 0;
let fail = 0;

function approxEq(a, b, tol = 1e-4) {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < tol;
    if (typeof a === 'object' && typeof b === 'object') {
        return Object.keys(b).every(k => Math.abs(a[k] - b[k]) < tol);
    }
    return a === b;
}

function test(name, got, expected, tol = 1e-4) {
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

async function loadWasmInNode() {
    if (!existsSync(wasmBinPath) || !existsSync(wasmJsPath)) {
        return null;
    }

    const wasmBin = new Uint8Array(readFileSync(wasmBinPath));
    const module = await import(pathToFileURL(wasmJsPath).href);
    const MarblePhysicsModule = module.default;

    if (typeof MarblePhysicsModule !== 'function') {
        throw new Error('MarblePhysicsModule is not a function');
    }

    return MarblePhysicsModule({
        wasmBinary: wasmBin,
        locateFile: (file) => path.join(wasmDir, file),
    });
}

async function main() {
    console.log('MarblePhysics WASM parity tests\n');

    if (!existsSync(wasmBinPath)) {
        console.log('  ⏭  Skipping — public/wasm/marble_physics.wasm not found (run npm run build:wasm)');
        process.exit(0);
    }

    const instance = await loadWasmInNode();
    const runner = new WasmBatchRunner(instance);
    const wasm = instance;

    console.log('Scalar Out functions');
    const outPtr = runner._scalarOutPtr;
    wasm.computeForceFieldOut(outPtr, 0, 0, 0, 5, 0, 0, 20, 1.0, 0.5, 25, 0);
    const jsFf = jsFallback.computeForceField(0, 0, 0, 5, 0, 0, 20, 1.0, 0.5, 25, 0);
    test('computeForceFieldOut vs JS', { x: runner._scalarOutView[0], y: runner._scalarOutView[1], z: runner._scalarOutView[2] }, jsFf);

    wasm.computeSpringForceOut(outPtr, 0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
    const jsSf = jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
    test('computeSpringForceOut vs JS', { x: runner._scalarOutView[0], y: runner._scalarOutView[1], z: runner._scalarOutView[2] }, jsSf);

    const springInto = new Float32Array(3);
    runner.computeSpringForceInto(springInto, 0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
    test('computeSpringForceInto vs JS', { x: springInto[0], y: springInto[1], z: springInto[2] }, jsSf);

    wasm.closestPointOnSegmentOut(outPtr, 0, 0, 0, 10, 0, 0, 4, 3, 0);
    const jsCp = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 4, 3, 0);
    test('closestPointOnSegmentOut vs JS', { x: runner._scalarOutView[0], y: runner._scalarOutView[1], z: runner._scalarOutView[2] }, jsCp);

    const dopplerArgs = [5, 0, 0, 10, 0, 0, 0, 0, 0, 20, 0.3];
    test('computeDopplerRate vs JS', wasm.computeDopplerRate(...dopplerArgs), jsFallback.computeDopplerRate(...dopplerArgs));

    console.log('\nBatch kernels');
    const count = 3;
    const positions = new Float32Array([5, 0, 0, 30, 0, 0, 8, 0, 0]);
    const strengths = new Float32Array([20, 20, 20]);
    const wasmOut = new Float32Array(count * 3);
    const jsOut = new Float32Array(count * 3);

    runner.computeForceFieldsBatch(
        positions, strengths, wasmOut, count,
        0, 0, 0, 1.0, 0.5, 25, 0
    );
    jsFallback.computeForceFieldsBatch(
        positions, strengths, jsOut, count,
        0, 0, 0, 1.0, 0.5, 25, 0
    );

    let batchOk = true;
    for (let i = 0; i < wasmOut.length; i++) {
        if (Math.abs(wasmOut[i] - jsOut[i]) > 1e-3) {
            batchOk = false;
            break;
        }
    }
    test('computeForceFieldsBatch WASM vs JS', batchOk, true);

    const springPositions = new Float32Array([0, 0, 0, 8, 0, 0]);
    const springAnchors = new Float32Array([10, 0, 0, 10, 0, 0]);
    const springVel = new Float32Array([0, 0, 0, 0, 0, 0]);
    const springRest = new Float32Array([5, 5]);
    const springStiff = new Float32Array([1, 1]);
    const springDamp = new Float32Array([0, 0]);
    const springWasmOut = new Float32Array(6);
    const springJsOut = new Float32Array(6);

    runner.computeSpringForcesBatch(
        springPositions, springAnchors, springVel,
        springRest, springStiff, springDamp, springWasmOut, 2
    );
    jsFallback.computeSpringForcesBatch(
        springPositions, springAnchors, springVel,
        springRest, springStiff, springDamp, springJsOut, 2
    );

    let springBatchOk = true;
    for (let i = 0; i < springWasmOut.length; i++) {
        if (Math.abs(springWasmOut[i] - springJsOut[i]) > 1e-3) {
            springBatchOk = false;
            break;
        }
    }
    test('computeSpringForcesBatch WASM vs JS', springBatchOk, true);

    const p0 = new Float32Array([0, 0, 0, 0, 0, 0]);
    const p1 = new Float32Array([10, 0, 0, 10, 0, 0]);
    const q = new Float32Array([4, 3, 0, -5, 0, 0]);
    const segWasmOut = new Float32Array(6);
    const segJsOut = new Float32Array(6);
    runner.closestPointsOnSegmentBatch(p0, p1, q, segWasmOut, 2);
    jsFallback.closestPointsOnSegmentBatch(p0, p1, q, segJsOut, 2);

    let segBatchOk = true;
    for (let i = 0; i < segWasmOut.length; i++) {
        if (Math.abs(segWasmOut[i] - segJsOut[i]) > 1e-3) {
            segBatchOk = false;
            break;
        }
    }
    test('closestPointsOnSegmentBatch WASM vs JS', segBatchOk, true);

    console.log('\nSIMD-width batch kernels (non-multiple-of-4 counts, edge cases)');

    // 13 entities: exercises three full SIMD groups of 4 plus a scalar
    // remainder of 1, and covers in-range / beyond-maxDist / near-zero-dist
    // marbles so the bitselect masking path is tested against JS.
    {
        const ffCount = 13;
        const ffPositions = new Float32Array(ffCount * 3);
        const ffStrengths = new Float32Array(ffCount);
        for (let i = 0; i < ffCount; i++) {
            const base = i * 3;
            if (i === 0) {
                // dist == 0 from field origin -> must zero out, not NaN.
                ffPositions[base] = 0; ffPositions[base + 1] = 0; ffPositions[base + 2] = 0;
            } else if (i % 4 === 0) {
                // beyond maxDist (25) -> must zero out.
                ffPositions[base] = 40 + i; ffPositions[base + 1] = 0; ffPositions[base + 2] = 0;
            } else {
                const angle = (i / ffCount) * Math.PI * 2;
                const radius = 3 + (i % 5) * 1.7;
                ffPositions[base] = Math.cos(angle) * radius;
                ffPositions[base + 1] = (i % 3) * 0.6;
                ffPositions[base + 2] = Math.sin(angle) * radius;
            }
            ffStrengths[i] = 15 + i * 2.3;
        }

        const ffWasmOut = new Float32Array(ffCount * 3);
        const ffJsOut = new Float32Array(ffCount * 3);
        runner.computeForceFieldsBatch(
            ffPositions, ffStrengths, ffWasmOut, ffCount,
            1.5, -0.5, 2.0, 1.75, 0.5, 25, 0.1
        );
        jsFallback.computeForceFieldsBatch(
            ffPositions, ffStrengths, ffJsOut, ffCount,
            1.5, -0.5, 2.0, 1.75, 0.5, 25, 0.1
        );

        let ffOk = true;
        for (let i = 0; i < ffWasmOut.length; i++) {
            const a = ffWasmOut[i], b = ffJsOut[i];
            if (Number.isNaN(a) || Math.abs(a - b) > 1e-2) { ffOk = false; break; }
        }
        test('computeForceFieldsBatch WASM vs JS (13 entities, edge cases)', ffOk, true);
    }

    // Shield / Violet repel parameters: falloffExp = 0 (constant magnitude),
    // minDist = 0, negative per-body strength. See src/game-loop/repel-pulse.js.
    {
        const rpCount = 13;
        const rpPositions = new Float32Array(rpCount * 3);
        const rpStrengths = new Float32Array(rpCount);
        for (let i = 0; i < rpCount; i++) {
            const base = i * 3;
            rpPositions[base] = 2 + Math.cos(i) * (0.3 + i);
            rpPositions[base + 1] = 1 + (i % 3) - 1;
            rpPositions[base + 2] = -3 + Math.sin(i) * (0.3 + i);
            rpStrengths[i] = -3.0 * (0.5 + (i % 4));
        }
        const rpWasmOut = new Float32Array(rpCount * 3);
        const rpJsOut = new Float32Array(rpCount * 3);
        runner.computeForceFieldsBatch(rpPositions, rpStrengths, rpWasmOut, rpCount, 2, 1, -3, 0, 0, 15, 0);
        jsFallback.computeForceFieldsBatch(rpPositions, rpStrengths, rpJsOut, rpCount, 2, 1, -3, 0, 0, 15, 0);

        let rpOk = true;
        for (let i = 0; i < rpWasmOut.length; i++) {
            const a = rpWasmOut[i], b = rpJsOut[i];
            if (Number.isNaN(a) || Math.abs(a - b) > 1e-3) { rpOk = false; break; }
        }
        test('computeForceFieldsBatch WASM vs JS (13 entities, repel falloffExp=0)', rpOk, true);
    }

    // 13 entities again for velocity damping, mixing speeds above/below the
    // cap so both the vectorized branch and its bitselect blend are hit.
    {
        const vdCount = 13;
        const velocities = new Float32Array(vdCount * 3);
        for (let i = 0; i < vdCount; i++) {
            const base = i * 3;
            const speedScale = i % 2 === 0 ? 20 : 2; // alternately over/under the cap
            velocities[base] = Math.sin(i) * speedScale;
            velocities[base + 1] = Math.cos(i) * speedScale;
            velocities[base + 2] = (i % 3 - 1) * speedScale;
        }

        const vdWasmOut = new Float32Array(vdCount * 3);
        const vdJsOut = new Float32Array(vdCount * 3);
        runner.applyVelocityDampingBatch(velocities, vdWasmOut, vdCount, 0.8, 1 / 60, 8);
        jsFallback.applyVelocityDampingBatch(velocities, vdJsOut, vdCount, 0.8, 1 / 60, 8);

        let vdOk = true;
        for (let i = 0; i < vdWasmOut.length; i++) {
            if (Math.abs(vdWasmOut[i] - vdJsOut[i]) > 1e-3) { vdOk = false; break; }
        }
        test('applyVelocityDampingBatch WASM vs JS (13 entities, speed cap)', vdOk, true);

        // maxSpeed = 0 means "uncapped" — must skip the cap branch entirely.
        const vdUncappedWasmOut = new Float32Array(vdCount * 3);
        const vdUncappedJsOut = new Float32Array(vdCount * 3);
        runner.applyVelocityDampingBatch(velocities, vdUncappedWasmOut, vdCount, 0.8, 1 / 60, 0);
        jsFallback.applyVelocityDampingBatch(velocities, vdUncappedJsOut, vdCount, 0.8, 1 / 60, 0);

        let vdUncappedOk = true;
        for (let i = 0; i < vdUncappedWasmOut.length; i++) {
            if (Math.abs(vdUncappedWasmOut[i] - vdUncappedJsOut[i]) > 1e-3) { vdUncappedOk = false; break; }
        }
        test('applyVelocityDampingBatch WASM vs JS (13 entities, uncapped)', vdUncappedOk, true);
    }

    // 13 springs: 3 SIMD groups + 1 scalar remainder. Covers coincident
    // marble/anchor (dist == 0 -> zero, not NaN), compressed (dist < rest),
    // extended, and velocity both along and across the spring axis.
    {
        const spCount = 13;
        const positions = new Float32Array(spCount * 3);
        const anchors = new Float32Array(spCount * 3);
        const velocities = new Float32Array(spCount * 3);
        const restLengths = new Float32Array(spCount);
        const stiffnesses = new Float32Array(spCount);
        const dampings = new Float32Array(spCount);
        for (let i = 0; i < spCount; i++) {
            const base = i * 3;
            positions[base] = Math.cos(i) * 4;
            positions[base + 1] = (i % 3) * 0.5;
            positions[base + 2] = Math.sin(i) * 4;
            if (i === 0 || i === 12) {
                // anchor coincides with marble (i === 12 is the scalar remainder)
                anchors[base] = positions[base];
                anchors[base + 1] = positions[base + 1];
                anchors[base + 2] = positions[base + 2];
            } else {
                anchors[base] = positions[base] + 1 + i * 0.7;
                anchors[base + 1] = positions[base + 1] + (i % 2 ? 2 : -1);
                anchors[base + 2] = positions[base + 2] - i * 0.3;
            }
            velocities[base] = (i % 4 - 1.5) * 3;
            velocities[base + 1] = i % 2 ? 4 : -2;
            velocities[base + 2] = Math.cos(i * 1.3) * 5;
            restLengths[i] = i % 3 === 0 ? 20 : 2 + i * 0.25; // every 3rd compressed
            stiffnesses[i] = 15 + i;
            dampings[i] = i % 2 ? 2 : 5;
        }

        const spWasmOut = new Float32Array(spCount * 3);
        const spJsOut = new Float32Array(spCount * 3);
        runner.computeSpringForcesBatch(positions, anchors, velocities,
            restLengths, stiffnesses, dampings, spWasmOut, spCount);
        jsFallback.computeSpringForcesBatch(positions, anchors, velocities,
            restLengths, stiffnesses, dampings, spJsOut, spCount);

        let spOk = true;
        for (let i = 0; i < spWasmOut.length; i++) {
            const a = spWasmOut[i], b = spJsOut[i];
            if (Number.isNaN(a) || Math.abs(a - b) > 1e-3) { spOk = false; break; }
        }
        test('computeSpringForcesBatch WASM vs JS (13 entities, edge cases)', spOk, true);
    }

    // 13 segment projections: zero-length segments (0/0 must not leak NaN
    // through the clamp), t < 0, t > 1 and interior t, with per-entity p0/p1.
    {
        const sgCount = 13;
        const p0 = new Float32Array(sgCount * 3);
        const p1 = new Float32Array(sgCount * 3);
        const q = new Float32Array(sgCount * 3);
        for (let i = 0; i < sgCount; i++) {
            const base = i * 3;
            p0[base] = i * 0.5;
            p0[base + 1] = -i * 0.25;
            p0[base + 2] = 1 + (i % 3);
            if (i === 1 || i === 12) {
                // degenerate segment (i === 12 is the scalar remainder)
                p1[base] = p0[base]; p1[base + 1] = p0[base + 1]; p1[base + 2] = p0[base + 2];
            } else {
                p1[base] = p0[base] + 6 + i;
                p1[base + 1] = p0[base + 1] + (i % 2 ? 3 : -2);
                p1[base + 2] = p0[base + 2] + i * 0.4;
            }
            const along = [-0.5, 0.3, 0.7, 1.6][i % 4]; // before / inside / inside / past
            q[base] = p0[base] + (p1[base] - p0[base]) * along + 1.5;
            q[base + 1] = p0[base + 1] + (p1[base + 1] - p0[base + 1]) * along - 2;
            q[base + 2] = p0[base + 2] + (p1[base + 2] - p0[base + 2]) * along + 0.5;
        }

        const sgWasmOut = new Float32Array(sgCount * 3);
        const sgJsOut = new Float32Array(sgCount * 3);
        runner.closestPointsOnSegmentBatch(p0, p1, q, sgWasmOut, sgCount);
        jsFallback.closestPointsOnSegmentBatch(p0, p1, q, sgJsOut, sgCount);

        let sgOk = true;
        for (let i = 0; i < sgWasmOut.length; i++) {
            const a = sgWasmOut[i], b = sgJsOut[i];
            if (Number.isNaN(a) || Math.abs(a - b) > 1e-3) { sgOk = false; break; }
        }
        test('closestPointsOnSegmentBatch WASM vs JS (13 entities, edge cases)', sgOk, true);
    }

    console.log('\nMemory growth');

    // 400k entities ≈ 40 MB of runner buffers: forces the heap past its 32 MB
    // INITIAL_MEMORY (but under the 64 MB cap), which detaches every view over
    // the old buffer. The runner must re-derive HEAPF32 and its scalar view.
    {
        const bigCount = 400_000;
        const bufferBefore = instance.HEAPF32.buffer;
        const positions = new Float32Array(bigCount * 3);
        const strengths = new Float32Array(bigCount).fill(20);
        for (let i = 0; i < bigCount; i++) positions[i * 3] = 1 + (i % 20);
        const wasmOut = new Float32Array(bigCount * 3);
        const jsOut = new Float32Array(bigCount * 3);
        runner.computeForceFieldsBatch(positions, strengths, wasmOut, bigCount, 0, 0, 0, 1, 0.5, 25, 0);
        jsFallback.computeForceFieldsBatch(positions, strengths, jsOut, bigCount, 0, 0, 0, 1, 0.5, 25, 0);
        test('heap grew past INITIAL_MEMORY', instance.HEAPF32.buffer !== bufferBefore, true);

        let growOk = true;
        for (let i = 0; i < bigCount * 3; i += 997) {
            if (Math.abs(wasmOut[i] - jsOut[i]) > 1e-3) { growOk = false; break; }
        }
        test('computeForceFieldsBatch WASM vs JS after memory growth', growOk, true);

        const into = new Float32Array(3);
        runner.computeSpringForceInto(into, 0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0);
        test('computeSpringForceInto after memory growth', { x: into[0], y: into[1], z: into[2] },
            jsFallback.computeSpringForce(0, 0, 0, 10, 0, 0, 5, 1, 0, 0, 0, 0));
    }

    console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

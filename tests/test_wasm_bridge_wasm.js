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

    console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

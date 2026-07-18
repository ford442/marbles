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
import { fileURLToPath } from 'node:url';
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

    const code = readFileSync(wasmJsPath, 'utf8');
    const wasmBin = new Uint8Array(readFileSync(wasmBinPath));
    const module = { exports: {} };
    const MarblePhysicsModule = new Function(
        'module', 'exports', `${code}\nreturn module.exports.default || module.exports;`
    )(module, module.exports);

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

    wasm.closestPointOnSegmentOut(outPtr, 0, 0, 0, 10, 0, 0, 4, 3, 0);
    const jsCp = jsFallback.closestPointOnSegment(0, 0, 0, 10, 0, 0, 4, 3, 0);
    test('closestPointOnSegmentOut vs JS', { x: runner._scalarOutView[0], y: runner._scalarOutView[1], z: runner._scalarOutView[2] }, jsCp);

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

    console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

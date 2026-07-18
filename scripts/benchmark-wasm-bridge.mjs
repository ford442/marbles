#!/usr/bin/env node
/**
 * Benchmark JS fallback vs WASM (when built) force-field application.
 *
 * Run:
 *   node scripts/benchmark-wasm-bridge.mjs
 *
 * With WASM binary present in public/wasm/:
 *   node scripts/benchmark-wasm-bridge.mjs --wasm
 */

import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _testExports, FORCE_BATCH_THRESHOLD, WASM_HEAP_BATCH_MIN } from '../src/wasm-bridge.js';

const { jsFallback, WasmBatchRunner } = _testExports;

const ENTITY_COUNTS = [50, 200, 1000];
const WARMUP_ITERS = 50;
const BENCH_ITERS = 200;

const FIELD = {
    x: 0, y: 0, z: 0,
    falloffExp: 1.0,
    minDist: 0.5,
    maxDist: 25,
    softening: 0,
    baseStrength: 20,
};

function makeDataset(count) {
    const positions = new Float32Array(count * 3);
    const strengths = new Float32Array(count);
    const forces = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 5 + (i % 17) * 0.35;
        const base = i * 3;
        positions[base] = Math.cos(angle) * radius;
        positions[base + 1] = (i % 5) * 0.4;
        positions[base + 2] = Math.sin(angle) * radius;
        strengths[i] = FIELD.baseStrength * (0.8 + (i % 7) * 0.05);
    }

    return { positions, strengths, forces };
}

function benchScalar(count, dataset) {
    const fn = () => {
        for (let i = 0; i < count; i++) {
            const base = i * 3;
            const force = jsFallback.computeForceField(
                FIELD.x, FIELD.y, FIELD.z,
                dataset.positions[base], dataset.positions[base + 1], dataset.positions[base + 2],
                dataset.strengths[i],
                FIELD.falloffExp, FIELD.minDist, FIELD.maxDist, FIELD.softening
            );
            dataset.forces[base] = force.x;
            dataset.forces[base + 1] = force.y;
            dataset.forces[base + 2] = force.z;
        }
    };

    for (let i = 0; i < WARMUP_ITERS; i++) fn();
    const t0 = performance.now();
    for (let i = 0; i < BENCH_ITERS; i++) fn();
    const ms = (performance.now() - t0) / BENCH_ITERS;
    return ms;
}

function benchBatchJs(count, dataset) {
    const fn = () => {
        jsFallback.computeForceFieldsBatch(
            dataset.positions, dataset.strengths, dataset.forces, count,
            FIELD.x, FIELD.y, FIELD.z,
            FIELD.falloffExp, FIELD.minDist, FIELD.maxDist, FIELD.softening
        );
    };

    for (let i = 0; i < WARMUP_ITERS; i++) fn();
    const t0 = performance.now();
    for (let i = 0; i < BENCH_ITERS; i++) fn();
    const ms = (performance.now() - t0) / BENCH_ITERS;
    return ms;
}

async function loadWasmRunner() {
    const wasmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wasm');
    const wasmJs = path.join(wasmDir, 'marble_physics.js');
    const wasmBin = new Uint8Array(readFileSync(path.join(wasmDir, 'marble_physics.wasm')));
    const code = readFileSync(wasmJs, 'utf8');
    const module = { exports: {} };
    const MarblePhysicsModule = new Function(
        'module', 'exports', `${code}\nreturn module.exports.default || module.exports;`
    )(module, module.exports);
    if (typeof MarblePhysicsModule !== 'function') {
        throw new Error('MarblePhysicsModule is not a function');
    }
    const instance = await MarblePhysicsModule({
        wasmBinary: wasmBin,
        locateFile: (file) => path.join(wasmDir, file),
    });
    return new WasmBatchRunner(instance);
}

async function benchBatchWasm(count, dataset, runner) {
    const fn = () => {
        runner.computeForceFieldsBatch(
            dataset.positions, dataset.strengths, dataset.forces, count,
            FIELD.x, FIELD.y, FIELD.z,
            FIELD.falloffExp, FIELD.minDist, FIELD.maxDist, FIELD.softening
        );
    };

    for (let i = 0; i < WARMUP_ITERS; i++) fn();
    const t0 = performance.now();
    for (let i = 0; i < BENCH_ITERS; i++) fn();
    const ms = (performance.now() - t0) / BENCH_ITERS;
    return ms;
}

function formatRow(cols) {
    return cols.map((c) => String(c).padStart(14)).join('');
}

async function main() {
    const useWasm = process.argv.includes('--wasm');
    let wasmRunner = null;

    if (useWasm) {
        try {
            wasmRunner = await loadWasmRunner();
            console.log('WASM module loaded for benchmark.\n');
        } catch (err) {
            console.warn('WASM benchmark skipped:', err instanceof Error ? err.message : err);
        }
    }

    console.log('MarblePhysics force-field benchmark (ms per frame, lower is better)');
    console.log(`Warmup: ${WARMUP_ITERS} iters, measured: ${BENCH_ITERS} iters`);
    console.log(`Hybrid routing: JS batch for ${FORCE_BATCH_THRESHOLD}..${WASM_HEAP_BATCH_MIN - 1} entities, WASM HEAP batch at ≥${WASM_HEAP_BATCH_MIN}`);
    console.log(formatRow(['Entities', 'Scalar JS', 'Batch JS', 'Speedup', 'Batch WASM', 'WASM vs scalar']));

    const results = [];

    for (const count of ENTITY_COUNTS) {
        const dataset = makeDataset(count);
        const scalarMs = benchScalar(count, dataset);
        const batchJsMs = benchBatchJs(count, dataset);
        const speedup = scalarMs / batchJsMs;

        let wasmMs = null;
        let wasmVsScalar = null;
        if (wasmRunner) {
            wasmMs = await benchBatchWasm(count, dataset, wasmRunner);
            wasmVsScalar = scalarMs / wasmMs;
        }

        results.push({ count, scalarMs, batchJsMs, speedup, wasmMs, wasmVsScalar });

        console.log(formatRow([
            count,
            scalarMs.toFixed(3),
            batchJsMs.toFixed(3),
            `${speedup.toFixed(2)}x`,
            wasmMs ? wasmMs.toFixed(3) : 'n/a',
            wasmVsScalar ? `${wasmVsScalar.toFixed(2)}x` : 'n/a',
        ]));
    }

    console.log('\nJSON summary:');
    console.log(JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        warmupIters: WARMUP_ITERS,
        benchIters: BENCH_ITERS,
        field: FIELD,
        results,
        wasmAvailable: Boolean(wasmRunner),
        node: process.version,
    }, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

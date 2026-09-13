#!/usr/bin/env node
/**
 * benchmark_wasm_batch_simd.mjs
 *
 * Throughput benchmark for the SIMD-vectorized WASM batch kernels
 * (computeForceFieldsBatch, applyVelocityDampingBatch) against a 1000-entity
 * workload. Reports absolute throughput for the currently built
 * public/wasm/marble_physics.{js,wasm}, and — when --baseline-dir points at
 * a previously built copy of those files (e.g. checked out from git history
 * before a WASM change) — reports the improvement between the two.
 *
 * This environment's CPU has significant scheduling jitter, so timings are
 * taken as interleaved current/baseline samples (so a transient load spike
 * affects both sides rather than skewing one), and the minimum across
 * samples is used as the headline number — the standard robust statistic for
 * noisy microbenchmarks, since background interference can only slow a
 * sample down, never speed it up.
 *
 * Run:
 *   node tests/benchmark_wasm_batch_simd.mjs
 *   node tests/benchmark_wasm_batch_simd.mjs --baseline-dir /path/to/old/public/wasm
 */

import { performance } from 'node:perf_hooks';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _testExports } from '../src/wasm-bridge.js';

const { WasmBatchRunner } = _testExports;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const currentWasmDir = path.join(repoRoot, 'public', 'wasm');

const ENTITY_COUNT = 1000;
const WARMUP_MS = 150;
const SAMPLE_MS = 50;
const ROUNDS = 40;
const MIN_IMPROVEMENT_PCT = 20;

function parseArgs(argv) {
    const args = { baselineDir: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--baseline-dir') args.baselineDir = argv[++i];
    }
    return args;
}

async function loadRunner(wasmDir) {
    const wasmBinPath = path.join(wasmDir, 'marble_physics.wasm');
    const wasmJsPath = path.join(wasmDir, 'marble_physics.js');
    if (!existsSync(wasmBinPath) || !existsSync(wasmJsPath)) {
        throw new Error(`missing marble_physics.{js,wasm} in ${wasmDir}`);
    }

    const wasmBin = new Uint8Array(readFileSync(wasmBinPath));
    const module = await import(pathToFileURL(wasmJsPath).href);
    const MarblePhysicsModule = module.default;
    const instance = await MarblePhysicsModule({
        wasmBinary: wasmBin,
        locateFile: (file) => path.join(wasmDir, file),
    });
    return new WasmBatchRunner(instance);
}

function makeForceFieldDataset(count) {
    const positions = new Float32Array(count * 3);
    const strengths = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 5 + (i % 17) * 0.35;
        const base = i * 3;
        positions[base] = Math.cos(angle) * radius;
        positions[base + 1] = (i % 5) * 0.4;
        positions[base + 2] = Math.sin(angle) * radius;
        strengths[i] = 20 * (0.8 + (i % 7) * 0.05);
    }
    return { positions, strengths, out: new Float32Array(count * 3) };
}

function makeVelocityDataset(count) {
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const base = i * 3;
        const speedScale = i % 2 === 0 ? 12 : 3; // mix of over/under the speed cap
        velocities[base] = Math.sin(i) * speedScale;
        velocities[base + 1] = Math.cos(i * 1.3) * speedScale;
        velocities[base + 2] = Math.sin(i * 0.7) * speedScale;
    }
    return { velocities, out: new Float32Array(count * 3) };
}

function makeForceFieldFn(runner, count) {
    const { positions, strengths, out } = makeForceFieldDataset(count);
    return () => runner.computeForceFieldsBatch(
        positions, strengths, out, count,
        0, 0, 0, 1.0, 0.5, 25, 0
    );
}

function makeVelocityDampingFn(runner, count) {
    const { velocities, out } = makeVelocityDataset(count);
    return () => runner.applyVelocityDampingBatch(velocities, out, count, 0.8, 1 / 60, 8);
}

function warmup(fn, ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) fn();
}

function sampleOnce(fn, ms) {
    let iters = 0;
    const t0 = performance.now();
    const end = t0 + ms;
    while (performance.now() < end) { fn(); iters++; }
    return (performance.now() - t0) / Math.max(iters, 1);
}

function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

/** Interleaves sampling of fnA/fnB so transient load hits both sides equally. */
function interleavedBenchmark(fnA, fnB) {
    warmup(fnA, WARMUP_MS);
    warmup(fnB, WARMUP_MS);

    const samplesA = [];
    const samplesB = [];
    for (let r = 0; r < ROUNDS; r++) {
        samplesA.push(sampleOnce(fnA, SAMPLE_MS));
        samplesB.push(sampleOnce(fnB, SAMPLE_MS));
    }

    return {
        minA: Math.min(...samplesA), medianA: median(samplesA),
        minB: Math.min(...samplesB), medianB: median(samplesB),
    };
}

function pctImprovement(baselineMs, currentMs) {
    return ((baselineMs - currentMs) / baselineMs) * 100;
}

function fmtRow(label, result) {
    const current = { min: result.minA, median: result.medianA };
    const baseline = { min: result.minB, median: result.medianB };
    const minPct = pctImprovement(baseline.min, current.min);
    const medianPct = pctImprovement(baseline.median, current.median);
    console.log(`  ${label}`);
    console.log(`    current : min ${current.min.toFixed(4)} ms  median ${current.median.toFixed(4)} ms`);
    console.log(`    baseline: min ${baseline.min.toFixed(4)} ms  median ${baseline.median.toFixed(4)} ms`);
    console.log(`    improvement: min ${minPct.toFixed(1)}%  median ${medianPct.toFixed(1)}%`);
    return minPct;
}

async function main() {
    const { baselineDir } = parseArgs(process.argv.slice(2));

    console.log(`MarblePhysics WASM batch-kernel throughput benchmark (${ENTITY_COUNT} entities)`);
    console.log(`Warmup: ${WARMUP_MS}ms/side, ${ROUNDS} interleaved ${SAMPLE_MS}ms samples/side\n`);

    const currentRunner = await loadRunner(currentWasmDir);

    if (!baselineDir) {
        const ffFn = makeForceFieldFn(currentRunner, ENTITY_COUNT);
        const vdFn = makeVelocityDampingFn(currentRunner, ENTITY_COUNT);
        warmup(ffFn, WARMUP_MS);
        warmup(vdFn, WARMUP_MS);
        console.log('Current build (public/wasm/):');
        console.log(`  computeForceFieldsBatch:    ${sampleOnce(ffFn, 200).toFixed(4)} ms/call`);
        console.log(`  applyVelocityDampingBatch:  ${sampleOnce(vdFn, 200).toFixed(4)} ms/call`);
        console.log('\n(no --baseline-dir given — skipping before/after comparison)');
        return;
    }

    const baselineRunner = await loadRunner(baselineDir);

    console.log('computeForceFieldsBatch (A = current, B = baseline):');
    const ffResult = interleavedBenchmark(
        makeForceFieldFn(currentRunner, ENTITY_COUNT),
        makeForceFieldFn(baselineRunner, ENTITY_COUNT),
    );
    const ffMinPct = fmtRow('computeForceFieldsBatch', ffResult);

    console.log('\napplyVelocityDampingBatch (A = current, B = baseline):');
    const vdResult = interleavedBenchmark(
        makeVelocityDampingFn(currentRunner, ENTITY_COUNT),
        makeVelocityDampingFn(baselineRunner, ENTITY_COUNT),
    );
    const vdMinPct = fmtRow('applyVelocityDampingBatch', vdResult);

    const pass = ffMinPct >= MIN_IMPROVEMENT_PCT && vdMinPct >= MIN_IMPROVEMENT_PCT;
    console.log(`\n${pass ? '✅' : '❌'} Target: >= ${MIN_IMPROVEMENT_PCT}% min-sample improvement on both kernels`);
    if (!pass) process.exitCode = 1;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

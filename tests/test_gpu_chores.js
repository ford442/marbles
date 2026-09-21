import assert from 'node:assert/strict';
import {
    CHORE_OPS,
    CHORES_WORKGROUP_SIZE,
    batchedDistanceCpu,
    compactF32Cpu,
    getChoresBackend,
    getChoresStats,
    getBreadcrumbs,
    isGpuComputeDisabled,
    prefixSumCpu,
    reduceF32Cpu,
    reduceIdentity,
    adoptDevice,
    releaseDevice,
    runJob,
    _testExports,
} from '../src/gpu-chores/index.js';

function resetState() {
    releaseDevice();
    _testExports.resetStats();
    _testExports.clearBreadcrumbs();
    delete globalThis.MARBLES_DISABLE_GPU_COMPUTE;
}

// ── CPU goldens ──────────────────────────────────────────────────────────────

function testReduceGoldens() {
    const data = Float32Array.from([1, -2, 3.5, 0, 10]);
    assert.equal(reduceF32Cpu(data, 'sum'), 12.5);
    assert.equal(reduceF32Cpu(data, 'min'), -2);
    assert.equal(reduceF32Cpu(data, 'max'), 10);
    // Empty input falls back to the op identity.
    assert.equal(reduceF32Cpu(new Float32Array(0), 'sum'), 0);
    assert.equal(reduceF32Cpu(new Float32Array(0), 'min'), reduceIdentity('min'));
    assert.equal(reduceF32Cpu(new Float32Array(0), 'max'), reduceIdentity('max'));
    // Partial count honours the caller's window, not the buffer capacity.
    assert.equal(reduceF32Cpu(data, 'sum', 2), -1);
    assert.equal(reduceF32Cpu(data, 'sum', 999), 12.5);
}

function testCompactGoldens() {
    const flags = Float32Array.from([1, 0, 0, 1, 1, 0, 1]);
    const { indices, count } = compactF32Cpu(flags);
    assert.equal(count, 4);
    assert.deepEqual(Array.from(indices.subarray(0, count)), [0, 3, 4, 6]);

    assert.equal(compactF32Cpu(new Float32Array(0)).count, 0);
    assert.equal(compactF32Cpu(Float32Array.from([0, 0, 0])).count, 0);
    assert.equal(compactF32Cpu(Float32Array.from([1, 1, 1])).count, 3);

    // Threshold is inclusive on the low side.
    assert.equal(compactF32Cpu(Float32Array.from([0.5, 0.49]), 0.5).count, 1);

    // Caller-supplied output buffer is reused rather than reallocated.
    const out = new Uint32Array(8);
    const reused = compactF32Cpu(flags, 0.5, flags.length, out);
    assert.equal(reused.indices, out);
}

function testPrefixSumGolden() {
    const flags = Float32Array.from([1, 0, 0, 1, 1, 0, 1]);
    const { offsets, total } = prefixSumCpu(flags);
    assert.deepEqual(Array.from(offsets), [0, 1, 1, 1, 2, 3, 3]);
    assert.equal(total, 4);
}

function testBatchedDistanceGolden() {
    const points = Float32Array.from([3, 4, 0, 0, 0, 0, 1, 2, 2]);
    const d = batchedDistanceCpu(points, [0, 0, 0]);
    assert.ok(Math.abs(d[0] - 5) < 1e-6);
    assert.equal(d[1], 0);
    assert.ok(Math.abs(d[2] - 3) < 1e-6);

    const sq = batchedDistanceCpu(points, [0, 0, 0], { squared: true });
    assert.ok(Math.abs(sq[0] - 25) < 1e-5);

    const out = new Float32Array(3);
    assert.equal(batchedDistanceCpu(points, [0, 0, 0], { out }), out);
}

// ── GPU-kernel parity (runs on CI without a GPU) ─────────────────────────────

/**
 * JS mirror of compact_f32.wgsl: per-workgroup exclusive scan, serial scan of
 * the block totals, then scatter. Pins the kernel's decomposition against the
 * golden so a parity break localises to a pass.
 */
function compactLikeKernel(flags, threshold, workgroupSize) {
    const count = flags.length;
    const blocks = Math.max(1, Math.ceil(count / workgroupSize));
    const localOffsets = new Uint32Array(count);
    const blockSums = new Uint32Array(blocks + 1);

    for (let b = 0; b < blocks; b++) {
        let running = 0;
        for (let lane = 0; lane < workgroupSize; lane++) {
            const i = b * workgroupSize + lane;
            const p = i < count && flags[i] >= threshold ? 1 : 0;
            if (i < count) localOffsets[i] = running;
            running += p;
        }
        blockSums[b] = running;
    }

    let running = 0;
    for (let b = 0; b < blocks; b++) {
        const total = blockSums[b];
        blockSums[b] = running;
        running += total;
    }
    blockSums[blocks] = running;

    const indices = new Uint32Array(running);
    for (let i = 0; i < count; i++) {
        if (flags[i] < threshold) continue;
        indices[blockSums[Math.floor(i / workgroupSize)] + localOffsets[i]] = i;
    }
    return { indices, count: running };
}

function testCompactKernelParity() {
    const sizes = [0, 1, 63, 64, 65, 127, 128, 200, 1024, 8192];
    let seed = 1337;
    const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    for (const n of sizes) {
        const flags = new Float32Array(n);
        for (let i = 0; i < n; i++) flags[i] = rand() < 0.4 ? 1 : 0;

        const golden = compactF32Cpu(flags, 0.5);
        const kernel = compactLikeKernel(flags, 0.5, CHORES_WORKGROUP_SIZE);
        assert.equal(kernel.count, golden.count, `count mismatch at n=${n}`);
        assert.deepEqual(
            Array.from(kernel.indices),
            Array.from(golden.indices.subarray(0, golden.count)),
            `index mismatch at n=${n}`
        );
    }
}

/** JS mirror of reduce_f32.wgsl's two-pass block reduction. */
function reduceLikeKernel(data, op, workgroupSize) {
    const blocks = Math.max(1, Math.ceil(data.length / workgroupSize));
    const partials = new Float64Array(blocks);
    for (let b = 0; b < blocks; b++) {
        let acc = reduceIdentity(op);
        for (let lane = 0; lane < workgroupSize; lane++) {
            const i = b * workgroupSize + lane;
            if (i >= data.length) continue;
            if (op === 'min') acc = Math.min(acc, data[i]);
            else if (op === 'max') acc = Math.max(acc, data[i]);
            else acc += data[i];
        }
        partials[b] = acc;
    }
    let acc = reduceIdentity(op);
    for (let b = 0; b < blocks; b++) {
        if (op === 'min') acc = Math.min(acc, partials[b]);
        else if (op === 'max') acc = Math.max(acc, partials[b]);
        else acc += partials[b];
    }
    return acc;
}

function testReduceKernelParity() {
    for (const n of [0, 1, 64, 65, 300, 4096]) {
        const data = new Float32Array(n);
        for (let i = 0; i < n; i++) data[i] = ((i * 37) % 19) - 9;
        for (const op of ['min', 'max']) {
            assert.equal(
                reduceLikeKernel(data, op, CHORES_WORKGROUP_SIZE),
                reduceF32Cpu(data, op),
                `${op} mismatch at n=${n}`
            );
        }
        // Summation regroups, so parity is to float tolerance rather than bits.
        const delta = Math.abs(
            reduceLikeKernel(data, 'sum', CHORES_WORKGROUP_SIZE) - reduceF32Cpu(data, 'sum')
        );
        assert.ok(delta < 1e-3, `sum mismatch at n=${n}: ${delta}`);
    }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

async function testRunJobFallsBackToCpuWithoutDevice() {
    resetState();
    assert.equal(getChoresBackend(), 'cpu');

    const reduced = await runJob({ op: 'reduce_f32', data: Float32Array.from([1, 2, 3]) });
    assert.equal(reduced.backend, 'cpu');
    assert.equal(reduced.value, 6);

    const compacted = await runJob({
        op: 'compact_f32',
        data: Float32Array.from([0, 1, 1]),
    });
    assert.equal(compacted.backend, 'cpu');
    assert.deepEqual(Array.from(compacted.indices), [1, 2]);
    assert.equal(compacted.gpuBuffer, null);

    const distances = await runJob({
        op: 'batched_distance',
        points: Float32Array.from([3, 4, 0]),
        origin: [0, 0, 0],
    });
    assert.equal(distances.backend, 'cpu');
    assert.ok(Math.abs(distances.distances[0] - 5) < 1e-6);

    assert.equal(getChoresStats().cpuJobs, 3);
    assert.equal(getChoresStats().gpuJobs, 0);
}

async function testUnknownOpRejects() {
    resetState();
    await assert.rejects(() => runJob({ op: 'sort_f32', data: new Float32Array(1) }), /unknown op/);
    await assert.rejects(() => runJob({}), /requires an \{ op \} descriptor/);
}

function testKillSwitch() {
    resetState();
    assert.equal(isGpuComputeDisabled(), false);
    globalThis.MARBLES_DISABLE_GPU_COMPUTE = true;
    assert.equal(isGpuComputeDisabled(), true);
    assert.equal(getChoresBackend(), 'cpu');
    delete globalThis.MARBLES_DISABLE_GPU_COMPUTE;
}

async function testKillSwitchBeatsAdoptedDevice() {
    resetState();
    const fakeDevice = { lost: Promise.resolve({ reason: 'never' }) };
    assert.equal(adoptDevice(fakeDevice), true);
    assert.equal(getChoresBackend(), 'webgpu');

    globalThis.MARBLES_DISABLE_GPU_COMPUTE = true;
    assert.equal(getChoresBackend(), 'cpu');
    const result = await runJob({ op: 'reduce_f32', data: Float32Array.from([2, 2]) });
    assert.equal(result.backend, 'cpu');
    assert.equal(result.value, 4);
    delete globalThis.MARBLES_DISABLE_GPU_COMPUTE;
    releaseDevice();
}

function testAdoptDeviceNeverCreatesOne() {
    resetState();
    assert.equal(adoptDevice(null), false);
    assert.equal(_testExports.getAdoptedDevice(), null);
    assert.equal(getChoresBackend(), 'cpu');
}

async function testGpuJobRoutesThroughAdoptedBackend() {
    resetState();
    adoptDevice({ lost: new Promise(() => {}) });

    const calls = [];
    _testExports.setGpuBackendForTest({
        async reduceF32(job) { calls.push(['reduce', job.count]); return 42; },
        async compactF32(job) {
            calls.push(['compact', job.count]);
            return { indices: Uint32Array.from([1, 4]), count: 2, gpuBuffer: 'buf' };
        },
        async batchedDistance() { return Float32Array.from([1]); },
        dispose() {},
    });

    const reduced = await runJob({ op: 'reduce_f32', data: new Float32Array(10) });
    assert.equal(reduced.backend, 'webgpu');
    assert.equal(reduced.value, 42);

    const compacted = await runJob({ op: 'compact_f32', data: new Float32Array(8) });
    assert.equal(compacted.backend, 'webgpu');
    assert.equal(compacted.count, 2);
    assert.equal(compacted.gpuBuffer, 'buf');

    assert.deepEqual(calls, [['reduce', 10], ['compact', 8]]);
    assert.equal(getChoresStats().gpuJobs, 2);

    // prefer: 'cpu' bypasses the GPU even with a device adopted.
    const forced = await runJob({ op: 'reduce_f32', data: Float32Array.from([5]), prefer: 'cpu' });
    assert.equal(forced.backend, 'cpu');
    assert.equal(forced.value, 5);

    releaseDevice();
}

async function testGpuFailureFallsBackAndLeavesBreadcrumb() {
    resetState();
    adoptDevice({ lost: new Promise(() => {}) });
    _testExports.setGpuBackendForTest({
        async reduceF32() { throw new Error('device exploded'); },
        dispose() {},
    });

    const result = await runJob({ op: 'reduce_f32', data: Float32Array.from([1, 2, 3, 4]) });
    assert.equal(result.backend, 'cpu');
    assert.equal(result.value, 10);
    assert.equal(getChoresStats().gpuFallbacks, 1);

    const tags = getBreadcrumbs().map((b) => b.tag);
    assert.ok(tags.includes('device-adopted'), 'device adoption should leave a breadcrumb');
    assert.ok(tags.includes('gpu-job-failed'), 'GPU failure should leave a breadcrumb');

    releaseDevice();
}

async function testGpuBufferJobHasNoCpuFallback() {
    resetState();
    adoptDevice({ lost: new Promise(() => {}) });
    _testExports.setGpuBackendForTest({
        async compactF32() { throw new Error('mapAsync failed'); },
        dispose() {},
    });

    // Resident GPU data cannot be re-run on the CPU; the caller must be told.
    await assert.rejects(
        () => runJob({ op: 'compact_f32', data: { residentBuffer: true }, count: 64 }),
        /mapAsync failed/
    );
    releaseDevice();
}

function testOpsList() {
    assert.deepEqual(CHORE_OPS, ['reduce_f32', 'compact_f32', 'batched_distance']);
    assert.equal(CHORES_WORKGROUP_SIZE, 64);
}

testReduceGoldens();
testCompactGoldens();
testPrefixSumGolden();
testBatchedDistanceGolden();
testCompactKernelParity();
testReduceKernelParity();
testKillSwitch();
testAdoptDeviceNeverCreatesOne();
testOpsList();

await testRunJobFallsBackToCpuWithoutDevice();
await testUnknownOpRejects();
await testKillSwitchBeatsAdoptedDevice();
await testGpuJobRoutesThroughAdoptedBackend();
await testGpuFailureFallsBackAndLeavesBreadcrumb();
await testGpuBufferJobHasNoCpuFallback();

resetState();
console.log('gpu-chores tests passed');

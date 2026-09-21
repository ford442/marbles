/**
 * gpu-chores — reusable GPU job helpers (Tier B of the cross-app rollout).
 *
 * Scope: generic "scan this buffer / compact the survivors / reduce it"
 * work that looks the same in every app. Domain compute stays where it is —
 * `src/webgpu/shaders/particle-integrate.wgsl`, the noise texture kernel and
 * marble physics authority are all still marbles-owned.
 *
 * Backend order is WebGPU -> WASM/JS. WebGL2 is deliberately absent: Filament
 * already holds the WebGL2 context, and standing a second live GPU API next to
 * it on the same working set is the driver/VRAM risk this rollout avoids. When
 * no WebGPU device has been handed over, chores simply run on the CPU.
 *
 * @example
 * const { count, indices } = await runJob({
 *     op: 'compact_f32', data: aliveFlags, threshold: 0.5, prefer: 'auto',
 * });
 */

import { breadcrumb, clearBreadcrumbs, isGpuComputeDisabled } from './detect.js';
import { batchedDistanceCpu, compactF32Cpu, reduceF32Cpu } from './cpu-jobs.js';

export {
    batchedDistanceCpu,
    compactF32Cpu,
    prefixSumCpu,
    reduceF32Cpu,
    reduceIdentity,
} from './cpu-jobs.js';
export {
    breadcrumb,
    getBreadcrumbs,
    isGpuComputeDisabled,
    isWebGLOnlySession,
    CHORES_WORKGROUP_SIZE,
} from './detect.js';

/** Ops this module answers to. */
export const CHORE_OPS = ['reduce_f32', 'compact_f32', 'batched_distance'];

/** @typedef {'auto' | 'gpu' | 'cpu'} JobPreference */
/** @typedef {'webgpu' | 'cpu' | 'none'} ChoresBackend */

/** @type {GPUDevice | null} */
let adoptedDevice = null;
/** @type {import('./webgpu-jobs.js').WebGPUChoresBackend | null} */
let gpuBackend = null;
/** @type {Promise<import('./webgpu-jobs.js').WebGPUChoresBackend | null> | null} */
let gpuBackendPromise = null;
/** @type {ChoresBackend} */
let lastBackend = 'none';

const stats = { gpuJobs: 0, cpuJobs: 0, gpuFallbacks: 0 };

/**
 * Adopt a device the renderer already owns. Chores never create one, and never
 * destroy the one they are lent.
 *
 * @param {GPUDevice | null} device
 * @returns {boolean} true when the device was taken up.
 */
export function adoptDevice(device) {
    if (!device) return false;
    if (adoptedDevice === device) return true;
    releaseDevice();
    adoptedDevice = device;
    breadcrumb('device-adopted', { source: 'renderer' });
    device.lost?.then((info) => {
        if (adoptedDevice !== device) return;
        breadcrumb('device-lost', { reason: info?.reason ?? 'unknown' });
        releaseDevice();
    });
    return true;
}

/**
 * Drop the adopted device and tear down chores-owned GPU resources. The device
 * itself is left alone — its owner disposes it.
 */
export function releaseDevice() {
    if (gpuBackend) {
        gpuBackend.dispose();
        gpuBackend = null;
    }
    gpuBackendPromise = null;
    adoptedDevice = null;
}

/**
 * The backend the next `prefer: 'auto'` job would pick.
 *
 * @returns {ChoresBackend}
 */
export function getChoresBackend() {
    if (isGpuComputeDisabled()) return 'cpu';
    return adoptedDevice ? 'webgpu' : 'cpu';
}

/**
 * The backend the most recent job actually ran on, plus job counters.
 *
 * @returns {{ backend: ChoresBackend, gpuJobs: number, cpuJobs: number, gpuFallbacks: number }}
 */
export function getChoresStats() {
    return { backend: lastBackend, ...stats };
}

/**
 * @param {JobPreference} prefer
 * @returns {boolean}
 */
function shouldTryGpu(prefer) {
    if (prefer === 'cpu') return false;
    if (isGpuComputeDisabled()) return false;
    // A WebGL-only session never hands a device over, so this is also what keeps
    // chores off a second, dual-hot GPU API: `prefer: 'gpu'` cannot conjure one.
    return adoptedDevice !== null;
}

/**
 * @returns {Promise<import('./webgpu-jobs.js').WebGPUChoresBackend | null>}
 */
async function ensureGpuBackend() {
    if (gpuBackend) return gpuBackend;
    if (!adoptedDevice) return null;
    if (!gpuBackendPromise) {
        const device = adoptedDevice;
        gpuBackendPromise = import('./webgpu-jobs.js')
            .then((mod) => {
                if (adoptedDevice !== device) return null;
                gpuBackend = new mod.WebGPUChoresBackend(device);
                breadcrumb('webgpu-backend-ready');
                return gpuBackend;
            })
            .catch((err) => {
                breadcrumb('webgpu-backend-load-failed', { message: String(err?.message ?? err) });
                return null;
            });
    }
    return gpuBackendPromise;
}

/**
 * @param {object} job
 * @returns {Promise<object>}
 */
async function runOnCpu(job) {
    stats.cpuJobs += 1;
    lastBackend = 'cpu';
    switch (job.op) {
        case 'reduce_f32': {
            const data = job.data;
            const count = job.count ?? data.length;
            return { backend: 'cpu', value: reduceF32Cpu(data, job.reduce ?? 'sum', count) };
        }
        case 'compact_f32': {
            const data = job.data;
            const count = job.count ?? data.length;
            const result = compactF32Cpu(data, job.threshold ?? 0.5, count, job.out);
            return {
                backend: 'cpu',
                indices: result.indices.subarray(0, result.count),
                count: result.count,
                gpuBuffer: null,
            };
        }
        case 'batched_distance': {
            return {
                backend: 'cpu',
                distances: batchedDistanceCpu(job.points, job.origin ?? [0, 0, 0], {
                    squared: job.squared === true,
                    ...(job.out ? { out: job.out } : {}),
                }),
            };
        }
        default:
            throw new Error(`[gpu-chores] unknown op "${job.op}"`);
    }
}

/**
 * @param {import('./webgpu-jobs.js').WebGPUChoresBackend} backend
 * @param {object} job
 * @returns {Promise<object>}
 */
async function runOnGpu(backend, job) {
    switch (job.op) {
        case 'reduce_f32': {
            const count = job.count ?? job.data.length;
            const value = await backend.reduceF32({
                data: job.data,
                count,
                reduce: job.reduce ?? 'sum',
            });
            return { backend: 'webgpu', value };
        }
        case 'compact_f32': {
            const count = job.count ?? job.data.length;
            const result = await backend.compactF32({
                data: job.data,
                count,
                threshold: job.threshold ?? 0.5,
                readIndices: job.readIndices !== false,
            });
            return { backend: 'webgpu', ...result };
        }
        case 'batched_distance': {
            const distances = await backend.batchedDistance({
                points: job.points,
                origin: job.origin ?? [0, 0, 0],
                squared: job.squared === true,
            });
            return { backend: 'webgpu', distances };
        }
        default:
            throw new Error(`[gpu-chores] unknown op "${job.op}"`);
    }
}

/**
 * Run a chore. Shared API across the rollout: `runJob({ op, prefer: 'auto' })`.
 *
 * Ops:
 * - `reduce_f32`      `{ data, count?, reduce: 'sum'|'min'|'max' }` -> `{ value }`
 * - `compact_f32`     `{ data, count?, threshold?, readIndices? }`
 *                     -> `{ indices, count, gpuBuffer }`
 * - `batched_distance` `{ points, origin, squared? }` -> `{ distances }`
 *
 * `data` may be a `Float32Array` or, on the GPU path, a `GPUBuffer` that is
 * already resident — in which case nothing is uploaded and only the count is
 * read back (pass `readIndices: false` to keep the index list on the GPU too).
 *
 * A GPU failure is never fatal: the job is retried on the CPU and a breadcrumb
 * records why.
 *
 * @param {{ op: string, prefer?: JobPreference } & Record<string, any>} job
 * @returns {Promise<Record<string, any>>}
 */
export async function runJob(job) {
    if (!job || typeof job.op !== 'string') {
        throw new Error('[gpu-chores] runJob requires an { op } descriptor');
    }
    const prefer = job.prefer ?? 'auto';

    if (!shouldTryGpu(prefer)) {
        return runOnCpu(job);
    }

    const backend = await ensureGpuBackend();
    if (!backend) {
        breadcrumb('gpu-unavailable', { op: job.op });
        return runOnCpu(job);
    }

    try {
        const result = await runOnGpu(backend, job);
        stats.gpuJobs += 1;
        lastBackend = 'webgpu';
        return result;
    } catch (err) {
        stats.gpuFallbacks += 1;
        breadcrumb('gpu-job-failed', { op: job.op, message: String(err?.message ?? err) });
        if (job.data instanceof Float32Array || job.points instanceof Float32Array) {
            return runOnCpu(job);
        }
        throw err;
    }
}

/** @internal Exported for unit tests. */
export const _testExports = {
    clearBreadcrumbs,
    resetStats() {
        stats.gpuJobs = 0;
        stats.cpuJobs = 0;
        stats.gpuFallbacks = 0;
        lastBackend = 'none';
    },
    setGpuBackendForTest(backend) {
        gpuBackend = backend;
        gpuBackendPromise = backend ? Promise.resolve(backend) : null;
    },
    getAdoptedDevice() {
        return adoptedDevice;
    },
};

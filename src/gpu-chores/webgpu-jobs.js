// @ts-check
/**
 * gpu-chores — WebGPU backend.
 *
 * Adopts a device the renderer already created; this module never calls
 * `requestAdapter()` / `requestDevice()`. Pipelines and scratch buffers are
 * built lazily on first use and grow by reallocation, so a session that only
 * ever runs `compact` pays nothing for `reduce`.
 */

import reduceShader from './shaders/reduce_f32.wgsl?raw';
import compactShader from './shaders/compact_f32.wgsl?raw';
import distanceShader from './shaders/batched_distance.wgsl?raw';
import { CHORES_WORKGROUP_SIZE, breadcrumb } from './detect.js';
import { withValidationScope } from '../webgpu/error-scope.js';

const WG = CHORES_WORKGROUP_SIZE;

/** @typedef {import('./cpu-jobs.js').ReduceOp} ReduceOp */
/** @typedef {'read-only-storage' | 'storage' | 'uniform'} BindingType */

/** @type {Record<ReduceOp, number>} */
const REDUCE_CODES = { sum: 0, min: 1, max: 2 };

/**
 * @param {number} bytes
 * @returns {number}
 */
function align4(bytes) {
    return Math.max(4, Math.ceil(bytes / 4) * 4);
}

/**
 * Explicit bind group layout.
 *
 * `layout: 'auto'` derives the layout from the bindings an entry point actually
 * uses, so the multi-pass kernels here (scan_blocks touches neither `flags` nor
 * `indices`) would each get a different layout and reject a shared bind group.
 * Declaring the layout once keeps one bind group valid across all passes.
 *
 * @param {GPUDevice} device
 * @param {readonly BindingType[]} types
 * @returns {GPUBindGroupLayout}
 */
function bindGroupLayout(device, types) {
    return device.createBindGroupLayout({
        entries: types.map((type, binding) => ({
            binding,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type },
        })),
    });
}

/**
 * One shader module's pipelines, keyed by entry point.
 * @template {string} E
 * @typedef {{ bindGroupLayout: GPUBindGroupLayout, pipelines: Record<E, GPUComputePipeline> }} PipelineSet
 */

/** @typedef {'reduce_block' | 'reduce_partials'} ReduceEntry */
/** @typedef {'block_scan' | 'scan_blocks' | 'scatter'} CompactEntry */
/** @typedef {'main'} DistanceEntry */

/**
 * @typedef {object} ReduceGpuJob
 * @property {Float32Array | GPUBuffer} data
 * @property {number} count
 * @property {ReduceOp} reduce
 */

/**
 * @typedef {object} CompactGpuJob
 * @property {Float32Array | GPUBuffer} data
 * @property {number} count
 * @property {number} threshold
 * @property {boolean} [readIndices]
 */

/** @typedef {{ indices: Uint32Array | null, count: number, gpuBuffer: GPUBuffer }} CompactGpuResult */

/**
 * @typedef {object} DistanceGpuJob
 * @property {Float32Array} points
 * @property {ArrayLike<number>} origin
 * @property {boolean} squared
 */

export class WebGPUChoresBackend {
    /** @param {GPUDevice} device */
    constructor(device) {
        /** @type {GPUDevice | null} Lent by the renderer; dropped (never destroyed) on dispose. */
        this.device = device;
        this.disposed = false;
        /** @type {Map<string, GPUBuffer>} */
        this._buffers = new Map();
        /** @type {Set<string>} Staging keys with a map in flight. */
        this._stagingBusy = new Set();
        /** @type {Promise<PipelineSet<ReduceEntry>> | null} */
        this._reduce = null;
        /** @type {Promise<PipelineSet<CompactEntry>> | null} */
        this._compact = null;
        /** @type {Promise<PipelineSet<DistanceEntry>> | null} */
        this._distance = null;
    }

    /**
     * The lent device. Read at every use (not cached across awaits) so a job
     * still in flight when `dispose()` runs fails instead of touching GPU state.
     *
     * @returns {GPUDevice}
     */
    _gpu() {
        if (!this.device) throw new Error('[gpu-chores] WebGPU backend used after dispose');
        return this.device;
    }

    /**
     * Reusable scratch buffer, reallocated only when it needs to grow.
     *
     * @param {string} key
     * @param {number} bytes
     * @param {number} usage
     * @returns {GPUBuffer}
     */
    _scratch(key, bytes, usage) {
        const size = align4(bytes);
        const existing = this._buffers.get(key);
        if (existing && existing.size >= size) return existing;
        try { existing?.destroy(); } catch { /* already gone */ }
        const buffer = this._gpu().createBuffer({ size, usage });
        this._buffers.set(key, buffer);
        return buffer;
    }

    /**
     * @template {string} E
     * @param {string} code
     * @param {readonly BindingType[]} types
     * @param {readonly E[]} entryPoints
     * @returns {Promise<PipelineSet<E>>} Rejects on a validation error (the job
     *     then falls back to the CPU in `runJob`).
     */
    _buildPipelines(code, types, entryPoints) {
        return withValidationScope(this._gpu(), `gpu-chores ${entryPoints.join('/')}`, () => this._createPipelines(code, types, entryPoints));
    }

    /**
     * @template {string} E
     * @param {string} code
     * @param {readonly BindingType[]} types
     * @param {readonly E[]} entryPoints
     * @returns {PipelineSet<E>}
     */
    _createPipelines(code, types, entryPoints) {
        const device = this._gpu();
        const module = device.createShaderModule({ code });
        const layout = bindGroupLayout(device, types);
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [layout],
        });
        /** @type {Partial<Record<E, GPUComputePipeline>>} */
        const pipelines = {};
        for (const entryPoint of entryPoints) {
            pipelines[entryPoint] = device.createComputePipeline({
                layout: pipelineLayout,
                compute: { module, entryPoint },
            });
        }
        // The loop above assigned every key in `entryPoints`, i.e. every E.
        return { bindGroupLayout: layout, pipelines: /** @type {Record<E, GPUComputePipeline>} */ (pipelines) };
    }

    /** @returns {Promise<PipelineSet<ReduceEntry>>} */
    _reducePipelines() {
        if (!this._reduce) {
            this._reduce = this._buildPipelines(
                reduceShader,
                ['read-only-storage', 'storage', 'uniform'],
                ['reduce_block', 'reduce_partials']
            );
        }
        return this._reduce;
    }

    /** @returns {Promise<PipelineSet<CompactEntry>>} */
    _compactPipelines() {
        if (!this._compact) {
            this._compact = this._buildPipelines(
                compactShader,
                ['read-only-storage', 'storage', 'storage', 'storage', 'uniform'],
                ['block_scan', 'scan_blocks', 'scatter']
            );
        }
        return this._compact;
    }

    /** @returns {Promise<PipelineSet<DistanceEntry>>} */
    _distancePipelines() {
        if (!this._distance) {
            this._distance = this._buildPipelines(
                distanceShader,
                ['read-only-storage', 'storage', 'uniform'],
                ['main']
            );
        }
        return this._distance;
    }

    /**
     * Upload a Float32 payload, or reuse a caller-owned storage buffer when the
     * data already lives on the GPU (avoids a pointless round trip).
     *
     * @param {string} key
     * @param {Float32Array | GPUBuffer} source
     * @param {number} count
     * @returns {GPUBuffer}
     */
    _asStorage(key, source, count) {
        if (!(source instanceof Float32Array)) return source;
        const buffer = this._scratch(
            key,
            count * 4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        this._gpu().queue.writeBuffer(buffer, 0, source, 0, count);
        return buffer;
    }

    /**
     * Copy a GPU range to the host.
     *
     * Staging buffers are pooled per key: the particle path runs this every
     * frame, and allocating a mappable buffer per frame is exactly the churn
     * this module is supposed to remove. A key already mapped (re-entrant
     * caller) falls back to a throwaway buffer.
     *
     * @param {GPUBuffer} src
     * @param {number} bytes
     * @param {string} key
     * @returns {Promise<ArrayBuffer>}
     */
    async _readback(src, bytes, key) {
        const size = align4(bytes);
        const pooled = !this._stagingBusy.has(key);
        let staging;
        if (pooled) {
            this._stagingBusy.add(key);
            staging = this._scratch(
                `staging:${key}`,
                size,
                GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            );
        } else {
            staging = this._gpu().createBuffer({
                size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
        }

        try {
            const device = this._gpu();
            const encoder = device.createCommandEncoder();
            encoder.copyBufferToBuffer(src, 0, staging, 0, size);
            device.queue.submit([encoder.finish()]);
            await staging.mapAsync(GPUMapMode.READ, 0, size);
            const copy = staging.getMappedRange(0, size).slice(0);
            staging.unmap();
            return copy;
        } finally {
            if (pooled) this._stagingBusy.delete(key);
            else { try { staging.destroy(); } catch { /* already gone */ } }
        }
    }

    /**
     * @param {ReduceGpuJob} job
     * @returns {Promise<number>}
     */
    async reduceF32(job) {
        const { count } = job;
        const blocks = Math.max(1, Math.ceil(count / WG));
        const { bindGroupLayout: layout, pipelines } = await this._reducePipelines();

        const dataBuffer = this._asStorage('reduce:data', job.data, count);
        const partials = this._scratch(
            'reduce:partials',
            blocks * 4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        );
        const params = this._scratch(
            'reduce:params',
            16,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        this._gpu().queue.writeBuffer(params, 0, new Uint32Array([
            count,
            REDUCE_CODES[job.reduce] ?? 0,
            blocks,
            0,
        ]));

        const device = this._gpu();
        const bindGroup = device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: dataBuffer } },
                { binding: 1, resource: { buffer: partials } },
                { binding: 2, resource: { buffer: params } },
            ],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipelines.reduce_block);
        pass.dispatchWorkgroups(blocks);
        pass.setPipeline(pipelines.reduce_partials);
        pass.dispatchWorkgroups(1);
        pass.end();
        device.queue.submit([encoder.finish()]);

        const result = await this._readback(partials, 4, 'reduce');
        // The readback is 4 bytes, so element 0 always exists.
        return new Float32Array(result)[0] ?? 0;
    }

    /**
     * Stream compaction. Returns the survivor indices plus the GPU buffer that
     * still holds them, so a renderer can consume the list without a copy.
     *
     * @param {CompactGpuJob} job
     * @returns {Promise<CompactGpuResult>}
     */
    async compactF32(job) {
        const { count, threshold } = job;
        const blocks = Math.max(1, Math.ceil(count / WG));
        const { bindGroupLayout: layout, pipelines } = await this._compactPipelines();

        const flags = this._asStorage('compact:flags', job.data, count);
        const localOffsets = this._scratch(
            'compact:local',
            Math.max(1, count) * 4,
            GPUBufferUsage.STORAGE
        );
        // One extra slot: scan_blocks parks the survivor count at [blockCount].
        const blockSums = this._scratch(
            'compact:sums',
            (blocks + 1) * 4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        );
        const indices = this._scratch(
            'compact:indices',
            Math.max(1, count) * 4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        );
        const params = this._scratch(
            'compact:params',
            16,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const paramData = new ArrayBuffer(16);
        const paramView = new DataView(paramData);
        paramView.setUint32(0, count, true);
        paramView.setUint32(4, blocks, true);
        paramView.setFloat32(8, threshold, true);
        this._gpu().queue.writeBuffer(params, 0, paramData);

        const device = this._gpu();
        const bindGroup = device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: flags } },
                { binding: 1, resource: { buffer: localOffsets } },
                { binding: 2, resource: { buffer: blockSums } },
                { binding: 3, resource: { buffer: indices } },
                { binding: 4, resource: { buffer: params } },
            ],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        /** @type {ReadonlyArray<readonly [CompactEntry, number]>} */
        const passes = [
            ['block_scan', blocks],
            ['scan_blocks', 1],
            ['scatter', blocks],
        ];
        for (const [entryPoint, groups] of passes) {
            pass.setPipeline(pipelines[entryPoint]);
            pass.dispatchWorkgroups(groups);
        }
        pass.end();
        device.queue.submit([encoder.finish()]);

        const sums = new Uint32Array(
            await this._readback(blockSums, (blocks + 1) * 4, 'compact:sums')
        );
        // `sums` holds blocks + 1 entries; the last is the survivor count.
        const survivors = sums[blocks] ?? 0;

        if (job.readIndices === false || survivors === 0) {
            return { indices: null, count: survivors, gpuBuffer: indices };
        }
        const indexBytes = new Uint32Array(
            await this._readback(indices, survivors * 4, 'compact:indices')
        );
        return { indices: indexBytes.subarray(0, survivors), count: survivors, gpuBuffer: indices };
    }

    /**
     * @param {DistanceGpuJob} job
     * @returns {Promise<Float32Array>}
     */
    async batchedDistance(job) {
        const count = Math.floor(job.points.length / 3);
        if (count === 0) return new Float32Array(0);
        const { bindGroupLayout: layout, pipelines } = await this._distancePipelines();

        const points = this._asStorage('dist:points', job.points, count * 3);
        const out = this._scratch(
            'dist:out',
            count * 4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        );
        const params = this._scratch(
            'dist:params',
            32,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const paramData = new ArrayBuffer(32);
        const paramView = new DataView(paramData);
        paramView.setUint32(0, count, true);
        paramView.setUint32(4, job.squared ? 0 : 1, true);
        paramView.setFloat32(16, job.origin[0] || 0, true);
        paramView.setFloat32(20, job.origin[1] || 0, true);
        paramView.setFloat32(24, job.origin[2] || 0, true);
        this._gpu().queue.writeBuffer(params, 0, paramData);

        const device = this._gpu();
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipelines.main);
        pass.setBindGroup(0, device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: { buffer: points } },
                { binding: 1, resource: { buffer: out } },
                { binding: 2, resource: { buffer: params } },
            ],
        }));
        pass.dispatchWorkgroups(Math.ceil(count / WG));
        pass.end();
        device.queue.submit([encoder.finish()]);

        return new Float32Array(await this._readback(out, count * 4, 'dist'));
    }

    /** @returns {void} */
    dispose() {
        this.disposed = true;
        for (const buffer of this._buffers.values()) {
            try { buffer.destroy(); } catch { /* already gone */ }
        }
        this._buffers.clear();
        this._stagingBusy.clear();
        this._reduce = null;
        this._compact = null;
        this._distance = null;
        breadcrumb('webgpu-backend-disposed');
        // The device belongs to the renderer that lent it to us — never destroyed here.
        this.device = null;
    }
}

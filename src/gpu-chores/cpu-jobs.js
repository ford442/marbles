/**
 * gpu-chores — CPU (WASM/JS) job implementations.
 *
 * These are the goldens: the WebGPU kernels in `webgpu-jobs.js` must produce
 * bit-comparable results for `compact` and index-order-stable results for
 * `reduce`. CI runs without a GPU, so these are also what the unit tests pin.
 */

import { getMarblePhysics, isWasmActive } from '../wasm-bridge.js';

/** @typedef {'sum' | 'min' | 'max'} ReduceOp */

/**
 * Identity element for a reduction over an empty input.
 *
 * @param {ReduceOp} reduce
 * @returns {number}
 */
export function reduceIdentity(reduce) {
    if (reduce === 'min') return Infinity;
    if (reduce === 'max') return -Infinity;
    return 0;
}

/**
 * Reduce a Float32 range to a single scalar.
 *
 * @param {Float32Array | number[]} data
 * @param {ReduceOp} [reduce]
 * @param {number} [count] Elements to consider (defaults to the whole input).
 * @returns {number}
 */
export function reduceF32Cpu(data, reduce = 'sum', count = data.length) {
    const n = Math.max(0, Math.min(count, data.length));
    let acc = reduceIdentity(reduce);
    for (let i = 0; i < n; i++) {
        const v = data[i];
        if (reduce === 'min') acc = v < acc ? v : acc;
        else if (reduce === 'max') acc = v > acc ? v : acc;
        else acc += v;
    }
    return acc;
}

/**
 * Stable stream compaction: returns the ascending indices whose flag passes
 * `>= threshold`, plus the survivor count.
 *
 * Mirrors the GPU prefix-sum kernel, which is also stable by construction.
 *
 * @param {Float32Array | number[]} flags
 * @param {number} [threshold]
 * @param {number} [count]
 * @param {Uint32Array} [out] Optional reusable output (must hold `count` entries).
 * @returns {{ indices: Uint32Array, count: number }}
 */
export function compactF32Cpu(flags, threshold = 0.5, count = flags.length, out = undefined) {
    const n = Math.max(0, Math.min(count, flags.length));
    const indices = out && out.length >= n ? out : new Uint32Array(n);
    let written = 0;
    for (let i = 0; i < n; i++) {
        if (flags[i] >= threshold) {
            indices[written] = i;
            written += 1;
        }
    }
    return { indices, count: written };
}

/**
 * Exclusive prefix sum over the 0/1 predicate derived from `flags`.
 *
 * Exposed on its own because the GPU compact is built from the same scan, and
 * pinning the scan directly makes parity failures far easier to localise.
 *
 * @param {Float32Array | number[]} flags
 * @param {number} [threshold]
 * @param {number} [count]
 * @returns {{ offsets: Uint32Array, total: number }}
 */
export function prefixSumCpu(flags, threshold = 0.5, count = flags.length) {
    const n = Math.max(0, Math.min(count, flags.length));
    const offsets = new Uint32Array(n);
    let running = 0;
    for (let i = 0; i < n; i++) {
        offsets[i] = running;
        if (flags[i] >= threshold) running += 1;
    }
    return { offsets, total: running };
}

/**
 * Distance from one origin to a packed xyz point list.
 *
 * Routes through the MarblePhysics WASM bridge when the native module is live;
 * the bridge's JS fallback is the same arithmetic, so results do not drift.
 *
 * @param {Float32Array | number[]} points Packed xyz triples.
 * @param {ArrayLike<number>} origin
 * @param {{ squared?: boolean, out?: Float32Array }} [options]
 * @returns {Float32Array}
 */
export function batchedDistanceCpu(points, origin, options = {}) {
    const squared = options.squared === true;
    const n = Math.floor(points.length / 3);
    const out = options.out && options.out.length >= n ? options.out : new Float32Array(n);
    const ox = origin[0] || 0;
    const oy = origin[1] || 0;
    const oz = origin[2] || 0;

    if (isWasmActive()) {
        const physics = getMarblePhysics();
        const fn = squared ? physics.vec3DistanceSq : physics.vec3Distance;
        for (let i = 0; i < n; i++) {
            const b = i * 3;
            out[i] = fn(ox, oy, oz, points[b], points[b + 1], points[b + 2]);
        }
        return out;
    }

    for (let i = 0; i < n; i++) {
        const b = i * 3;
        const dx = points[b] - ox;
        const dy = points[b + 1] - oy;
        const dz = points[b + 2] - oz;
        const d2 = dx * dx + dy * dy + dz * dz;
        out[i] = squared ? d2 : Math.sqrt(d2);
    }
    return out;
}

// @ts-check
/**
 * What the session's one `GPUDevice` has to support — the boot probe's
 * `requestDevice()` descriptor is built from this. No WebGPU imports, so it
 * stays safe for Node tests.
 *
 * The limits are derived from the real working set (particle overlay +
 * gpu-chores), not from `adapter.limits` — asking for the adapter maximum
 * would hide an accidental blow-up of a buffer size behind a bigger device.
 */

import { PARTICLE_STRIDE } from './particle-data.js';

/** Particle slots on the WebGPU overlay. */
export const WEBGPU_PARTICLE_CAP = 8192;

/** `particle-integrate.wgsl` — `@workgroup_size(256)`. */
const PARTICLE_WORKGROUP_SIZE = 256;

/**
 * Features we use when present. None are required: a missing one only means
 * the pipeline variant that wants it is not built.
 *
 * - `timestamp-query`: GPU timings for the perf overlay.
 * - `shader-f16` / `subgroups`: faster chores / integrate variants.
 * - `dual-source-blending`: future additive/premultiplied particle blend.
 *
 * `bgra8unorm-storage` is deliberately absent: nothing writes storage into
 * the swap-chain format (the overlay only renders into it).
 */
export const OPTIONAL_DEVICE_FEATURES = /** @type {const} */ ([
    'timestamp-query',
    'shader-f16',
    'subgroups',
    'dual-source-blending',
]);

/**
 * Largest single buffer either consumer allocates: the particle storage buffer
 * (`maxParticles × PARTICLE_STRIDE`). Every other buffer — active flags,
 * readback, occlusion, chores compact/reduce scratch over the same slot
 * count — is `maxParticles × 4` bytes or less.
 */
export const WORKING_SET_MAX_BUFFER_BYTES = WEBGPU_PARTICLE_CAP * PARTICLE_STRIDE;

/**
 * Minimum limits the working set needs. Most sit at or below the WebGPU
 * defaults; stating them anyway pins the contract and fails loudly (at
 * `requestDevice()`) on an adapter that cannot meet it.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const WORKING_SET_LIMITS = Object.freeze({
    maxBufferSize: WORKING_SET_MAX_BUFFER_BYTES,
    maxStorageBufferBindingSize: WORKING_SET_MAX_BUFFER_BYTES,
    // compact_f32: flags + 3 read_write (scan/block sums/indices).
    maxStorageBuffersPerShaderStage: 4,
    maxComputeWorkgroupSizeX: PARTICLE_WORKGROUP_SIZE,
    maxComputeInvocationsPerWorkgroup: PARTICLE_WORKGROUP_SIZE,
    maxComputeWorkgroupsPerDimension: Math.ceil(WEBGPU_PARTICLE_CAP / 64),
});

/**
 * Builds the `requestDevice()` descriptor for this adapter: optional features
 * the adapter actually has, and working-set limits (clamped to what the
 * adapter reports, so a clamp shows up as a logged shortfall rather than a
 * rejected `requestDevice()`).
 *
 * @param {{ features?: Iterable<string> | { has(name: string): boolean }, limits?: Record<string, any> }} adapter
 * @returns {{ label: string, requiredFeatures: GPUFeatureName[], requiredLimits: Record<string, number>, limitShortfalls: string[] }}
 */
export function buildDeviceDescriptor(adapter) {
    const features = adapter?.features;
    /** @param {string} name */
    const hasFeature = (name) => {
        if (!features) return false;
        if (typeof (/** @type {any} */ (features)).has === 'function') {
            return /** @type {{ has(name: string): boolean }} */ (features).has(name);
        }
        return Array.from(/** @type {Iterable<string>} */ (features)).includes(name);
    };

    const requiredFeatures = /** @type {GPUFeatureName[]} */ (
        OPTIONAL_DEVICE_FEATURES.filter(hasFeature)
    );

    /** @type {Record<string, number>} */
    const requiredLimits = {};
    /** @type {string[]} */
    const limitShortfalls = [];
    for (const [key, need] of Object.entries(WORKING_SET_LIMITS)) {
        const available = adapter?.limits?.[key];
        if (typeof available === 'number' && available < need) {
            limitShortfalls.push(`${key}: need ${need}, adapter has ${available}`);
            requiredLimits[key] = available;
        } else {
            requiredLimits[key] = need;
        }
    }

    return { label: 'marbles-boot', requiredFeatures, requiredLimits, limitShortfalls };
}

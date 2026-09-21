/** WebGPU feature detection and experimental flags (non-blocking, opt-in). */

import { runWebGPUBootProbe } from './boot-probe.js';

export const WEBGPU_PARTICLE_CAP = 8192;

/**
 * @returns {boolean}
 */
export function isWebGPUParticlesRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuParticles') === '1';
}

/**
 * @returns {boolean}
 */
export function isWebGPUNoiseRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuNoise') === '1';
}

/**
 * @returns {boolean}
 */
export function isWebGPUDepthTestRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuDepthTest') === '1';
}

/**
 * Delegates to the session's one boot probe (`boot-probe.js`) instead of
 * making its own `requestAdapter()` / `requestDevice()` call — see #407:
 * two independent probes can disagree across browsers and hide the real bug.
 *
 * @returns {Promise<boolean>}
 */
export async function isWebGPUAvailable() {
    const { ok } = await runWebGPUBootProbe();
    return ok;
}

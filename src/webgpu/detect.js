/** WebGPU feature detection and experimental flags (non-blocking, opt-in). */

export const WEBGPU_PARTICLE_CAP = 8192;

/**
 * @returns {boolean}
 */
export function isWebGPUParticlesRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuParticles') === '1' || params.has('webgpuParticles');
}

/**
 * @returns {boolean}
 */
export function isWebGPUNoiseRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuNoise') === '1' || params.has('webgpuNoise');
}

/**
 * @returns {Promise<boolean>}
 */
export async function isWebGPUAvailable() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) return false;
        const device = await adapter.requestDevice();
        device.destroy();
        return true;
    } catch {
        return false;
    }
}

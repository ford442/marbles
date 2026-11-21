// @ts-check
/**
 * gpu-chores — kill switch, session-mode detection and breadcrumbs.
 *
 * Tier B of the cross-app gpu-chores rollout. Chores never own a GPU device:
 * they adopt one the renderer already created (see `adoptDevice` in index.js).
 */

/** Workgroup size shared by every chores kernel (1-D). */
export const CHORES_WORKGROUP_SIZE = 64;

/** Maximum breadcrumbs retained in the ring buffer. */
export const BREADCRUMB_LIMIT = 64;

/** @typedef {{ t: number, tag: string, detail: Record<string, unknown> }} ChoresBreadcrumb */

/**
 * The globals chores read and write. Browser globals (`location`, the flags the
 * renderer sets on `window`) are optional so the module also runs in Node.
 * @typedef {object} ChoresRuntimeGlobals
 * @property {{ search?: string }} [location]
 * @property {boolean} [MARBLES_DISABLE_GPU_COMPUTE]
 * @property {boolean} [usingSimpleRenderer]
 * @property {boolean} [webgpuParticlesReady]
 * @property {ChoresBreadcrumb[]} [gpuChoresBreadcrumbs]
 */

/** @type {ChoresBreadcrumb[]} */
const breadcrumbs = [];

/** @returns {ChoresRuntimeGlobals} */
function runtimeGlobal() {
    // Boundary: `globalThis` is `window` in the browser and bare in Node; these
    // members are the only ones chores touch.
    return /** @type {ChoresRuntimeGlobals} */ (globalThis);
}

/** @returns {URLSearchParams} */
function searchParams() {
    const search = runtimeGlobal().location?.search ?? '';
    return new URLSearchParams(search);
}

/**
 * Kill switch: `?no_gpu_compute` (or `?noGpuCompute`, or the
 * `MARBLES_DISABLE_GPU_COMPUTE` global) forces every job onto the CPU path.
 *
 * @returns {boolean}
 */
export function isGpuComputeDisabled() {
    if (runtimeGlobal().MARBLES_DISABLE_GPU_COMPUTE === true) return true;
    const params = searchParams();
    if (params.has('no_gpu_compute') || params.has('noGpuCompute')) {
        // `?no_gpu_compute=0` is an explicit opt back in.
        const raw = params.get('no_gpu_compute') ?? params.get('noGpuCompute');
        return raw !== '0';
    }
    return false;
}

/**
 * True when the session is already committed to a WebGL-only renderer.
 *
 * Marbles renders through Filament on WebGL2; standing a second, live WebGPU
 * device next to it is the dual-hot driver/VRAM risk this rollout avoids. When
 * no WebGPU device has been adopted from the renderer, chores stay on the CPU
 * rather than spinning one up (goal 4: WebGPU -> WASM/JS, never WebGL2).
 *
 * @returns {boolean}
 */
export function isWebGLOnlySession() {
    const runtime = runtimeGlobal();
    if (runtime.usingSimpleRenderer === true) return true;
    return runtime.webgpuParticlesReady !== true;
}

/**
 * Record a breadcrumb for fallback telemetry. Also mirrored onto
 * `window.gpuChoresBreadcrumbs` so it is readable from DevTools.
 *
 * @param {string} tag
 * @param {Record<string, unknown>} [detail]
 * @returns {void}
 */
export function breadcrumb(tag, detail = {}) {
    const entry = { t: Date.now(), tag, detail };
    breadcrumbs.push(entry);
    if (breadcrumbs.length > BREADCRUMB_LIMIT) breadcrumbs.shift();
    runtimeGlobal().gpuChoresBreadcrumbs = breadcrumbs;
}

/**
 * @returns {ChoresBreadcrumb[]}
 */
export function getBreadcrumbs() {
    return breadcrumbs.slice();
}

/**
 * @internal Test helper.
 * @returns {void}
 */
export function clearBreadcrumbs() {
    breadcrumbs.length = 0;
    runtimeGlobal().gpuChoresBreadcrumbs = breadcrumbs;
}

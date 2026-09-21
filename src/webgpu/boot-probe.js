/**
 * WebGPU boot probe — the single `requestAdapter()` / `requestDevice()` call
 * for the whole session. Runs once at startup, before Filament loads. Its
 * result is published to `window.webgpuProbe` as plain JSON (for comparing
 * behavior across browsers, e.g. Chrome vs. Edge) and the resulting adapter
 * and device are cached here so nothing else in the app — the WebGPU particle
 * backend, gpu-chores — ever needs a second `requestDevice()` call.
 *
 * This phase, WebGPU is required: a failed probe is fatal (see
 * `docs/WEBGPU_BOOT_PROBE.md`). Nothing reacts to a failed probe by silently
 * standing up a WebGL context instead.
 */

let probePromise = null;
let probedDevice = null;
let probedAdapter = null;

function detectBrowserBrand() {
    if (typeof navigator === 'undefined') return 'unknown';
    const brands = navigator.userAgentData?.brands;
    if (Array.isArray(brands) && brands.length) {
        const named = brands.find((b) => !/Not.*Brand/i.test(b.brand));
        if (named) return `${named.brand} ${named.version}`;
    }
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return ua || 'unknown';
}

async function readAdapterInfo(adapter) {
    // `adapter.info` is the current spec surface; `requestAdapterInfo()` is the
    // older/optional one some browsers still expose. Try both, fail soft — a
    // missing adapter info must never fail the probe on its own.
    if (adapter.info) {
        const info = adapter.info;
        return {
            vendor: info.vendor ?? '',
            architecture: info.architecture ?? '',
            device: info.device ?? '',
            description: info.description ?? '',
        };
    }
    if (typeof adapter.requestAdapterInfo === 'function') {
        try {
            const info = await adapter.requestAdapterInfo();
            return {
                vendor: info.vendor ?? '',
                architecture: info.architecture ?? '',
                device: info.device ?? '',
                description: info.description ?? '',
            };
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Runs the one and only `requestAdapter()` / `requestDevice()` call for this
 * session. Safe to call more than once — later calls return the cached
 * result (or the in-flight promise) instead of probing again.
 *
 * @returns {Promise<{ ok: boolean, device: GPUDevice|null, adapter: GPUAdapter|null, error?: string }>}
 */
export function runWebGPUBootProbe() {
    if (probePromise) return probePromise;

    probePromise = (async () => {
        const probe = {
            ok: false,
            browser: detectBrowserBrand(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            adapterInfo: null,
            features: [],
            error: null,
            timestamp: new Date().toISOString(),
        };

        try {
            if (typeof navigator === 'undefined' || !navigator.gpu) {
                throw new Error('navigator.gpu is unavailable in this browser');
            }

            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) {
                throw new Error('navigator.gpu.requestAdapter() returned null');
            }

            probe.adapterInfo = await readAdapterInfo(adapter);
            probe.features = Array.from(adapter.features ?? []);

            const device = await adapter.requestDevice();

            probedAdapter = adapter;
            probedDevice = device;
            probe.ok = true;

            device.lost.then((info) => {
                console.warn(`[WebGPU boot probe] device lost: ${info?.reason}`, info?.message);
                if (probedDevice === device) probedDevice = null;
            });

            return { ok: true, device, adapter };
        } catch (err) {
            probe.error = err?.message || String(err);
            console.error('[WebGPU boot probe] failed:', err);
            return { ok: false, device: null, adapter: null, error: probe.error };
        } finally {
            if (typeof window !== 'undefined') {
                window.webgpuProbe = probe;
            }
        }
    })();

    return probePromise;
}

/**
 * The device from the one boot probe call, if it succeeded and hasn't been
 * lost since. Never triggers a second `requestDevice()` — returns `null`
 * when the probe hasn't run yet, failed, or the device was lost.
 *
 * @returns {GPUDevice|null}
 */
export function getProbedDevice() {
    return probedDevice;
}

/**
 * @returns {GPUAdapter|null}
 */
export function getProbedAdapter() {
    return probedAdapter;
}

/** @internal Test helper — resets the cached probe/device/adapter. */
export function _resetWebGPUBootProbeForTest() {
    probePromise = null;
    probedDevice = null;
    probedAdapter = null;
}

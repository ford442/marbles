// @ts-check
/**
 * WebGPU boot probe — the single `requestAdapter()` / `requestDevice()` call
 * for the whole session (plus at most one recovery after a device loss). Runs
 * once at startup, before Filament loads. Its result is published to
 * `window.webgpuProbe` as plain JSON (for comparing behavior across browsers,
 * e.g. Chrome vs. Edge) and the resulting adapter and device are cached here
 * so nothing else in the app — the WebGPU particle backend, gpu-chores — ever
 * needs its own `requestDevice()` call.
 *
 * A failed probe is *not* fatal: Filament keeps rendering on WebGL2 and the
 * WebGPU consumers stay on their CPU paths (see `docs/WEBGPU_BOOT_PROBE.md`).
 */

import { buildDeviceDescriptor } from './device-requirements.js';

/**
 * @typedef {{ vendor: string, architecture: string, device: string, description: string }} AdapterInfoSummary
 * @typedef {{ ok: boolean, device: GPUDevice|null, adapter: GPUAdapter|null, error?: string }} BootProbeResult
 * @typedef {{
 *   ok: boolean,
 *   browser: string,
 *   userAgent: string,
 *   powerPreference: GPUPowerPreference|null,
 *   adapterInfo: AdapterInfoSummary|null,
 *   features: string[],
 *   requiredFeatures: string[],
 *   requiredLimits: Record<string, number>,
 *   limitShortfalls: string[],
 *   error: string|null,
 *   lastError: string|null,
 *   deviceLost: { reason: string, message: string }|null,
 *   recovered: boolean,
 *   timestamp: string,
 * }} BootProbeState
 * @typedef {{ powerPreference?: GPUPowerPreference }} BootProbeOptions
 */

/** @type {Promise<BootProbeResult>|null} */
let probePromise = null;
/** @type {Promise<BootProbeResult>|null} One recovery per session, ever. */
let recoveryPromise = null;
/** @type {GPUDevice|null} */
let probedDevice = null;
/** @type {GPUAdapter|null} */
let probedAdapter = null;
/** @type {BootProbeState|null} */
let probeState = null;
/** @type {GPUPowerPreference|undefined} */
let bootPowerPreference;

function detectBrowserBrand() {
    if (typeof navigator === 'undefined') return 'unknown';
    const brands = /** @type {{ userAgentData?: { brands?: { brand: string, version: string }[] } }} */ (navigator).userAgentData?.brands;
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

/**
 * @param {GPUAdapter & { requestAdapterInfo?: () => Promise<GPUAdapterInfo> }} adapter
 * @returns {Promise<AdapterInfoSummary|null>}
 */
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
 * @param {unknown} err
 * @returns {string}
 */
function errorMessage(err) {
    return (err instanceof Error && err.message) || String(err);
}

/**
 * Wires the per-device listeners: uncaptured errors land on
 * `window.webgpuProbe.lastError`; a loss clears the cache (consumers then
 * call `recoverWebGPUDevice()` or drop to CPU).
 *
 * @param {GPUDevice} device
 * @param {BootProbeState} probe
 */
function watchDevice(device, probe) {
    device.addEventListener?.('uncapturederror', (event) => {
        const error = /** @type {GPUUncapturedErrorEvent} */ (event).error;
        probe.lastError = error?.message || String(error);
        console.warn('[WebGPU] uncaptured error:', probe.lastError);
    });

    device.lost.then((info) => {
        console.warn(`[WebGPU boot probe] device lost: ${info?.reason}`, info?.message);
        probe.deviceLost = { reason: String(info?.reason ?? 'unknown'), message: info?.message ?? '' };
        if (probedDevice === device) {
            probedDevice = null;
            probedAdapter = null;
        }
    });
}

/**
 * One adapter + device request. Shared by the boot probe and the one
 * post-loss recovery (a lost device's adapter is spent, so recovery needs a
 * fresh adapter too).
 *
 * @param {BootProbeState} probe
 * @returns {Promise<{ device: GPUDevice, adapter: GPUAdapter }>}
 */
async function acquireDevice(probe) {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
        throw new Error('navigator.gpu is unavailable in this browser');
    }

    /** @type {GPURequestAdapterOptions} */
    const adapterOptions = bootPowerPreference ? { powerPreference: bootPowerPreference } : {};
    const adapter = await navigator.gpu.requestAdapter(adapterOptions);
    if (!adapter) {
        throw new Error('navigator.gpu.requestAdapter() returned null');
    }

    probe.adapterInfo = await readAdapterInfo(adapter);
    probe.features = Array.from(adapter.features ?? []);

    const { label, requiredFeatures, requiredLimits, limitShortfalls } = buildDeviceDescriptor(adapter);
    probe.requiredFeatures = [...requiredFeatures];
    probe.requiredLimits = { ...requiredLimits };
    probe.limitShortfalls = limitShortfalls;
    if (limitShortfalls.length) {
        console.warn('[WebGPU boot probe] adapter is below the working-set limits:', limitShortfalls);
    }

    const device = await adapter.requestDevice({
        label,
        requiredFeatures,
        requiredLimits,
        defaultQueue: { label: `${label}-queue` },
    });

    probedAdapter = adapter;
    probedDevice = device;
    watchDevice(device, probe);
    return { device, adapter };
}

/**
 * Runs the one and only boot `requestAdapter()` / `requestDevice()` call for
 * this session. Safe to call more than once — later calls return the cached
 * result (or the in-flight promise) instead of probing again; `options` only
 * apply to the first call.
 *
 * @param {BootProbeOptions} [options]
 * @returns {Promise<BootProbeResult>}
 */
export function runWebGPUBootProbe(options = {}) {
    if (probePromise) return probePromise;
    bootPowerPreference = options.powerPreference;

    /** @type {BootProbeState} */
    const probe = {
        ok: false,
        browser: detectBrowserBrand(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        powerPreference: bootPowerPreference ?? null,
        adapterInfo: null,
        features: [],
        requiredFeatures: [],
        requiredLimits: {},
        limitShortfalls: [],
        error: null,
        lastError: null,
        deviceLost: null,
        recovered: false,
        timestamp: new Date().toISOString(),
    };
    probeState = probe;

    /** @type {Promise<BootProbeResult>} */
    const pending = (async () => {
        try {
            const { device, adapter } = await acquireDevice(probe);
            probe.ok = true;
            return { ok: true, device, adapter };
        } catch (err) {
            const message = errorMessage(err);
            probe.error = message;
            console.warn('[WebGPU boot probe] failed — continuing on WebGL2 without WebGPU compute:', err);
            return { ok: false, device: null, adapter: null, error: message };
        } finally {
            if (typeof window !== 'undefined') {
                window.webgpuProbe = probe;
            }
        }
    })();

    probePromise = pending;
    return pending;
}

/**
 * After a device loss, requests a replacement device — once per session.
 * Every consumer that sees the loss may call this; they all share the same
 * attempt. Returns the live device unchanged if it was never lost, and
 * `ok: false` when the boot probe never succeeded, the loss was an
 * intentional `destroy()`, or the one recovery has already been spent.
 *
 * @returns {Promise<BootProbeResult>}
 */
export function recoverWebGPUDevice() {
    if (probedDevice) {
        return Promise.resolve({ ok: true, device: probedDevice, adapter: probedAdapter });
    }
    /** @param {string} error @returns {BootProbeResult} */
    const fail = (error) => ({ ok: false, device: null, adapter: null, error });
    if (recoveryPromise) {
        // Concurrent callers share the attempt; once its device is lost too,
        // the one recovery is spent.
        return recoveryPromise.then((result) => (
            result.ok && result.device !== probedDevice
                ? fail('device recovery already used this session')
                : result
        ));
    }

    const probe = probeState;
    if (!probe?.ok) return Promise.resolve(fail('boot probe did not succeed'));
    if (probe.deviceLost?.reason === 'destroyed') {
        return Promise.resolve(fail('device was destroyed intentionally'));
    }

    recoveryPromise = (async () => {
        try {
            const { device, adapter } = await acquireDevice(probe);
            probe.recovered = true;
            console.info('[WebGPU boot probe] recovered a device after loss');
            return { ok: true, device, adapter };
        } catch (err) {
            const message = errorMessage(err);
            probe.lastError = `recovery failed: ${message}`;
            console.warn('[WebGPU boot probe] device recovery failed:', err);
            return fail(message);
        }
    })();
    return recoveryPromise;
}

/**
 * The device from the boot probe (or its one recovery), if it succeeded and
 * hasn't been lost since. Never triggers a `requestDevice()` — returns `null`
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
    recoveryPromise = null;
    probedDevice = null;
    probedAdapter = null;
    probeState = null;
    bootPowerPreference = undefined;
}

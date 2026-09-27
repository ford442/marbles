import assert from 'node:assert/strict';
import {
    _resetWebGPUBootProbeForTest,
    getProbedAdapter,
    getProbedDevice,
    recoverWebGPUDevice,
    runWebGPUBootProbe,
} from '../src/webgpu/boot-probe.js';
import { WORKING_SET_LIMITS, buildDeviceDescriptor } from '../src/webgpu/device-requirements.js';

/** @param {object} value */
function setNavigator(value) {
    // Node's built-in `navigator` global only has a getter, so a plain
    // assignment throws — redefine the property instead.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true });
    return () => {
        if (original) Object.defineProperty(globalThis, 'navigator', original);
        else delete globalThis.navigator;
    };
}

/** A fake device whose loss the test resolves by hand. */
function makeFakeDevice() {
    let lose;
    const listeners = {};
    const device = {
        lost: new Promise((resolve) => { lose = resolve; }),
        addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    return { device, lose: (info) => lose(info), listeners };
}

// Node has no navigator.gpu: the probe must fail closed, never throw, and
// publish a JSON-safe result to window.webgpuProbe.
{
    _resetWebGPUBootProbeForTest();
    globalThis.window = {};

    const result = await runWebGPUBootProbe();
    assert.equal(result.ok, false, 'probe should fail without navigator.gpu');
    assert.equal(result.device, null);
    assert.equal(result.adapter, null);
    assert.equal(typeof result.error, 'string');

    assert.ok(window.webgpuProbe, 'window.webgpuProbe should be published');
    assert.equal(window.webgpuProbe.ok, false);
    assert.equal(typeof window.webgpuProbe.browser, 'string');
    assert.equal(typeof window.webgpuProbe.error, 'string');
    assert.deepEqual(window.webgpuProbe.features, []);
    // JSON-safe: comparing Chrome vs. Edge means this must round-trip.
    assert.doesNotThrow(() => JSON.stringify(window.webgpuProbe));

    assert.equal(getProbedDevice(), null, 'no device cached after a failed probe');
    assert.equal(getProbedAdapter(), null, 'no adapter cached after a failed probe');

    const recovery = await recoverWebGPUDevice();
    assert.equal(recovery.ok, false, 'nothing to recover when the boot probe failed');

    delete globalThis.window;
}

// Calling the probe twice must not request a second time — same promise/result.
{
    _resetWebGPUBootProbeForTest();
    globalThis.window = {};

    const first = runWebGPUBootProbe();
    const second = runWebGPUBootProbe();
    assert.equal(first, second, 'a second call while in-flight reuses the same promise');

    await first;
    const third = await runWebGPUBootProbe();
    assert.equal(third.ok, false);

    delete globalThis.window;
    _resetWebGPUBootProbeForTest();
}

// A fake successful adapter/device: verifies caching, feature/adapter-info
// capture, and that a second requestAdapter/requestDevice call never happens.
{
    _resetWebGPUBootProbeForTest();
    globalThis.window = {};

    let requestAdapterCalls = 0;
    let requestDeviceCalls = 0;
    let adapterOptions = null;
    let deviceDescriptor = null;
    const fakeDevice = { lost: new Promise(() => {}) };
    const fakeAdapter = {
        info: { vendor: 'fake-vendor', architecture: 'fake-arch', device: '', description: 'Fake Adapter' },
        features: new Set(['shader-f16', 'texture-compression-bc']),
        requestDevice: async (descriptor) => {
            requestDeviceCalls += 1;
            deviceDescriptor = descriptor;
            return fakeDevice;
        },
    };
    const restoreNavigator = setNavigator({
        userAgent: 'FakeBrowser/1.0',
        gpu: {
            requestAdapter: async (options) => {
                requestAdapterCalls += 1;
                adapterOptions = options;
                return fakeAdapter;
            },
        },
    });

    const result = await runWebGPUBootProbe({ powerPreference: 'low-power' });
    assert.deepEqual(adapterOptions, { powerPreference: 'low-power' }, 'adapter follows the WebGL power preference');
    assert.equal(window.webgpuProbe.powerPreference, 'low-power');
    assert.equal(deviceDescriptor.label, 'marbles-boot');
    assert.deepEqual(deviceDescriptor.requiredFeatures, ['shader-f16'], 'only wanted features the adapter has');
    assert.deepEqual(deviceDescriptor.requiredLimits, { ...WORKING_SET_LIMITS });
    assert.deepEqual(window.webgpuProbe.requiredFeatures, ['shader-f16']);
    assert.equal(result.ok, true);
    assert.equal(result.device, fakeDevice);
    assert.equal(result.adapter, fakeAdapter);
    assert.equal(getProbedDevice(), fakeDevice, 'device is cached for reuse');
    assert.equal(getProbedAdapter(), fakeAdapter);
    assert.deepEqual(window.webgpuProbe.features, ['shader-f16', 'texture-compression-bc']);
    assert.equal(window.webgpuProbe.adapterInfo.vendor, 'fake-vendor');

    await runWebGPUBootProbe();
    await runWebGPUBootProbe();
    assert.equal(requestAdapterCalls, 1, 'requestAdapter must only be called once per session');
    assert.equal(requestDeviceCalls, 1, 'requestDevice must only be called once per session');

    delete globalThis.window;
    restoreNavigator();
    _resetWebGPUBootProbeForTest();
}

// Descriptor: limits are clamped to (and shortfalls reported against) the
// adapter, never raised to the adapter maximum.
{
    const roomy = buildDeviceDescriptor({ features: [], limits: { maxBufferSize: 1 << 30 } });
    assert.equal(roomy.requiredLimits.maxBufferSize, WORKING_SET_LIMITS.maxBufferSize);
    assert.deepEqual(roomy.limitShortfalls, []);

    const tight = buildDeviceDescriptor({ features: ['timestamp-query'], limits: { maxStorageBuffersPerShaderStage: 2 } });
    assert.deepEqual(tight.requiredFeatures, ['timestamp-query']);
    assert.equal(tight.requiredLimits.maxStorageBuffersPerShaderStage, 2);
    assert.equal(tight.limitShortfalls.length, 1);
}

// Device loss: uncaptured errors are recorded, the lost device is dropped,
// and exactly one recovery requests a fresh adapter + device.
{
    _resetWebGPUBootProbeForTest();
    globalThis.window = {};

    const first = makeFakeDevice();
    const second = makeFakeDevice();
    const devices = [first.device, second.device];
    let requestAdapterCalls = 0;
    const restoreNavigator = setNavigator({
        userAgent: 'FakeBrowser/1.0',
        gpu: {
            requestAdapter: async () => {
                requestAdapterCalls += 1;
                return { features: new Set(), requestDevice: async () => devices.shift() };
            },
        },
    });

    const boot = await runWebGPUBootProbe();
    assert.equal(boot.ok, true);

    first.listeners.uncapturederror({ error: { message: 'bad bind group' } });
    assert.equal(window.webgpuProbe.lastError, 'bad bind group');

    // Not lost yet: recovery just hands back the live device, no new request.
    assert.equal((await recoverWebGPUDevice()).device, first.device);
    assert.equal(requestAdapterCalls, 1);

    first.lose({ reason: 'unknown', message: 'driver reset' });
    await Promise.resolve();
    assert.equal(getProbedDevice(), null, 'lost device is dropped from the cache');
    assert.deepEqual(window.webgpuProbe.deviceLost, { reason: 'unknown', message: 'driver reset' });

    const [a, b] = await Promise.all([recoverWebGPUDevice(), recoverWebGPUDevice()]);
    assert.equal(b.device, a.device, 'concurrent callers share one recovery');
    assert.equal(a.ok, true);
    assert.equal(a.device, second.device);
    assert.equal(getProbedDevice(), second.device);
    assert.equal(window.webgpuProbe.recovered, true);
    assert.equal(requestAdapterCalls, 2, 'recovery needs a fresh adapter');

    second.lose({ reason: 'unknown', message: 'again' });
    await Promise.resolve();
    const again = await recoverWebGPUDevice();
    assert.equal(again.ok, false, 'the one recovery is spent…');
    assert.equal(requestAdapterCalls, 2, '…so no third adapter is requested');
    assert.equal(getProbedDevice(), null, 'second loss leaves no live device');

    delete globalThis.window;
    restoreNavigator();
    _resetWebGPUBootProbeForTest();
}

console.log('WebGPU boot probe tests passed');

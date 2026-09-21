import assert from 'node:assert/strict';
import {
    _resetWebGPUBootProbeForTest,
    getProbedAdapter,
    getProbedDevice,
    runWebGPUBootProbe,
} from '../src/webgpu/boot-probe.js';

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
    const fakeDevice = { lost: new Promise(() => {}) };
    const fakeAdapter = {
        info: { vendor: 'fake-vendor', architecture: 'fake-arch', device: '', description: 'Fake Adapter' },
        features: new Set(['shader-f16']),
        requestDevice: async () => {
            requestDeviceCalls += 1;
            return fakeDevice;
        },
    };
    // Node's built-in `navigator` global only has a getter, so a plain
    // assignment throws — redefine the property instead.
    const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            userAgent: 'FakeBrowser/1.0',
            gpu: {
                requestAdapter: async () => {
                    requestAdapterCalls += 1;
                    return fakeAdapter;
                },
            },
        },
        configurable: true,
    });

    const result = await runWebGPUBootProbe();
    assert.equal(result.ok, true);
    assert.equal(result.device, fakeDevice);
    assert.equal(result.adapter, fakeAdapter);
    assert.equal(getProbedDevice(), fakeDevice, 'device is cached for reuse');
    assert.equal(getProbedAdapter(), fakeAdapter);
    assert.deepEqual(window.webgpuProbe.features, ['shader-f16']);
    assert.equal(window.webgpuProbe.adapterInfo.vendor, 'fake-vendor');

    await runWebGPUBootProbe();
    await runWebGPUBootProbe();
    assert.equal(requestAdapterCalls, 1, 'requestAdapter must only be called once per session');
    assert.equal(requestDeviceCalls, 1, 'requestDevice must only be called once per session');

    delete globalThis.window;
    if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
        delete globalThis.navigator;
    }
    _resetWebGPUBootProbeForTest();
}

console.log('WebGPU boot probe tests passed');

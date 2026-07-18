import assert from 'node:assert/strict';
import {
    isWebGPUAvailable,
    isWebGPUNoiseRequested,
    isWebGPUParticlesRequested,
} from '../src/webgpu/detect.js';

function withWindowSearch(search, fn) {
    const prevWindow = globalThis.window;
    globalThis.window = { location: { search } };
    try {
        fn();
    } finally {
        if (prevWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = prevWindow;
        }
    }
}

// Particle flag parsing
withWindowSearch('?webgpuParticles=1', () => {
    assert.ok(isWebGPUParticlesRequested(), 'webgpuParticles=1 should be requested');
});
withWindowSearch('?webgpuParticles=1&foo=bar', () => {
    assert.ok(isWebGPUParticlesRequested(), 'webgpuParticles=1 among other params should be requested');
});
withWindowSearch('', () => {
    assert.ok(!isWebGPUParticlesRequested(), 'empty search should not request particles');
});
withWindowSearch('?webgpuParticles=0', () => {
    assert.ok(!isWebGPUParticlesRequested(), 'webgpuParticles=0 should not be requested');
});
withWindowSearch('?webgpuParticles', () => {
    assert.ok(!isWebGPUParticlesRequested(), 'bare webgpuParticles flag should not be requested');
});

// Noise flag parsing
withWindowSearch('?webgpuNoise=1', () => {
    assert.ok(isWebGPUNoiseRequested(), 'webgpuNoise=1 should be requested');
});
withWindowSearch('?webgpuNoise=0', () => {
    assert.ok(!isWebGPUNoiseRequested(), 'webgpuNoise=0 should not be requested');
});
withWindowSearch('?webgpuParticles=1&webgpuNoise=1', () => {
    assert.ok(isWebGPUParticlesRequested() && isWebGPUNoiseRequested(), 'combined flags should both be requested');
});

// Availability falls back when navigator.gpu is absent (Node default)
assert.equal(await isWebGPUAvailable(), false, 'WebGPU should not be available in Node');

console.log('WebGPU detect tests passed');

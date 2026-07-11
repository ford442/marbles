import assert from 'node:assert/strict';
import {
    getWebGLContextOptions,
    getSimpleDebugWebGLContextOptions,
    applyDevWebGLContextOverrides,
    detectPlatformProfile,
} from '../src/rendering-defaults.js';

function testLowTier() {
    const opts = getWebGLContextOptions('low', { isMobile: false, prefersLowPower: true });
    assert.equal(opts.powerPreference, 'low-power');
    assert.equal(opts.antialias, false);
    assert.equal(opts.alpha, false);
    assert.equal(opts.desynchronized, false);
}

function testMediumDesktop() {
    const opts = getWebGLContextOptions('medium', { isMobile: false, prefersLowPower: false });
    assert.equal(opts.powerPreference, 'high-performance');
    assert.equal(opts.desynchronized, true);
    assert.equal(opts.antialias, false);
}

function testUltraStability() {
    const opts = getWebGLContextOptions('ultra', { isMobile: false, prefersLowPower: false });
    assert.equal(opts.powerPreference, 'high-performance');
    assert.equal(opts.desynchronized, false);
}

function testMobileSkipsDesync() {
    const opts = getWebGLContextOptions('high', { isMobile: true, prefersLowPower: true });
    assert.equal(opts.desynchronized, false);
    assert.equal(opts.powerPreference, 'high-performance');
}

function testSimpleDebugPreserveBuffer() {
    const opts = getSimpleDebugWebGLContextOptions('medium');
    assert.equal(opts.preserveDrawingBuffer, true);
    assert.equal(opts.antialias, false);
}

function testDevOverrides() {
    const base = getWebGLContextOptions('ultra');
    globalThis.window = {
        location: { search: '?glDesynchronized=1&glPowerPreference=low-power&glAlpha=1' },
    };

    const withDev = applyDevWebGLContextOverrides(base);
    assert.equal(withDev.desynchronized, true);
    assert.equal(withDev.powerPreference, 'low-power');
    assert.equal(withDev.alpha, true);

    delete globalThis.window;
    assert.equal(typeof detectPlatformProfile().isMobile, 'boolean');
}

testLowTier();
testMediumDesktop();
testUltraStability();
testMobileSkipsDesync();
testSimpleDebugPreserveBuffer();
testDevOverrides();
console.log('WebGL context option tests passed');

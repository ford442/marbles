import assert from 'node:assert/strict';
import { buildViewProjection, lookAt, multiplyMat4, perspective } from '../src/webgpu/camera-math.js';
import { WEBGPU_PARTICLE_CAP } from '../src/webgpu/detect.js';
import { packParticle, PARTICLE_STRIDE } from '../src/webgpu/particle-data.js';
import { pruneToAliveIndices } from '../src/webgpu/alive-prune.js';

function testParticleCap() {
    assert.equal(WEBGPU_PARTICLE_CAP, 8192);
    assert.equal(PARTICLE_STRIDE, 64);
}

function testPackParticle() {
    const view = new Float32Array(16);
    packParticle({
        pos: [1, 2, 3],
        vel: [0.1, 0, -0.2],
        life: 0.5,
        maxLife: 1,
        color: [1, 0.5, 0.2, 0.8],
        size: 0.3,
        drag: 0.9,
        gravity: true,
        active: true,
    }, 0, view);
    assert.equal(view[0], 1);
    assert.equal(view[3], 0.5);
    assert.equal(view[14], 1);
    assert.equal(view[15], 1);
}

function testViewProjection() {
    const vp = buildViewProjection(
        { eye: [0, 10, 20], target: [0, 0, 0] },
        45,
        16 / 9
    );
    assert.equal(vp.length, 16);
    assert.ok(Number.isFinite(vp[0]));
    const view = lookAt([0, 0, 5], [0, 0, 0]);
    const proj = perspective(60, 1);
    const combined = multiplyMat4(proj, view);
    assert.equal(combined.length, 16);
}

function testPruneToAliveIndices() {
    const particles = [0, 1, 2, 3].map((i) => ({ _poolIndex: i, active: true }));
    const active = particles.slice();
    const mask = new Uint8Array(8);

    // Only slots 1 and 3 survived the GPU compact.
    const remaining = pruneToAliveIndices(Uint32Array.from([1, 3]), 2, active, mask);
    assert.equal(remaining, 2);
    assert.deepEqual(active.map((p) => p._poolIndex), [1, 3]);
    assert.deepEqual(particles.map((p) => p.active), [false, true, false, true]);

    // A zero survivor count clears the list; the mask is reset each call.
    assert.equal(pruneToAliveIndices(Uint32Array.from([1, 3]), 0, active, mask), 0);
    assert.equal(active.length, 0);
}

function testPruneIgnoresOutOfRangeAndNullEntries() {
    const active = [null, { _poolIndex: 2, active: true }];
    const mask = new Uint8Array(4);
    // Slot 99 is past the pool and must not widen the mask.
    assert.equal(pruneToAliveIndices(Uint32Array.from([99, 2]), 2, active, mask), 1);
    assert.equal(active.length, 1);
    assert.equal(active[0]._poolIndex, 2);

    // A null index list (compact kept its results GPU-side) prunes everything.
    assert.equal(pruneToAliveIndices(null, 5, active, mask), 0);
}

testParticleCap();
testPruneToAliveIndices();
testPruneIgnoresOutOfRangeAndNullEntries();
testPackParticle();
testViewProjection();
console.log('WebGPU module tests passed');

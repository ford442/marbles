import assert from 'node:assert/strict';
import { buildViewProjection, lookAt, multiplyMat4, perspective } from '../src/webgpu/camera-math.js';
import { WEBGPU_PARTICLE_CAP } from '../src/webgpu/detect.js';
import { packParticle, PARTICLE_STRIDE } from '../src/webgpu/particle-data.js';

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

testParticleCap();
testPackParticle();
testViewProjection();
console.log('WebGPU module tests passed');

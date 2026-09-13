import assert from 'node:assert/strict';
import { updateParticleOcclusion, OCCLUSION_RAYCAST_BUDGET } from '../src/webgpu/occlusion.js';

function testVisibleWhenUnobstructed() {
    const occlusion = new Float32Array(4).fill(1);
    const particles = [{ pos: [0, 0, -10], _poolIndex: 0 }];
    updateParticleOcclusion(() => false, [0, 0, 0], particles, occlusion);
    assert.equal(occlusion[0], 1);
}

function testOccludedWhenBlocked() {
    const occlusion = new Float32Array(4).fill(1);
    const particles = [{ pos: [0, 0, -10], _poolIndex: 1 }];
    updateParticleOcclusion(() => true, [0, 0, 0], particles, occlusion);
    assert.equal(occlusion[1], 0);
}

function testPassesNormalizedDirectionAndShortenedToi() {
    let seen = null;
    const particles = [{ pos: [3, 4, 0], _poolIndex: 0 }]; // distance 5 from origin
    const occlusion = new Float32Array(1).fill(1);
    updateParticleOcclusion((ox, oy, oz, dx, dy, dz, maxToi) => {
        seen = { ox, oy, oz, dx, dy, dz, maxToi };
        return false;
    }, [0, 0, 0], particles, occlusion);

    assert.equal(seen.ox, 0);
    assert.ok(Math.abs(Math.hypot(seen.dx, seen.dy, seen.dz) - 1) < 1e-6, 'direction should be normalized');
    assert.ok(Math.abs(seen.maxToi - (5 - 0.05)) < 1e-6, 'ray should stop just short of the particle');
}

function testBudgetPrioritizesNearestParticles() {
    const tois = [];
    const isOccluded = (ox, oy, oz, dx, dy, dz, maxToi) => {
        tois.push(maxToi);
        return false;
    };
    const particles = [
        { pos: [0, 0, -50], _poolIndex: 0 }, // farthest, should be skipped
        { pos: [0, 0, -5], _poolIndex: 1 },
        { pos: [0, 0, -20], _poolIndex: 2 },
    ];
    const occlusion = new Float32Array(3).fill(1);
    updateParticleOcclusion(isOccluded, [0, 0, 0], particles, occlusion, 2);

    assert.equal(tois.length, 2, 'only budget raycasts should run');
    assert.ok(tois.some((toi) => Math.abs(toi - (5 - 0.05)) < 1e-6));
    assert.ok(tois.some((toi) => Math.abs(toi - (20 - 0.05)) < 1e-6));
}

function testMissingCallbackOrEyeIsNoop() {
    const occlusion = new Float32Array(2).fill(1);
    updateParticleOcclusion(null, [0, 0, 0], [{ pos: [0, 0, -1], _poolIndex: 0 }], occlusion);
    updateParticleOcclusion(() => true, null, [{ pos: [0, 0, -1], _poolIndex: 1 }], occlusion);
    assert.deepEqual(Array.from(occlusion), [1, 1]);
}

function testEmptyParticleListLeavesBufferUntouched() {
    const occlusion = new Float32Array(4).fill(1);
    updateParticleOcclusion(() => true, [0, 0, 0], [], occlusion);
    assert.deepEqual(Array.from(occlusion), [1, 1, 1, 1]);
}

function testDefaultBudgetConstant() {
    assert.equal(OCCLUSION_RAYCAST_BUDGET, 512);
}

testVisibleWhenUnobstructed();
testOccludedWhenBlocked();
testPassesNormalizedDirectionAndShortenedToi();
testBudgetPrioritizesNearestParticles();
testMissingCallbackOrEyeIsNoop();
testEmptyParticleListLeavesBufferUntouched();
testDefaultBudgetConstant();
console.log('WebGPU occlusion tests passed');

import assert from 'node:assert/strict';
import { ParticleSystem } from '../src/particle-system.js';

function makeFakeBackend(maxParticles = 8192) {
    return {
        ready: true,
        maxParticles,
        stepCalls: [],
        dirtyIndices: [],
        uploadAllCalls: 0,
        disposed: false,
        step(dt) {
            this.stepCalls.push(dt);
        },
        markDirty(idx) {
            this.dirtyIndices.push(idx);
        },
        uploadAll() {
            this.uploadAllCalls += 1;
        },
        dispose() {
            this.disposed = true;
        },
    };
}

// Enabling WebGPU expands the particle pool to match the backend cap.
const ps = new ParticleSystem(null, 'high');
const backend = makeFakeBackend(8192);
ps.enableWebGPU(backend);
assert.equal(ps.maxParticles, 8192, 'pool should expand to backend maxParticles');
assert.equal(ps.stats.backend, 'webgpu', 'stats.backend should report webgpu');
assert.equal(backend.uploadAllCalls, 1, 'enableWebGPU should call uploadAll');

// Emitting marks the pool index dirty, not a linear search index.
backend.dirtyIndices.length = 0;
ps.emitParticles('spark', { x: 0, y: 0, z: 0 }, 5, { lifetime: 1.0 });
assert.equal(backend.dirtyIndices.length, 5, 'emit should mark all new particles dirty');
for (const idx of backend.dirtyIndices) {
    assert.ok(idx >= 0 && idx < ps.maxParticles, 'dirty index should be within pool');
    assert.equal(ps.particles[idx].active, true, 'dirtied slot should be active');
}

// Update delegates to the GPU backend and does not run CPU simulation.
ps.update(0.016);
assert.equal(backend.stepCalls.length, 1, 'update should call backend.step once');
assert.equal(backend.stepCalls[0], 0.016, 'step should receive the same delta time');

// Disposal delegates to the backend.
ps.dispose();
assert.equal(backend.disposed, true, 'dispose should call backend.dispose');
assert.equal(ps.gpuBackend, null, 'gpuBackend should be cleared');

console.log('ParticleSystem WebGPU delegation tests passed');

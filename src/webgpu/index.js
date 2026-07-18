export {
    isWebGPUAvailable,
    isWebGPUParticlesRequested,
    isWebGPUNoiseRequested,
    WEBGPU_PARTICLE_CAP,
} from './detect.js';
export { WebGPUParticleBackend, tryInitWebGPUParticles } from './particle-backend.js';
export { packParticle, PARTICLE_STRIDE } from './particle-data.js';
export { generateNoiseTexture, tryInitWebGPUNoise } from './noise-texture.js';
export { buildViewProjection } from './camera-math.js';

import { isWebGPUNoiseRequested, isWebGPUParticlesRequested } from './detect.js';
import { tryInitWebGPUParticles } from './particle-backend.js';
import { tryInitWebGPUNoise } from './noise-texture.js';

function isWebGPUStressRequested() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('webgpuStress') === '1' || params.has('webgpuStress');
}

/**
 * Burst emit for benchmarking 5k–10k particles (opt-in).
 * @param {object} game
 */
export function runWebGPUStressBurst(game) {
    if (!isWebGPUStressRequested() || !game.particleSystem?.gpuBackend?.ready) return;
    const ps = game.particleSystem;
    const count = Math.min(8000, ps.maxParticles - 100);
    console.log(`[WebGPU] Stress burst: ${count} particles`);
    for (let i = 0; i < count; i++) {
        ps.emitParticles('spark', {
            x: (Math.random() - 0.5) * 30,
            y: 5 + Math.random() * 10,
            z: (Math.random() - 0.5) * 30,
        }, 1, { lifetime: 2 + Math.random() * 2 });
    }
}

/**
 * Schedule WebGPU particle init after Filament boot (non-blocking).
 * @param {object} game
 */
export function scheduleWebGPUExperiments(game) {
    if (!isWebGPUParticlesRequested()) return;

    void tryInitWebGPUParticles(game).then((backend) => {
        if (!backend) {
            console.info('[WebGPU] Falling back to CPU ParticleSystem');
            return;
        }
        game.webgpuParticles = backend;
        if (isWebGPUNoiseRequested()) {
            void tryInitWebGPUNoise(game);
        }
        if (game.currentLevel) {
            runWebGPUStressBurst(game);
        }
    });
}

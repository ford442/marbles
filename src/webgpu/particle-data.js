/** CPU ↔ GPU particle struct packing (no WebGPU imports — safe for Node tests). */

/** @type {number} 16 floats × 4 bytes */
export const PARTICLE_STRIDE = 64;

/**
 * @param {object} cpuParticle
 * @param {number} offset byte offset in Float32Array view
 * @param {Float32Array} view
 */
export function packParticle(cpuParticle, offset, view) {
    const i = offset / 4;
    view[i + 0] = cpuParticle.pos[0];
    view[i + 1] = cpuParticle.pos[1];
    view[i + 2] = cpuParticle.pos[2];
    view[i + 3] = cpuParticle.life;
    view[i + 4] = cpuParticle.vel[0];
    view[i + 5] = cpuParticle.vel[1];
    view[i + 6] = cpuParticle.vel[2];
    view[i + 7] = cpuParticle.maxLife;
    view[i + 8] = cpuParticle.color[0];
    view[i + 9] = cpuParticle.color[1];
    view[i + 10] = cpuParticle.color[2];
    view[i + 11] = cpuParticle.color[3] ?? 1;
    view[i + 12] = cpuParticle.size;
    view[i + 13] = cpuParticle.drag;
    view[i + 14] = cpuParticle.gravity ? 1 : 0;
    view[i + 15] = cpuParticle.active ? 1 : 0;
}

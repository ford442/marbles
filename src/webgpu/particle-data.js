// @ts-check
/** CPU ↔ GPU particle struct packing (no WebGPU imports — safe for Node tests). */

/** @type {number} 16 floats × 4 bytes */
export const PARTICLE_STRIDE = 64;

/**
 * The CPU particle fields the GPU struct mirrors. `pos` / `vel` are `[x, y, z]`
 * and `color` is `[r, g, b]` or `[r, g, b, a]` (pool entries always carry
 * them), so only the alpha read has a fallback that can actually fire.
 *
 * @typedef {object} PackableParticle
 * @property {readonly number[]} pos
 * @property {readonly number[]} vel
 * @property {readonly number[]} color
 * @property {number} life
 * @property {number} maxLife
 * @property {number} size
 * @property {number} drag
 * @property {boolean} gravity
 * @property {boolean} active
 */

/**
 * @param {PackableParticle} cpuParticle
 * @param {number} offset byte offset in Float32Array view
 * @param {Float32Array} view
 * @returns {void}
 */
export function packParticle(cpuParticle, offset, view) {
    const i = offset / 4;
    const { pos, vel, color } = cpuParticle;
    view[i + 0] = pos[0] ?? 0;
    view[i + 1] = pos[1] ?? 0;
    view[i + 2] = pos[2] ?? 0;
    view[i + 3] = cpuParticle.life;
    view[i + 4] = vel[0] ?? 0;
    view[i + 5] = vel[1] ?? 0;
    view[i + 6] = vel[2] ?? 0;
    view[i + 7] = cpuParticle.maxLife;
    view[i + 8] = color[0] ?? 0;
    view[i + 9] = color[1] ?? 0;
    view[i + 10] = color[2] ?? 0;
    view[i + 11] = color[3] ?? 1;
    view[i + 12] = cpuParticle.size;
    view[i + 13] = cpuParticle.drag;
    view[i + 14] = cpuParticle.gravity ? 1 : 0;
    view[i + 15] = cpuParticle.active ? 1 : 0;
}

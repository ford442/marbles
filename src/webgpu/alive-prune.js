/**
 * Prunes the CPU-side active particle list from a GPU alive-slot index list.
 *
 * Split out of particle-backend.js so it is importable (and unit-testable)
 * without the WGSL `?raw` imports that only Vite can resolve.
 */

/**
 * @param {Uint32Array | null} indices Ascending alive pool slots from the compact job.
 * @param {number} count Survivor count reported by the compact job.
 * @param {Array<{ _poolIndex: number, active: boolean } | null>} activeParticles
 *        Mutated in place: dead entries are marked inactive and spliced out.
 * @param {Uint8Array} mask Reusable scratch, one byte per pool slot.
 * @returns {number} Surviving entries in `activeParticles`.
 */
export function pruneToAliveIndices(indices, count, activeParticles, mask) {
    mask.fill(0);
    const n = Math.max(0, Math.min(count, indices ? indices.length : 0));
    for (let i = 0; i < n; i++) {
        const slot = indices[i];
        if (slot < mask.length) mask[slot] = 1;
    }

    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        if (!p || !mask[p._poolIndex]) {
            if (p) p.active = false;
            activeParticles.splice(i, 1);
        }
    }
    return activeParticles.length;
}

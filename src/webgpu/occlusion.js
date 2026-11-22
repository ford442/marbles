// @ts-check
/**
 * Physics-based per-particle occlusion for the WebGPU particle overlay.
 *
 * There is no browser API to share Filament's WebGL2 depth buffer with the
 * separate WebGPU overlay context: `GPUDevice.importExternalTexture` only
 * accepts video frames, and no `EXT_external_objects` / `WEBGL_shared_sources`
 * style GPU resource sharing between WebGL2 and WebGPU contexts is
 * standardized in any shipping browser. Filament's WASM bindings used here
 * (docs/reference/filament.d.ts) also expose no readPixels or
 * depth-texture readback, so there's no depth image to copy even via a CPU
 * round trip.
 *
 * Since rendered geometry mirrors the Rapier physics world 1:1 in this game,
 * occlusion is approximated instead with a raycast from the camera eye to
 * each particle: if a solid (non-sensor) collider blocks the ray before it
 * reaches the particle, the particle is behind scene geometry and hidden.
 * This is decoupled from Rapier/RAPIER.Ray directly (via the `isOccluded`
 * callback) so the budgeting/prioritization logic stays testable in Node
 * without a WASM physics world, matching particle-data.js / camera-math.js.
 */

/** Raycasts are capped per frame; farthest active particles are skipped when over budget. */
export const OCCLUSION_RAYCAST_BUDGET = 512;

/**
 * `[x, y, z]`; eye and particle positions always carry three components, so
 * the `?? 0` fallbacks on their reads are never taken.
 * @typedef {readonly number[]} Vec3Array
 */

/**
 * A pooled CPU particle as this module sees it.
 * @typedef {{ pos: Vec3Array, _poolIndex: number }} OcclusionParticle
 */

/**
 * @param {Vec3Array} eye
 * @param {Vec3Array} pos
 * @returns {number}
 */
function distSq(eye, pos) {
    const dx = (pos[0] ?? 0) - (eye[0] ?? 0);
    const dy = (pos[1] ?? 0) - (eye[1] ?? 0);
    const dz = (pos[2] ?? 0) - (eye[2] ?? 0);
    return dx * dx + dy * dy + dz * dz;
}

/**
 * @param {(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number, maxToi: number) => boolean} isOccluded
 *   Returns true when a solid, non-sensor collider blocks the ray before maxToi.
 * @param {Vec3Array} eye camera eye position [x, y, z]
 * @param {readonly OcclusionParticle[]} activeParticles
 * @param {Float32Array} occlusionOut indexed by particle._poolIndex; 1 = visible, 0 = occluded
 * @param {number} [budget]
 * @returns {void}
 */
export function updateParticleOcclusion(isOccluded, eye, activeParticles, occlusionOut, budget = OCCLUSION_RAYCAST_BUDGET) {
    if (!isOccluded || !eye || !activeParticles || activeParticles.length === 0) return;

    let candidates = activeParticles;
    if (candidates.length > budget) {
        candidates = candidates.slice().sort((a, b) => distSq(eye, a.pos) - distSq(eye, b.pos)).slice(0, budget);
    }

    const ex = eye[0] ?? 0;
    const ey = eye[1] ?? 0;
    const ez = eye[2] ?? 0;
    for (const p of candidates) {
        const pos = p.pos;
        const dx = (pos[0] ?? 0) - ex;
        const dy = (pos[1] ?? 0) - ey;
        const dz = (pos[2] ?? 0) - ez;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 1e-4) {
            occlusionOut[p._poolIndex] = 1;
            continue;
        }

        // Stop just short of the particle so a collider it's embedded in (e.g. an
        // impact spark) doesn't immediately self-occlude it.
        const maxToi = Math.max(0, dist - 0.05);
        const blocked = isOccluded(ex, ey, ez, dx / dist, dy / dist, dz / dist, maxToi);
        occlusionOut[p._poolIndex] = blocked ? 0 : 1;
    }
}

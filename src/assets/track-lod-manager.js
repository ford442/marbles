// @ts-check
/**
 * Distance-based LOD switching for imported track models.
 * Hooks into the render sync loop; physics colliders stay on the highest-detail mesh.
 */

/** @typedef {import('./gltf-track-loader.js').TrackModelEntry} TrackModelEntry */
/** @typedef {import('./gltf-track-loader.js').TrackRenderGroup} TrackRenderGroup */

/**
 * Game members the LOD manager reads. `_cameraState` is written by the camera
 * slice (`game-loop/camera.js`) each frame and declared by no shared host yet.
 * @typedef {Pick<import('../types/engine-context.ts').EngineContext, 'scene' | 'cullingManager'>
 *   & { _cameraState?: { eye?: readonly number[] } | null }} TrackLodManagerHost
 */

/**
 * @param {readonly number[]} a
 * @param {readonly number[]} b
 */
function distanceSq(a, b) {
    const dx = (a[0] ?? 0) - (b[0] ?? 0);
    const dy = (a[1] ?? 0) - (b[1] ?? 0);
    const dz = (a[2] ?? 0) - (b[2] ?? 0);
    return dx * dx + dy * dy + dz * dz;
}

export class TrackLodManager {
    /** @param {TrackLodManagerHost} game */
    constructor(game) {
        this.game = game;
        /** @type {TrackModelEntry[]} */
        this.entries = [];
    }

    reset() {
        this.entries = [];
    }

    /**
     * @param {TrackModelEntry} entry
     */
    register(entry) {
        if (!entry?.lodLevels?.length) return;
        this.entries.push(entry);
    }

    update() {
        if (!this.entries.length) return;

        const cameraState = this.game._cameraState;
        const eye = cameraState?.eye;
        if (!eye) return;

        for (const entry of this.entries) {
            const worldCenter = [
                entry.offset.x + entry.bounds.center[0],
                entry.offset.y + entry.bounds.center[1],
                entry.offset.z + entry.bounds.center[2],
            ];
            const dist = Math.sqrt(distanceSq(eye, worldCenter));

            let targetLod = 0;
            entry.lodLevels.forEach((level, i) => {
                if (dist >= level.distance) targetLod = i + 1;
            });
            if (targetLod === entry.activeLod) continue;

            this.setActiveLod(entry, targetLod);
        }
    }

  /**
   * @param {TrackModelEntry} entry
   * @param {number} lodIndex
   */
    setActiveLod(entry, lodIndex) {
        const { game } = this;
        const scene = game.scene;
        const culling = game.cullingManager;

        /** @param {TrackRenderGroup | undefined} group */
        const hideGroup = (group) => {
            if (!group?.entities) return;
            for (const entity of group.entities) {
                scene.remove(entity);
                culling?.setEntityVisible(entity, false, `track-lod:${entity}`);
            }
        };

        /** @param {TrackRenderGroup | undefined} group */
        const showGroup = (group) => {
            if (!group?.entities) return;
            for (const entity of group.entities) {
                scene.addEntity(entity);
                culling?.setEntityVisible(entity, true, `track-lod:${entity}`);
            }
        };

        hideGroup(entry.renderGroups[entry.activeLod]);
        entry.activeLod = lodIndex;
        showGroup(entry.renderGroups[entry.activeLod]);
    }
}

export default TrackLodManager;

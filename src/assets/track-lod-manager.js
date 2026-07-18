/**
 * Distance-based LOD switching for imported track models.
 * Hooks into the render sync loop; physics colliders stay on the highest-detail mesh.
 */

function distanceSq(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
}

export class TrackLodManager {
    constructor(game) {
        this.game = game;
        /** @type {import('./gltf-track-loader.js').TrackModelEntry[]} */
        this.entries = [];
    }

    reset() {
        this.entries = [];
    }

    /**
     * @param {import('./gltf-track-loader.js').TrackModelEntry} entry
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
            for (let i = 0; i < entry.lodLevels.length; i++) {
                if (dist >= entry.lodLevels[i].distance) targetLod = i + 1;
            }
            if (targetLod === entry.activeLod) continue;

            this.setActiveLod(entry, targetLod);
        }
    }

  /**
   * @param {import('./gltf-track-loader.js').TrackModelEntry} entry
   * @param {number} lodIndex
   */
    setActiveLod(entry, lodIndex) {
        const { game } = this;
        const scene = game.scene;
        const culling = game.cullingManager;

        const hideGroup = (group) => {
            if (!group?.entities) return;
            for (const entity of group.entities) {
                scene.remove(entity);
                culling?.setEntityVisible(entity, false, `track-lod:${entity}`);
            }
        };

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

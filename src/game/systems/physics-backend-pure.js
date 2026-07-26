/** Pure physics worker eligibility checks (Node-testable). */

import { isManifestLevel } from './manifest-level-ids.js';

/** @deprecated Use manifest allowlist — kept for tests referencing the spike id. */
export const WORKER_SPIKE_LEVEL_ID = 'tutorial';

/**
 * @typedef {object} PhysicsWorkerOptions
 * @property {string} [search]
 * @property {boolean} [crossOriginIsolated]
 * @property {boolean} [hasSharedArrayBuffer]
 * @property {boolean} [multiplayerMode]
 * @property {boolean} [hostAuthorityMode]
 * @property {boolean} [editorMode]
 * @property {string | null} [levelId]
 */

/**
 * @param {PhysicsWorkerOptions} [options]
 */
export function shouldUsePhysicsWorker(options = {}) {
    const {
        search = '',
        crossOriginIsolated = false,
        hasSharedArrayBuffer = false,
        multiplayerMode = false,
        hostAuthorityMode = false,
        editorMode = false,
        levelId = null,
    } = options;

    const params = new URLSearchParams(search);
    if (params.get('physicsWorker') === '0') return false;
    if (params.get('physicsWorker') !== '1') return false;
    if (!crossOriginIsolated || !hasSharedArrayBuffer) return false;
    if (multiplayerMode || hostAuthorityMode || editorMode) return false;
    if (levelId != null && !isManifestLevel(levelId)) return false;
    return true;
}

/**
 * @param {string} [search]
 * @returns {60 | 120}
 */
export function resolvePhysicsHzFromSearch(search = '') {
    const params = new URLSearchParams(search);
    const raw = params.get('physicsHz');
    if (raw === '60') return 60;
    return 120;
}

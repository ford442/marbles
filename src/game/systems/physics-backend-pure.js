/** Pure physics worker eligibility checks (Node-testable). */

export const WORKER_SPIKE_LEVEL_ID = 'tutorial';

/**
 * @param {object} options
 * @param {string} [options.search]
 * @param {boolean} [options.crossOriginIsolated]
 * @param {boolean} [options.hasSharedArrayBuffer]
 * @param {boolean} [options.multiplayerMode]
 * @param {boolean} [options.hostAuthorityMode]
 * @param {boolean} [options.editorMode]
 * @param {string|null} [options.levelId]
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
    if (levelId != null && levelId !== WORKER_SPIKE_LEVEL_ID) return false;
    return true;
}

/**
 * @param {string} [search]
 */
export function resolvePhysicsHzFromSearch(search = '') {
    const params = new URLSearchParams(search);
    const raw = params.get('physicsHz');
    if (raw === '60') return 60;
    if (raw === '120') return 120;
    return 120;
}

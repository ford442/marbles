/** Pure physics worker eligibility checks (Node-testable). */

export const WORKER_SPIKE_LEVEL_ID = 'tutorial';

export interface PhysicsWorkerOptions {
    search?: string;
    crossOriginIsolated?: boolean;
    hasSharedArrayBuffer?: boolean;
    multiplayerMode?: boolean;
    hostAuthorityMode?: boolean;
    editorMode?: boolean;
    levelId?: string | null;
}

export function shouldUsePhysicsWorker(options: PhysicsWorkerOptions = {}): boolean {
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

export function resolvePhysicsHzFromSearch(search = ''): 60 | 120 {
    const params = new URLSearchParams(search);
    const raw = params.get('physicsHz');
    if (raw === '60') return 60;
    return 120;
}

/** Pure physics worker eligibility checks (Node-testable). */

import { isManifestLevel } from './manifest-level-ids.js';

/** @deprecated Use manifest allowlist — kept for tests referencing the spike id. */
export const WORKER_SPIKE_LEVEL_ID = 'tutorial';

export interface PhysicsWorkerOptions {
    search?: string;
    crossOriginIsolated?: boolean;
    hasSharedArrayBuffer?: boolean;
    multiplayerMode?: boolean;
    hostAuthorityMode?: boolean;
    editorMode?: boolean;
    levelId?: string | null;
    /** From `detectPlatformProfile().prefersLowPower` (mobile or <=4 cores). */
    lowPowerDevice?: boolean;
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
        lowPowerDevice = false,
    } = options;

    // Default-on for capable desktops; `?physicsWorker=0` is the kill switch and
    // `?physicsWorker=1` forces it on low-power/mobile devices for A/B testing.
    const flag = new URLSearchParams(search).get('physicsWorker');
    if (flag === '0') return false;
    if (flag !== '1' && lowPowerDevice) return false;
    if (!crossOriginIsolated || !hasSharedArrayBuffer) return false;
    if (multiplayerMode || hostAuthorityMode || editorMode) return false;
    if (levelId != null && !isManifestLevel(levelId)) return false;
    return true;
}

export function resolvePhysicsHzFromSearch(search = ''): 60 | 120 {
    const params = new URLSearchParams(search);
    const raw = params.get('physicsHz');
    if (raw === '60') return 60;
    return 120;
}

/** Pure physics worker eligibility checks (Node-testable). */

import { isManifestLevel } from './manifest-level-ids.js';

/** @deprecated Use manifest allowlist — kept for tests referencing the spike id. */
export const WORKER_SPIKE_LEVEL_ID = 'tutorial';

export interface PhysicsWorkerOptions {
    search?: string;
    crossOriginIsolated?: boolean;
    hasSharedArrayBuffer?: boolean;
    /** Party Race. No longer an exclusion: HostSim queues inputs, the worker clock steps. */
    multiplayerMode?: boolean;
    /** `?hostAuth=1`. No longer an exclusion (see `multiplayerMode`). */
    hostAuthorityMode?: boolean;
    /** Map editor (`?editor=1`): stays main-thread — live body editing is not proxied. */
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
    // Main-thread by design (not routed through the ring):
    //   - the map editor creates and edits bodies live on the main world;
    //   - non-manifest levels (`?devLevels=1` sandbox) are not soaked on the worker.
    // Party Race / `?hostAuth=1` are eligible: HostSim only enqueues inputs and
    // reads snapshots; the worker's fixed-step clock is the one host clock.
    if (editorMode) return false;
    if (levelId != null && !isManifestLevel(levelId)) return false;
    return true;
}

export function resolvePhysicsHzFromSearch(search = ''): 60 | 120 {
    const params = new URLSearchParams(search);
    const raw = params.get('physicsHz');
    if (raw === '60') return 60;
    return 120;
}

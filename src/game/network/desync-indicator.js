/**
 * Soft desync indicator for Phase 2 party mode.
 * Detects when remote player state implies velocity inconsistent with position deltas.
 */

const DIVERGENCE_THRESHOLD = 2.0;
const DIVERGENCE_HOLD_MS = 500;

/**
 * @param {object} game
 */
export function initDesyncIndicator(game) {
    if (!game._desyncTracker) {
        game._desyncTracker = {
            active: false,
            sinceMs: 0,
            maxError: 0,
            /** @type {Map<string, { prev: object | null, prevAt: number, vx: number, vy: number, vz: number }>} */
            remote: new Map(),
        };
    }
}

/**
 * @param {object} game
 * @param {string} playerId
 * @param {{ x: number, y: number, z: number, t: number }} frame
 * @param {number} [now]
 */
export function trackRemoteState(game, playerId, frame, now = Date.now()) {
    initDesyncIndicator(game);
    const tracker = game._desyncTracker;
    let entry = tracker.remote.get(playerId);
    if (!entry) {
        entry = { prev: null, prevAt: now, vx: 0, vy: 0, vz: 0 };
        tracker.remote.set(playerId, entry);
    }

    if (!entry.prev) {
        entry.prev = { x: frame.x, y: frame.y, z: frame.z, t: frame.t };
        entry.prevAt = now;
        return;
    }

    const dt = frame.t - entry.prev.t;
    if (dt <= 0.001) return;

    entry.vx = (frame.x - entry.prev.x) / dt;
    entry.vy = (frame.y - entry.prev.y) / dt;
    entry.vz = (frame.z - entry.prev.z) / dt;

    const predictedX = entry.prev.x + entry.vx * dt;
    const predictedY = entry.prev.y + entry.vy * dt;
    const predictedZ = entry.prev.z + entry.vz * dt;
    const error = Math.hypot(
        frame.x - predictedX,
        frame.y - predictedY,
        frame.z - predictedZ
    );

    if (error > DIVERGENCE_THRESHOLD) {
        tracker.maxError = Math.max(tracker.maxError, error);
        if (!tracker.active) {
            tracker.active = true;
            tracker.sinceMs = now;
        }
    }

    entry.prev = { x: frame.x, y: frame.y, z: frame.z, t: frame.t };
    entry.prevAt = now;
}

/**
 * @param {object} game
 * @param {number} [now]
 */
export function updateDesyncIndicator(game, now = Date.now()) {
    initDesyncIndicator(game);
    const tracker = game._desyncTracker;

    if (tracker.active && now - tracker.sinceMs > DIVERGENCE_HOLD_MS) {
        tracker.active = false;
        tracker.maxError = 0;
    }

    const pill = document.getElementById('mp-desync-pill');
    if (pill) {
        pill.classList.toggle('active', tracker.active);
        pill.title = tracker.active
            ? `Physics drift detected (${tracker.maxError.toFixed(1)}u) — expected until host authority (Phase 3)`
            : 'Multiplayer sync OK';
    }

    game.hudManager?.setMultiplayerDesync?.(tracker.active, tracker.maxError);
}

/**
 * @param {object} game
 */
export function resetDesyncIndicator(game) {
    if (!game._desyncTracker) return;
    game._desyncTracker.active = false;
    game._desyncTracker.maxError = 0;
    game._desyncTracker.remote.clear();
    updateDesyncIndicator(game);
}

/**
 * Soft desync indicator for Phase 2 party mode.
 * Detects when remote player state implies velocity inconsistent with position deltas.
 */

import type { HudController } from '../systems/hud-controller.ts';

/** Last position sample (and implied velocity) for one remote player. */
interface RemoteTrack {
    prev: { x: number; y: number; z: number; t: number } | null;
    prevAt: number;
    vx: number;
    vy: number;
    vz: number;
}

export interface DesyncTracker {
    active: boolean;
    sinceMs: number;
    maxError: number;
    remote: Map<string, RemoteTrack>;
}

/** What the desync indicator keeps on the game and reports to. */
export interface DesyncHost {
    _desyncTracker?: DesyncTracker;
    hudController?: Pick<HudController, 'setMultiplayerDesync'> | null;
}

const DIVERGENCE_THRESHOLD = 2.0;
const DIVERGENCE_HOLD_MS = 500;

export function initDesyncIndicator(game: DesyncHost): DesyncTracker {
    if (!game._desyncTracker) {
        game._desyncTracker = {
            active: false,
            sinceMs: 0,
            maxError: 0,
            remote: new Map(),
        };
    }
    return game._desyncTracker;
}

export function trackRemoteState(
    game: DesyncHost,
    playerId: string,
    frame: { x: number; y: number; z: number; t: number },
    now = Date.now(),
): void {
    const tracker = initDesyncIndicator(game);
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

export function updateDesyncIndicator(game: DesyncHost, now = Date.now()): void {
    const tracker = initDesyncIndicator(game);

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

    game.hudController?.setMultiplayerDesync?.(tracker.active, tracker.maxError);
}

export function resetDesyncIndicator(game: DesyncHost): void {
    if (!game._desyncTracker) return;
    game._desyncTracker.active = false;
    game._desyncTracker.maxError = 0;
    game._desyncTracker.remote.clear();
    updateDesyncIndicator(game);
}

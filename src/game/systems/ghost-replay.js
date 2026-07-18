import {
    REPLAY_HZ,
    decodeReplayString,
    encodeReplayString,
    sampleReplayAtTime,
} from './replay-codec.js';

export const GHOST_STORAGE_KEY = 'marbles3d_ghosts';

/**
 * @typedef {object} StoredGhost
 * @property {string} blob
 * @property {number} bestTime
 * @property {number} savedAt
 */

export class GhostReplay {
    constructor() {
        /** @type {Record<string, StoredGhost>} */
        this.data = this.load();
        /** @type {import('./replay-codec.js').ReplayFrame[]} */
        this.recording = [];
        this.lastSampleMs = 0;
        /** @type {import('./replay-codec.js').ReplayFrame[] | null} */
        this.playbackFrames = null;
        this.playbackLevelId = null;
        this._trailCooldown = 0;
    }

    load() {
        try {
            const raw = localStorage.getItem(GHOST_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    save() {
        try {
            localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[GHOST] Failed to persist replay:', e);
        }
    }

    beginRecording() {
        this.recording = [];
        this.lastSampleMs = 0;
    }

    /**
     * @param {object} game
     * @param {number} [now]
     */
    tickRecord(game, now = Date.now()) {
        if (!game.levelStartTime || game.levelComplete || !game.playerMarble || game.timeStopActive) {
            return;
        }

        const elapsedMs = now - game.levelStartTime;
        const sampleIntervalMs = 1000 / REPLAY_HZ;
        if (this.lastSampleMs > 0 && elapsedMs - this.lastSampleMs < sampleIntervalMs - 1) {
            return;
        }
        this.lastSampleMs = elapsedMs;

        const t = game.playerMarble.rigidBody.translation();
        const r = game.playerMarble.rigidBody.rotation();
        const qLen = Math.hypot(r.x, r.y, r.z, r.w) || 1;
        this.recording.push({
            t: elapsedMs / 1000,
            x: t.x,
            y: t.y,
            z: t.z,
            qx: r.x / qLen,
            qy: r.y / qLen,
            qz: r.z / qLen,
            qw: r.w / qLen,
        });
    }

    /**
     * @param {string} levelId
     * @param {number} completionTime
     * @returns {boolean}
     */
    saveBestRecording(levelId, completionTime) {
        if (!this.recording.length) return false;

        const existing = this.data[levelId];
        if (existing && completionTime >= existing.bestTime) {
            return false;
        }

        const blob = encodeReplayString(this.recording, levelId);
        this.data[levelId] = {
            blob,
            bestTime: completionTime,
            savedAt: Date.now(),
        };
        this.save();
        this.loadPlayback(levelId);

        void import('../network/cloud-client.js').then((m) => {
            m.scheduleGhostUpload?.(levelId, blob, completionTime);
        }).catch(() => {});

        return true;
    }

    /**
     * @param {string} levelId
     * @returns {boolean}
     */
    hasGhost(levelId) {
        return Boolean(this.data[levelId]?.blob);
    }

    /**
     * @param {string} levelId
     * @returns {number | undefined}
     */
    getBestTime(levelId) {
        return this.data[levelId]?.bestTime;
    }

    /**
     * @param {string} levelId
     */
    loadPlayback(levelId) {
        const stored = this.data[levelId];
        if (!stored?.blob) {
            this.playbackFrames = null;
            this.playbackLevelId = null;
            return false;
        }

        try {
            const decoded = decodeReplayString(stored.blob);
            this.playbackFrames = decoded.frames;
            this.playbackLevelId = decoded.levelId;
            return true;
        } catch (e) {
            console.warn('[GHOST] Failed to decode stored replay:', e);
            this.playbackFrames = null;
            this.playbackLevelId = null;
            return false;
        }
    }

    /**
     * @param {string} levelId
     * @returns {string | null}
     */
    exportReplay(levelId) {
        const stored = this.data[levelId];
        return stored?.blob ?? null;
    }

    /**
     * @param {string} shareString
     * @param {string} [expectedLevelId]
     * @returns {{ levelId: string, bestTime?: number }}
     */
    importReplay(shareString, expectedLevelId) {
        const decoded = decodeReplayString(shareString);
        if (expectedLevelId && decoded.levelId !== expectedLevelId) {
            throw new Error(`Replay is for "${decoded.levelId}", not "${expectedLevelId}"`);
        }

        const duration = decoded.frames.length
            ? decoded.frames[decoded.frames.length - 1].t
            : 0;

        const existing = this.data[decoded.levelId];
        const bestTime = existing
            ? Math.min(existing.bestTime, duration)
            : duration;

        this.data[decoded.levelId] = {
            blob: shareString.trim(),
            bestTime,
            savedAt: Date.now(),
        };
        this.save();

        if (expectedLevelId && decoded.levelId === expectedLevelId) {
            this.loadPlayback(decoded.levelId);
        }

        return { levelId: decoded.levelId, bestTime };
    }

    /**
     * @param {object} game
     * @param {number} [now]
     * @returns {import('./replay-codec.js').ReplayFrame | null}
     */
    tickPlayback(game, now = Date.now()) {
        if (!this.playbackFrames?.length || !game.ghostEntity || game.timeStopActive) {
            return null;
        }
        if (!game.levelStartTime) return null;

        const elapsedSec = (now - game.levelStartTime) / 1000;
        const frame = sampleReplayAtTime(this.playbackFrames, elapsedSec);
        if (!frame) return null;

        this._trailCooldown--;
        if (this._trailCooldown <= 0 && game.particleSystem) {
            this._trailCooldown = 2;
            game.particleSystem.emitParticles('trail', { x: frame.x, y: frame.y, z: frame.z }, 1, {
                lifetime: 0.35,
                size: 0.12,
                color: [0.2, 0.95, 1.0],
            });
        }

        return frame;
    }

    resetPlayback() {
        this._trailCooldown = 0;
    }
}

export default GhostReplay;

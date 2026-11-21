import {
    REPLAY_HZ,
    decodeReplayString,
    encodeReplayString,
    sampleReplayAtTime,
} from './replay-codec.ts';
import type { ReplayFrame } from './replay-codec.ts';
import type { EngineContext } from '../../types/engine-context.ts';
import type { FrameState } from '../../types/frame-host.ts';

export const GHOST_STORAGE_KEY = 'marbles3d_ghosts';

export interface StoredGhost {
    blob: string;
    bestTime: number;
    savedAt: number;
}

/** What `tickRecord` reads on the game. */
export type GhostRecordHost = Pick<FrameState, 'levelStartTime' | 'levelComplete' | 'playerMarble' | 'timeStopActive'>;

/** What `tickPlayback` reads on the game. */
export type GhostPlaybackHost =
    & Pick<FrameState, 'levelStartTime' | 'ghostEntity' | 'timeStopActive'>
    & Pick<EngineContext, 'particleSystem'>;

export class GhostReplay {
    declare data: Record<string, StoredGhost>;
    declare recording: ReplayFrame[];
    declare lastSampleMs: number;
    declare playbackFrames: ReplayFrame[] | null;
    declare playbackLevelId: string | null;
    declare _trailCooldown: number;

    constructor() {
        this.data = this.load();
        this.recording = [];
        this.lastSampleMs = 0;
        this.playbackFrames = null;
        this.playbackLevelId = null;
        this._trailCooldown = 0;
    }

    load(): Record<string, StoredGhost> {
        try {
            const raw = localStorage.getItem(GHOST_STORAGE_KEY);
            if (!raw) return {};
            // Persisted by `save()`; trusted to be the stored-ghost map.
            const parsed: unknown = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, StoredGhost> : {};
        } catch {
            return {};
        }
    }

    save(): void {
        try {
            localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[GHOST] Failed to persist replay:', e);
        }
    }

    beginRecording(): void {
        this.recording = [];
        this.lastSampleMs = 0;
    }

    tickRecord(game: GhostRecordHost, now = Date.now()): void {
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

    saveBestRecording(levelId: string, completionTime: number): boolean {
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

        void import('../network/cloud-client.ts').then((m) => {
            m.scheduleGhostUpload?.(levelId, blob, completionTime);
        }).catch(() => {});

        return true;
    }

    hasGhost(levelId: string): boolean {
        return Boolean(this.data[levelId]?.blob);
    }

    getBestTime(levelId: string): number | undefined {
        return this.data[levelId]?.bestTime;
    }

    loadPlayback(levelId: string): boolean {
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

    exportReplay(levelId: string): string | null {
        const stored = this.data[levelId];
        return stored?.blob ?? null;
    }

    importReplay(shareString: string, expectedLevelId?: string): { levelId: string; bestTime?: number } {
        const decoded = decodeReplayString(shareString);
        if (expectedLevelId && decoded.levelId !== expectedLevelId) {
            throw new Error(`Replay is for "${decoded.levelId}", not "${expectedLevelId}"`);
        }

        const last = decoded.frames[decoded.frames.length - 1];
        const duration = last ? last.t : 0;

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

    tickPlayback(game: GhostPlaybackHost, now = Date.now()): ReplayFrame | null {
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

    resetPlayback(): void {
        this._trailCooldown = 0;
    }
}

export default GhostReplay;

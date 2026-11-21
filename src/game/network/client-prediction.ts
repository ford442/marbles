import { encodeInputSnapshot, decodeYaw } from './input-bitfield.js';
import type { InputSnapshotHost } from './input-bitfield.js';
import type { NetworkClient } from './network-client.ts';
import type { FrameState } from '../../types/frame-host.ts';

/** What `ClientPrediction` reads on the game: the player marble, level clock, network client, input state. */
export type ClientPredictionHost =
    & Pick<FrameState, 'playerMarble' | 'levelStartTime'>
    & InputSnapshotHost
    & { network?: Pick<NetworkClient, '_inputSeq' | 'getRemoteFrame'> | null };

/** A locally sampled input (the encoded `input` message fields plus level time). */
interface PredictedInput {
    seq: number;
    bits: number;
    yaw: number;
    pitch: number;
    t: number;
}

const INPUT_BUFFER_SIZE = 12;
const HARD_RESYNC_THRESHOLD = 5.0;

/**
 * Client-side prediction + reconciliation for host-authoritative mode (Phase 3 spike).
 */
export class ClientPrediction {
    declare game: ClientPredictionHost;
    declare playerId: string | null;
    declare inputBuffer: PredictedInput[];
    declare correctionCount: number;

    constructor(game: ClientPredictionHost) {
        this.game = game;
        this.playerId = null;
        this.inputBuffer = [];
        this.correctionCount = 0;
    }

    init(playerId: string): void {
        this.playerId = playerId;
        this.inputBuffer = [];
        this.correctionCount = 0;
    }

    recordInput(now = Date.now()): void {
        if (!this.game.levelStartTime) return;
        const snapshot = encodeInputSnapshot(this.game);
        this.inputBuffer.push({
            seq: this.game.network?._inputSeq ?? 0,
            bits: snapshot.bits,
            yaw: snapshot.yaw,
            pitch: snapshot.pitch,
            t: (now - this.game.levelStartTime) / 1000,
        });
        if (this.inputBuffer.length > INPUT_BUFFER_SIZE) {
            this.inputBuffer.shift();
        }
    }

    reconcileFromNetwork(now = Date.now()): void {
        const g = this.game;
        const marble = g.playerMarble;
        if (!this.playerId || !marble?.rigidBody) return;

        const frame = g.network?.getRemoteFrame?.(this.playerId, now);
        if (!frame) return;

        const local = marble.rigidBody.translation();
        const error = Math.hypot(frame.x - local.x, frame.y - local.y, frame.z - local.z);

        if (error > HARD_RESYNC_THRESHOLD) {
            marble.rigidBody.setTranslation({ x: frame.x, y: frame.y, z: frame.z }, true);
            this.correctionCount++;
            console.warn(`[NET] Hard resync (${error.toFixed(2)}u) correction #${this.correctionCount}`);
        } else if (error > 0.5) {
            const blend = 0.25;
            marble.rigidBody.setTranslation({
                x: local.x + (frame.x - local.x) * blend,
                y: local.y + (frame.y - local.y) * blend,
                z: local.z + (frame.z - local.z) * blend,
            }, true);
        }

        void decodeYaw;
    }

    reset(): void {
        this.playerId = null;
        this.inputBuffer = [];
        this.correctionCount = 0;
    }
}

export default ClientPrediction;

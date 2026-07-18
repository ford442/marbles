import { encodeInputSnapshot, decodeYaw } from './input-bitfield.js';

const INPUT_BUFFER_SIZE = 12;
const HARD_RESYNC_THRESHOLD = 5.0;

/**
 * Client-side prediction + reconciliation for host-authoritative mode (Phase 3 spike).
 */
export class ClientPrediction {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.playerId = null;
        /** @type {{ seq: number, bits: number, yaw: number, pitch: number, t: number }[]} */
        this.inputBuffer = [];
        this.correctionCount = 0;
    }

    /** @param {string} playerId */
    init(playerId) {
        this.playerId = playerId;
        this.inputBuffer = [];
        this.correctionCount = 0;
    }

    /**
     * @param {number} now
     */
    recordInput(now = Date.now()) {
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

    /**
     * @param {number} now
     */
    reconcileFromNetwork(now = Date.now()) {
        const g = this.game;
        if (!this.playerId || !g.playerMarble?.rigidBody) return;

        const frame = g.network?.getRemoteFrame?.(this.playerId, now);
        if (!frame) return;

        const local = g.playerMarble.rigidBody.translation();
        const error = Math.hypot(frame.x - local.x, frame.y - local.y, frame.z - local.z);

        if (error > HARD_RESYNC_THRESHOLD) {
            g.playerMarble.rigidBody.setTranslation({ x: frame.x, y: frame.y, z: frame.z }, true);
            this.correctionCount++;
            console.warn(`[NET] Hard resync (${error.toFixed(2)}u) correction #${this.correctionCount}`);
        } else if (error > 0.5) {
            const blend = 0.25;
            g.playerMarble.rigidBody.setTranslation({
                x: local.x + (frame.x - local.x) * blend,
                y: local.y + (frame.y - local.y) * blend,
                z: local.z + (frame.z - local.z) * blend,
            }, true);
        }

        void decodeYaw;
    }

    reset() {
        this.playerId = null;
        this.inputBuffer = [];
        this.correctionCount = 0;
    }
}

export default ClientPrediction;

import { decodeYaw, encodeInputSnapshot } from './input-bitfield.js';
import { MSG, STATE_RATE_HZ } from './protocol.js';

/**
 * Host-authoritative physics simulation for Party Race (Phase 3 spike).
 */
export class HostSim {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.active = false;
        this._lastStepMs = 0;
        this._lastBroadcastMs = 0;
        this._stateSeq = 0;
    }

    /**
     * @param {{ id: string, name: string }[]} players
     * @param {{ x: number, y: number, z: number }} spawn
     */
    init(players, spawn) {
        const g = this.game;
        if (!g.network?.isHost || !g.physicsWorld) return;

        g.physicsWorld.removeNetworkMarbles?.();
        for (let i = 0; i < players.length; i++) {
            const offset = { x: spawn.x + i * 1.5, y: spawn.y, z: spawn.z };
            g.physicsWorld.createNetworkMarble(players[i].id, offset, i);
        }

        this.active = true;
        this._lastStepMs = 0;
        this._lastBroadcastMs = 0;
        this._stateSeq = 0;
    }

    /**
     * @param {number} now
     */
    tick(now = Date.now()) {
        if (!this.active || !this.game.network?.isHost) return;

        const g = this.game;
        if (!g.levelStartTime || !g.networkMarbles?.size) return;

        this._applyRemoteInputs();

        if (now - this._lastStepMs >= 16) {
            g.physicsWorld?.step?.();
            this._lastStepMs = now;
        }

        this._broadcastSnapshots(now);
    }

    _applyRemoteInputs() {
        const g = this.game;

        if (g.network?.playerId) {
            const snap = encodeInputSnapshot(g);
            g.physicsWorld?.applyInputToMarble(
                g.network.playerId,
                snap.bits,
                decodeYaw(snap.yaw),
                0
            );
        }

        const buffers = g.network?._remoteInputBuffers;
        if (!buffers) return;

        for (const [playerId, frames] of buffers.entries()) {
            if (playerId === g.network?.playerId) continue;
            const latest = frames[frames.length - 1];
            if (!latest) continue;
            g.physicsWorld?.applyInputToMarble(
                playerId,
                latest.bits,
                decodeYaw(latest.yaw),
                0
            );
        }
    }

    /**
     * @param {number} now
     */
    _broadcastSnapshots(now) {
        const g = this.game;
        if (!g.network?.room || !g.networkMarbles) return;
        if (now - this._lastBroadcastMs < 1000 / STATE_RATE_HZ - 1) return;
        this._lastBroadcastMs = now;

        for (const [playerId, entry] of g.networkMarbles.entries()) {
            const t = entry.rigidBody.translation();
            const r = entry.rigidBody.rotation();
            const qLen = Math.hypot(r.x, r.y, r.z, r.w) || 1;
            this._stateSeq++;

            g.network.send({
                type: MSG.STATE,
                t: (now - g.levelStartTime) / 1000,
                x: t.x,
                y: t.y,
                z: t.z,
                qx: r.x / qLen,
                qy: r.y / qLen,
                qz: r.z / qLen,
                qw: r.w / qLen,
                seq: this._stateSeq,
                playerId,
            });
        }
    }

    reset() {
        this.active = false;
        this.game.physicsWorld?.removeNetworkMarbles?.();
    }
}

export default HostSim;

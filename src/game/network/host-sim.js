import { decodeYaw, encodeInputSnapshot } from './input-bitfield.js';
import { MSG, STATE_RATE_HZ } from './protocol.js';

/**
 * Host-authoritative physics simulation for Party Race (Phase 3 spike).
 *
 * HostSim never steps the world. Each frame it queues every player's latest
 * input as impulses on the network marbles and broadcasts the resulting poses
 * at `STATE_RATE_HZ`; the frame loop's single fixed-step clock does the
 * stepping (`sync.js`). On the physics worker the impulses ride the command
 * ring and are applied on the worker's own 120 Hz `FixedStepClock`; on the
 * main-thread backend they are applied before the loop's `physicsWorld.step()`
 * calls. There is deliberately no second accumulator here.
 */
export class HostSim {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.active = false;
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
        this._lastBroadcastMs = 0;
        this._stateSeq = 0;
    }

    /**
     * Once per rendered frame (from `tickMultiplayer`).
     * @param {number} now
     */
    tick(now = Date.now()) {
        if (!this.active || !this.game.network?.isHost) return;

        const g = this.game;
        if (!g.levelStartTime || !g.networkMarbles?.size) return;

        // Same contract as local held-key movement (`frame-input.js`): 0.5 per
        // simulated 1/60 s, so a frame that runs no fixed step adds nothing.
        const scale = (g.simDt ?? 1 / 60) * 60;
        if (scale > 0) this._applyRemoteInputs(scale);

        this._broadcastSnapshots(now);
    }

    /** @param {number} [scale] impulse multiplier (simulated seconds × 60) */
    _applyRemoteInputs(scale = 1) {
        const g = this.game;

        if (g.network?.playerId) {
            const snap = encodeInputSnapshot(g);
            g.physicsWorld?.applyInputToMarble(
                g.network.playerId,
                snap.bits,
                decodeYaw(snap.yaw),
                0,
                scale
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
                0,
                scale
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

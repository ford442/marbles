import {
    MSG,
    STATE_RATE_HZ,
    generateRoomCode,
    parseJsonMessage,
    validateClientMessage,
    validateServerMessage,
    serializeMessage,
} from './protocol.js';
import { sampleReplayAtTime } from '../systems/replay-codec.js';

function defaultRelayUrl() {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RELAY_URL) {
        return import.meta.env.VITE_RELAY_URL;
    }
    if (typeof window !== 'undefined') {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.hostname}:8787`;
    }
    return 'ws://localhost:8787';
}

export class NetworkClient {
    /**
     * @param {object} game
     * @param {{ url?: string }} [options]
     */
    constructor(game, options = {}) {
        this.game = game;
        this.url = options.url || defaultRelayUrl();
        /** @type {WebSocket | null} */
        this.socket = null;
        this.connected = false;
        this.room = null;
        this.playerId = null;
        this.isHost = false;
        /** @type {{ id: string, name: string, isHost?: boolean }[]} */
        this.players = [];
        this._stateSeq = 0;
        this._lastSendMs = 0;
        this._sendIntervalMs = 1000 / STATE_RATE_HZ;
        /** @type {Map<string, { frames: object[], lastSeq: number }>} */
        this._remoteBuffers = new Map();
        this.onRoomUpdate = null;
        this.onStarting = null;
        this.onDisconnected = null;
        this.onError = null;
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.url);
            this.socket = ws;

            ws.addEventListener('open', () => {
                this.connected = true;
                resolve();
            });

            ws.addEventListener('error', () => {
                reject(new Error('WebSocket connection failed'));
            });

            ws.addEventListener('close', () => {
                this.connected = false;
                this.room = null;
                this.playerId = null;
                this.players = [];
                this.onDisconnected?.();
            });

            ws.addEventListener('message', (event) => {
                this._handleMessage(event.data);
            });
        });
    }

    disconnect() {
        if (this.socket) {
            this.send({ type: MSG.LEAVE });
            this.socket.close();
            this.socket = null;
        }
        this.connected = false;
        this.room = null;
        this.playerId = null;
        this.players = [];
        this._remoteBuffers.clear();
    }

    /**
     * @param {object} payload
     */
    send(payload) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(serializeMessage(payload));
    }

    /**
     * @param {string} room
     * @param {string} name
     */
    async joinRoom(room, name) {
        await this.connect();
        this.send({ type: MSG.JOIN, room: room.toUpperCase(), name });
    }

    createRoom(name) {
        const room = generateRoomCode();
        return this.joinRoom(room, name).then(() => room);
    }

    /**
     * @param {string} levelId
     */
    requestStart(levelId) {
        if (!this.isHost) return;
        this.send({ type: MSG.START, levelId });
    }

    tickSendState(now = Date.now()) {
        if (!this.room || !this.game.playerMarble || !this.game.levelStartTime) return;
        if (now - this._lastSendMs < this._sendIntervalMs - 1) return;
        this._lastSendMs = now;

        const t = this.game.playerMarble.rigidBody.translation();
        const r = this.game.playerMarble.rigidBody.rotation();
        const qLen = Math.hypot(r.x, r.y, r.z, r.w) || 1;
        this._stateSeq++;

        this.send({
            type: MSG.STATE,
            t: (now - this.game.levelStartTime) / 1000,
            x: t.x,
            y: t.y,
            z: t.z,
            qx: r.x / qLen,
            qy: r.y / qLen,
            qz: r.z / qLen,
            qw: r.w / qLen,
            seq: this._stateSeq,
        });
    }

    /**
     * @param {string} playerId
     * @param {number} [now]
     * @returns {object | null}
     */
    getRemoteFrame(playerId, now = Date.now()) {
        const buf = this._remoteBuffers.get(playerId);
        if (!buf?.frames.length) return null;

        const elapsedSec = this.game.levelStartTime
            ? (now - this.game.levelStartTime) / 1000
            : buf.frames[buf.frames.length - 1].t;

        return sampleReplayAtTime(buf.frames, elapsedSec);
    }

    /**
     * @param {unknown} raw
     */
    _handleMessage(raw) {
        const parsed = parseJsonMessage(typeof raw === 'string' ? raw : String(raw));
        if (!parsed.ok) return;

        const validated = validateServerMessage(parsed.data);
        if (!validated.ok) return;

        const msg = validated.data;
        switch (msg.type) {
            case MSG.JOINED:
                this.room = msg.room;
                this.playerId = msg.playerId;
                this.isHost = Boolean(msg.isHost);
                this.players = Array.isArray(msg.players) ? msg.players : [];
                this.onRoomUpdate?.(this.players);
                break;
            case MSG.PLAYER_JOINED:
            case MSG.ROOM_STATE:
                this.players = Array.isArray(msg.players) ? msg.players : this.players;
                this.onRoomUpdate?.(this.players);
                break;
            case MSG.PLAYER_LEFT:
                this._remoteBuffers.delete(msg.playerId);
                this.game.remotePlayers?.removePlayer(msg.playerId);
                this.players = this.players.filter((p) => p.id !== msg.playerId);
                this.onRoomUpdate?.(this.players);
                break;
            case MSG.STARTING:
                this.onStarting?.(msg.levelId, msg.hostId);
                break;
            case MSG.STATE:
                this._bufferRemoteState(msg);
                break;
            case MSG.ERROR:
                this.onError?.(msg.code, msg.message);
                break;
            default:
                break;
        }
    }

    _bufferRemoteState(msg) {
        if (!msg.playerId || msg.playerId === this.playerId) return;

        let buf = this._remoteBuffers.get(msg.playerId);
        if (!buf) {
            buf = { frames: [], lastSeq: 0 };
            this._remoteBuffers.set(msg.playerId, buf);
        }

        if (msg.seq <= buf.lastSeq) return;
        buf.lastSeq = msg.seq;

        buf.frames.push({
            t: msg.t,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            qx: msg.qx,
            qy: msg.qy,
            qz: msg.qz,
            qw: msg.qw,
        });

        const maxFrames = 3600;
        if (buf.frames.length > maxFrames) {
            buf.frames.splice(0, buf.frames.length - maxFrames);
        }
    }
}

export default NetworkClient;

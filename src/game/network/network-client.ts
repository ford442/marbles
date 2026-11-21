import {
    MSG,
    PROTOCOL_VERSION,
    STATE_RATE_HZ,
    INPUT_RATE_HZ,
    generateRoomCode,
    parseJsonMessage,
    validateClientMessage,
    validateServerMessage,
    serializeMessage,
} from './protocol.js';
import { sampleReplayAtTime } from '../systems/replay-codec.ts';
import { encodeInputSnapshot } from './input-bitfield.js';
import { buildAbilityPayload, applyRemoteAbility } from './ability-sync.ts';
import { trackRemoteState } from './desync-indicator.ts';
import type { AbilitySyncHost, AbilityPayload } from './ability-sync.ts';
import type { DesyncHost } from './desync-indicator.ts';
import type { InputSnapshotHost } from './input-bitfield.js';
import type { RemotePlayers } from './remote-players.ts';
import type {
    ClientMessage, RoomPlayer, ServerInputMessage, ServerStateMessage,
} from './protocol-types.ts';
import type { ReplayFrame } from '../systems/replay-codec.ts';
import type { FrameState } from '../../types/frame-host.ts';

/** An `input` frame buffered from another player (host-authoritative mode). */
export interface RemoteInputFrame {
    t: number;
    seq: number;
    bits: number;
    yaw: number;
    pitch: number;
}

/**
 * Anything `send` writes: a client message, except that an `ability` id is the
 * caller's string (the relay validates it against the registry).
 */
export type OutgoingMessage =
    | Exclude<ClientMessage, { type: 'ability' }>
    | ({ type: 'ability'; t: number; seq: number } & AbilityPayload);

/** What `NetworkClient` reads on the game (plus what it hands to ability sync, desync tracking and input encoding). */
export type NetworkClientHost =
    & Pick<FrameState, 'playerMarble' | 'levelStartTime'>
    & AbilitySyncHost
    & DesyncHost
    & InputSnapshotHost
    & {
        hostAuthorityMode?: boolean;
        remotePlayers?: Pick<RemotePlayers, 'removePlayer'> | null;
    };

function defaultRelayUrl(): string {
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
    declare game: NetworkClientHost;
    declare url: string;
    declare socket: WebSocket | null;
    declare connected: boolean;
    declare room: string | null;
    declare playerId: string | null;
    declare isHost: boolean;
    declare raceSeed: number;
    declare pendingStartAtMs: number | null;
    declare players: RoomPlayer[];
    declare _stateSeq: number;
    declare _abilitySeq: number;
    declare _inputSeq: number;
    declare _lastSendMs: number;
    declare _lastInputSendMs: number;
    declare _sendIntervalMs: number;
    declare _inputIntervalMs: number;
    declare _remoteBuffers: Map<string, { frames: ReplayFrame[]; lastSeq: number }>;
    declare _remoteInputBuffers: Map<string, RemoteInputFrame[]>;
    declare onRoomUpdate: ((players: RoomPlayer[]) => void) | null;
    declare onStarting: ((levelId: string, hostId: string, startAtMs: number, seed: number) => void) | null;
    declare onDisconnected: (() => void) | null;
    declare onError: ((code: string, message: string) => void) | null;

    constructor(game: NetworkClientHost, options: { url?: string } = {}) {
        this.game = game;
        this.url = options.url || defaultRelayUrl();
        this.socket = null;
        this.connected = false;
        this.room = null;
        this.playerId = null;
        this.isHost = false;
        this.raceSeed = 0;
        this.pendingStartAtMs = null;
        this.players = [];
        this._stateSeq = 0;
        this._abilitySeq = 0;
        this._inputSeq = 0;
        this._lastSendMs = 0;
        this._lastInputSendMs = 0;
        this._sendIntervalMs = 1000 / STATE_RATE_HZ;
        this._inputIntervalMs = 1000 / INPUT_RATE_HZ;
        this._remoteBuffers = new Map();
        this._remoteInputBuffers = new Map();
        this.onRoomUpdate = null;
        this.onStarting = null;
        this.onDisconnected = null;
        this.onError = null;
    }

    connect(): Promise<void> {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
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

    disconnect(): void {
        if (this.socket) {
            this.send({ type: MSG.LEAVE });
            this.socket.close();
            this.socket = null;
        }
        this.connected = false;
        this.room = null;
        this.playerId = null;
        this.players = [];
        this.raceSeed = 0;
        this.pendingStartAtMs = null;
        this._remoteBuffers.clear();
        this._remoteInputBuffers.clear();
    }

    send(payload: OutgoingMessage): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(serializeMessage(payload));
    }

    async joinRoom(room: string, name: string): Promise<void> {
        await this.connect();
        this.send({
            type: MSG.JOIN,
            room: room.toUpperCase(),
            name,
            protocolVersion: PROTOCOL_VERSION,
        });
    }

    createRoom(name: string): Promise<string> {
        const room = generateRoomCode();
        return this.joinRoom(room, name).then(() => room);
    }

    requestStart(levelId: string): void {
        if (!this.isHost) return;
        this.send({ type: MSG.START, levelId });
    }

    sendAbility(id: string, charge?: number): void {
        if (!this.room || !this.game.playerMarble || !this.game.levelStartTime) return;
        const payload = buildAbilityPayload(this.game, id, charge);
        if (!payload) return;

        this._abilitySeq++;
        this.send({
            type: MSG.ABILITY,
            t: (Date.now() - this.game.levelStartTime) / 1000,
            seq: this._abilitySeq,
            ...payload,
        });
    }

    tickSendState(now = Date.now()): void {
        const marble = this.game.playerMarble;
        if (!this.room || !marble || !this.game.levelStartTime) return;
        if (now - this._lastSendMs < this._sendIntervalMs - 1) return;
        this._lastSendMs = now;

        const t = marble.rigidBody.translation();
        const r = marble.rigidBody.rotation();
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

    tickSendInput(now = Date.now()): void {
        if (!this.room || !this.game.levelStartTime) return;
        if (now - this._lastInputSendMs < this._inputIntervalMs - 1) return;
        this._lastInputSendMs = now;

        const snapshot = encodeInputSnapshot(this.game);
        this._inputSeq++;

        this.send({
            type: MSG.INPUT,
            t: (now - this.game.levelStartTime) / 1000,
            seq: this._inputSeq,
            bits: snapshot.bits,
            yaw: snapshot.yaw,
            pitch: snapshot.pitch,
        });
    }

    getRemoteFrame(playerId: string, now = Date.now()): ReplayFrame | null {
        const frames = this._remoteBuffers.get(playerId)?.frames;
        const last = frames?.[frames.length - 1];
        if (!frames || !last) return null;

        const elapsedSec = this.game.levelStartTime
            ? (now - this.game.levelStartTime) / 1000
            : last.t;

        return sampleReplayAtTime(frames, elapsedSec);
    }

    _handleMessage(raw: unknown): void {
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
                this.players = 'players' in msg && Array.isArray(msg.players) ? msg.players : this.players;
                this.onRoomUpdate?.(this.players);
                break;
            case MSG.PLAYER_LEFT:
                this._remoteBuffers.delete(msg.playerId);
                this._remoteInputBuffers.delete(msg.playerId);
                this.game.remotePlayers?.removePlayer(msg.playerId);
                this.players = this.players.filter((p) => p.id !== msg.playerId);
                this.onRoomUpdate?.(this.players);
                break;
            case MSG.STARTING:
                this.raceSeed = msg.seed ?? 0;
                this.pendingStartAtMs = msg.startAtMs ?? null;
                this.onStarting?.(msg.levelId, msg.hostId, msg.startAtMs, msg.seed);
                break;
            case MSG.STATE:
                this._bufferRemoteState(msg);
                break;
            case MSG.ABILITY:
                applyRemoteAbility(this.game, msg);
                break;
            case MSG.INPUT:
                this._bufferRemoteInput(msg);
                break;
            case MSG.ERROR:
                this.onError?.(msg.code, msg.message);
                break;
            default:
                break;
        }
    }

    _bufferRemoteState(msg: ServerStateMessage): void {
        if (!msg.playerId) return;
        if (msg.playerId === this.playerId && !this.game.hostAuthorityMode) return;

        let buf = this._remoteBuffers.get(msg.playerId);
        if (!buf) {
            buf = { frames: [], lastSeq: 0 };
            this._remoteBuffers.set(msg.playerId, buf);
        }

        if (msg.seq <= buf.lastSeq) return;
        buf.lastSeq = msg.seq;

        const frame: ReplayFrame = {
            t: msg.t,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            qx: msg.qx,
            qy: msg.qy,
            qz: msg.qz,
            qw: msg.qw,
        };
        buf.frames.push(frame);
        trackRemoteState(this.game, msg.playerId, frame);

        const maxFrames = 3600;
        if (buf.frames.length > maxFrames) {
            buf.frames.splice(0, buf.frames.length - maxFrames);
        }
    }

    _bufferRemoteInput(msg: ServerInputMessage): void {
        if (!msg.playerId || msg.playerId === this.playerId) return;

        let buf = this._remoteInputBuffers.get(msg.playerId);
        if (!buf) {
            buf = [];
            this._remoteInputBuffers.set(msg.playerId, buf);
        }

        buf.push({
            t: msg.t,
            seq: msg.seq,
            bits: msg.bits,
            yaw: msg.yaw,
            pitch: msg.pitch,
        });

        if (buf.length > 120) {
            buf.splice(0, buf.length - 120);
        }
    }
}

export default NetworkClient;

export type ClientMessageType = 'join' | 'leave' | 'state' | 'start' | 'ping' | 'ability' | 'input';
export type ServerMessageType =
    | 'joined'
    | 'player_joined'
    | 'player_left'
    | 'room_state'
    | 'starting'
    | 'state'
    | 'ability'
    | 'input'
    | 'error'
    | 'pong';

export interface JoinMessage {
    type: 'join';
    room: string;
    name: string;
    protocolVersion: number;
}

export interface LeaveMessage {
    type: 'leave';
}

export interface StartMessage {
    type: 'start';
    levelId: string;
}

export interface PingMessage {
    type: 'ping';
    t: number;
}

export interface StateMessage {
    type: 'state';
    t: number;
    x: number;
    y: number;
    z: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    seq: number;
    playerId?: string;
}

export interface AbilityMessage {
    type: 'ability';
    id: AbilityId;
    t: number;
    seq: number;
    ox: number;
    oy: number;
    oz: number;
    dx: number;
    dy: number;
    dz: number;
    charge?: number;
}

export interface InputMessage {
    type: 'input';
    t: number;
    seq: number;
    bits: number;
    yaw: number;
    pitch: number;
}

export type ClientMessage =
    | JoinMessage
    | LeaveMessage
    | StartMessage
    | PingMessage
    | StateMessage
    | AbilityMessage
    | InputMessage;

/** A room member as the relay lists it (`roomPlayers` in server/relay.mjs). */
export interface RoomPlayer {
    id: string;
    name: string;
    isHost?: boolean;
}

/**
 * Reply to `join`; also sent (with `room`/`playerId` null and no players) as
 * the acknowledgement of `leave`.
 */
export interface JoinedMessage {
    type: 'joined';
    room: string | null;
    playerId: string | null;
    isHost?: boolean;
    players: RoomPlayer[];
    protocolVersion?: number;
}

export interface PlayerJoinedMessage {
    type: 'player_joined';
    player: RoomPlayer;
}

export interface PlayerLeftMessage {
    type: 'player_left';
    playerId: string;
}

export interface RoomStateMessage {
    type: 'room_state';
    players: RoomPlayer[];
}

export interface StartingMessage {
    type: 'starting';
    levelId: string;
    hostId: string;
    startAtMs: number;
    seed: number;
    protocolVersion: number;
}

/** Relayed client messages carry the sender's id. */
export interface ServerStateMessage extends StateMessage {
    playerId: string;
}

export interface ServerAbilityMessage extends AbilityMessage {
    playerId: string;
}

export interface ServerInputMessage extends InputMessage {
    playerId: string;
}

export interface ErrorMessage {
    type: 'error';
    code: string;
    message: string;
}

export interface PongMessage {
    type: 'pong';
    t: number;
}

/**
 * What server/relay.mjs sends. `validateServerMessage` only whitelists the
 * `type`; the relay is trusted for the field shapes.
 */
export type ServerMessage =
    | JoinedMessage
    | PlayerJoinedMessage
    | PlayerLeftMessage
    | RoomStateMessage
    | StartingMessage
    | ServerStateMessage
    | ServerAbilityMessage
    | ServerInputMessage
    | ErrorMessage
    | PongMessage;

export type ValidationResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };
import type { AbilityId } from '../../abilities/registry.js';

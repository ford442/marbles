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

export type ServerMessage = { type: ServerMessageType } & Record<string, unknown>;

export type ValidationResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };
import type { AbilityId } from '../../abilities/registry.js';

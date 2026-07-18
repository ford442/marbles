import { ALL_ABILITY_IDS } from '../../abilities/registry.js';

/** @typedef {'join' | 'leave' | 'state' | 'start' | 'ping' | 'ability' | 'input'} ClientMessageType */
/** @typedef {'joined' | 'player_joined' | 'player_left' | 'room_state' | 'starting' | 'state' | 'ability' | 'input' | 'error' | 'pong'} ServerMessageType */

export const PROTOCOL_VERSION = 2;
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_ROOM_ID_LEN = 8;
export const MAX_PLAYER_NAME_LEN = 24;
export const STATE_RATE_HZ = 20;
export const ABILITY_RATE_HZ = 30;
export const INPUT_RATE_HZ = 30;
export const MAX_PLAYERS_PER_ROOM = 8;
/** Matches 3×800 ms countdown + GO flash in level-loader. */
export const COUNTDOWN_MS = 3200;

const ABILITY_ID_SET = new Set(ALL_ABILITY_IDS);

export const MSG = {
    JOIN: 'join',
    LEAVE: 'leave',
    STATE: 'state',
    START: 'start',
    PING: 'ping',
    ABILITY: 'ability',
    INPUT: 'input',
    JOINED: 'joined',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    ROOM_STATE: 'room_state',
    STARTING: 'starting',
    ERROR: 'error',
    PONG: 'pong',
};

const CLIENT_TYPES = new Set([
    MSG.JOIN, MSG.LEAVE, MSG.STATE, MSG.START, MSG.PING, MSG.ABILITY, MSG.INPUT,
]);
const SERVER_TYPES = new Set([
    MSG.JOINED, MSG.PLAYER_JOINED, MSG.PLAYER_LEFT, MSG.ROOM_STATE,
    MSG.STARTING, MSG.STATE, MSG.ABILITY, MSG.INPUT, MSG.ERROR, MSG.PONG,
]);

const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isString(value) {
    return typeof value === 'string';
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isValidSeq(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function parseJsonMessage(raw) {
    if (typeof raw !== 'string') {
        return { ok: false, error: 'Payload must be a UTF-8 string' };
    }
    if (raw.length > MAX_MESSAGE_BYTES) {
        return { ok: false, error: 'Message too large' };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, error: 'Invalid JSON' };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'Message must be a JSON object' };
    }

    return { ok: true, data: parsed };
}

/**
 * @param {unknown} version
 * @returns {boolean}
 */
export function isSupportedProtocolVersion(version) {
    return typeof version === 'number' && version === PROTOCOL_VERSION;
}

/**
 * @param {string} roomCode
 * @returns {number}
 */
export function hashRoomCode(roomCode) {
    let hash = 2166136261;
    for (let i = 0; i < roomCode.length; i++) {
        hash ^= roomCode.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * @param {object} msg
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateClientMessage(msg) {
    if (!isString(msg.type) || !CLIENT_TYPES.has(msg.type)) {
        return { ok: false, error: 'Unknown client message type' };
    }

    if (msg.type === MSG.JOIN) {
        if (!isString(msg.room) || !ROOM_CODE_RE.test(msg.room)) {
            return { ok: false, error: 'Invalid room code' };
        }
        const name = isString(msg.name) ? msg.name.trim().slice(0, MAX_PLAYER_NAME_LEN) : 'Marble';
        if (!name) return { ok: false, error: 'Invalid player name' };
        if (!isFiniteNumber(msg.protocolVersion) || !isSupportedProtocolVersion(msg.protocolVersion)) {
            return { ok: false, error: 'Unsupported protocol version' };
        }
        return { ok: true, data: { type: MSG.JOIN, room: msg.room, name, protocolVersion: msg.protocolVersion } };
    }

    if (msg.type === MSG.LEAVE) {
        return { ok: true, data: { type: MSG.LEAVE } };
    }

    if (msg.type === MSG.START) {
        const levelId = isString(msg.levelId) ? msg.levelId.trim().slice(0, 64) : 'tutorial';
        return { ok: true, data: { type: MSG.START, levelId } };
    }

    if (msg.type === MSG.PING) {
        if (!isFiniteNumber(msg.t)) return { ok: false, error: 'Invalid ping timestamp' };
        return { ok: true, data: { type: MSG.PING, t: msg.t } };
    }

    if (msg.type === MSG.STATE) {
        const fields = ['t', 'x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'seq'];
        for (const key of fields) {
            if (!isFiniteNumber(msg[key])) {
                return { ok: false, error: `Invalid state field: ${key}` };
            }
        }
        if (!isValidSeq(msg.seq)) {
            return { ok: false, error: 'Invalid state seq' };
        }
        const data = {
            type: MSG.STATE,
            t: msg.t,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            qx: msg.qx,
            qy: msg.qy,
            qz: msg.qz,
            qw: msg.qw,
            seq: msg.seq,
        };
        if (msg.playerId !== undefined) {
            if (!isString(msg.playerId) || msg.playerId.length > 64) {
                return { ok: false, error: 'Invalid state playerId' };
            }
            data.playerId = msg.playerId;
        }
        return { ok: true, data };
    }

    if (msg.type === MSG.ABILITY) {
        if (!isString(msg.id) || !ABILITY_ID_SET.has(msg.id)) {
            return { ok: false, error: 'Invalid ability id' };
        }
        if (!isFiniteNumber(msg.t) || !isValidSeq(msg.seq)) {
            return { ok: false, error: 'Invalid ability timing fields' };
        }
        const originFields = ['ox', 'oy', 'oz'];
        const dirFields = ['dx', 'dy', 'dz'];
        for (const key of [...originFields, ...dirFields]) {
            if (!isFiniteNumber(msg[key])) {
                return { ok: false, error: `Invalid ability field: ${key}` };
            }
        }
        const data = {
            type: MSG.ABILITY,
            id: msg.id,
            t: msg.t,
            seq: msg.seq,
            ox: msg.ox,
            oy: msg.oy,
            oz: msg.oz,
            dx: msg.dx,
            dy: msg.dy,
            dz: msg.dz,
        };
        if (msg.charge !== undefined) {
            if (!isFiniteNumber(msg.charge) || msg.charge < 0 || msg.charge > 1) {
                return { ok: false, error: 'Invalid ability charge' };
            }
            data.charge = msg.charge;
        }
        return { ok: true, data };
    }

    if (msg.type === MSG.INPUT) {
        if (!isFiniteNumber(msg.t) || !isValidSeq(msg.seq)) {
            return { ok: false, error: 'Invalid input timing fields' };
        }
        if (!Number.isInteger(msg.bits) || msg.bits < 0 || msg.bits > 0xffffffff) {
            return { ok: false, error: 'Invalid input bits' };
        }
        if (!Number.isInteger(msg.yaw) || msg.yaw < -32768 || msg.yaw > 32767) {
            return { ok: false, error: 'Invalid input yaw' };
        }
        if (!Number.isInteger(msg.pitch) || msg.pitch < -32768 || msg.pitch > 32767) {
            return { ok: false, error: 'Invalid input pitch' };
        }
        return {
            ok: true,
            data: {
                type: MSG.INPUT,
                t: msg.t,
                seq: msg.seq,
                bits: msg.bits >>> 0,
                yaw: msg.yaw,
                pitch: msg.pitch,
            },
        };
    }

    return { ok: false, error: 'Unhandled client message' };
}

/**
 * @param {object} msg
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateServerMessage(msg) {
    if (!isString(msg.type) || !SERVER_TYPES.has(msg.type)) {
        return { ok: false, error: 'Unknown server message type' };
    }
    return { ok: true, data: msg };
}

/**
 * @returns {string}
 */
export function generateRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

/**
 * @param {number} index
 * @returns {[number, number, number]}
 */
export function playerColorForIndex(index) {
    const palette = [
        [1.0, 0.35, 0.45],
        [0.35, 0.85, 1.0],
        [0.55, 1.0, 0.45],
        [1.0, 0.85, 0.25],
        [0.75, 0.45, 1.0],
        [1.0, 0.55, 0.2],
        [0.4, 1.0, 0.85],
        [0.95, 0.95, 0.95],
    ];
    return palette[index % palette.length];
}

/**
 * @param {object} payload
 * @returns {string}
 */
export function serializeMessage(payload) {
    return JSON.stringify(payload);
}

/** @typedef {'join' | 'leave' | 'state' | 'start' | 'ping'} ClientMessageType */
/** @typedef {'joined' | 'player_joined' | 'player_left' | 'room_state' | 'starting' | 'state' | 'error' | 'pong'} ServerMessageType */

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_ROOM_ID_LEN = 8;
export const MAX_PLAYER_NAME_LEN = 24;
export const STATE_RATE_HZ = 20;
export const MAX_PLAYERS_PER_ROOM = 8;

export const MSG = {
    JOIN: 'join',
    LEAVE: 'leave',
    STATE: 'state',
    START: 'start',
    PING: 'ping',
    JOINED: 'joined',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    ROOM_STATE: 'room_state',
    STARTING: 'starting',
    ERROR: 'error',
    PONG: 'pong',
};

const CLIENT_TYPES = new Set([MSG.JOIN, MSG.LEAVE, MSG.STATE, MSG.START, MSG.PING]);
const SERVER_TYPES = new Set([
    MSG.JOINED, MSG.PLAYER_JOINED, MSG.PLAYER_LEFT, MSG.ROOM_STATE,
    MSG.STARTING, MSG.STATE, MSG.ERROR, MSG.PONG,
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
        return { ok: true, data: { type: MSG.JOIN, room: msg.room, name } };
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
        return {
            ok: true,
            data: {
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

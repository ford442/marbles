/** @typedef {{ t: number, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number }} ReplayFrame */

export const REPLAY_HZ = 30;
export const REPLAY_MAGIC = 'M3G1';
export const REPLAY_VERSION = 1;
export const REPLAY_PREFIX = 'm3g1:';

const POS_SCALE = 200; // 5 mm units
const QUAT_SCALE = 32767;

function clampInt16(v) {
    return Math.max(-32768, Math.min(32767, v | 0));
}

function clampInt32(v) {
    return Math.max(-2147483648, Math.min(2147483647, v | 0));
}

function quantizePos(v) {
    return clampInt32(Math.round(v * POS_SCALE));
}

function quantizeQuat(v) {
    return clampInt16(Math.round(v * QUAT_SCALE));
}

function dequantizePos(v) {
    return v / POS_SCALE;
}

function dequantizeQuat(v) {
    return v / QUAT_SCALE;
}

function normalizeQuat(q) {
    const len = Math.hypot(q.qx, q.qy, q.qz, q.qw) || 1;
    return {
        qx: q.qx / len,
        qy: q.qy / len,
        qz: q.qz / len,
        qw: q.qw / len,
    };
}

/**
 * @param {ReplayFrame[]} frames
 * @param {string} levelId
 * @returns {Uint8Array}
 */
export function encodeReplayBinary(frames, levelId) {
    const levelBytes = new TextEncoder().encode(levelId);
    if (levelBytes.length > 255) {
        throw new Error('levelId too long');
    }

    const frameCount = frames.length;
    const headerSize = 4 + 1 + 1 + levelBytes.length + 2 + 2;
    const bodySize = frameCount * 20;
    const buffer = new ArrayBuffer(headerSize + bodySize);
    const view = new DataView(buffer);
    let offset = 0;

    for (let i = 0; i < 4; i++) {
        view.setUint8(offset++, REPLAY_MAGIC.charCodeAt(i));
    }
    view.setUint8(offset++, REPLAY_VERSION);
    view.setUint8(offset++, levelBytes.length);
    for (let i = 0; i < levelBytes.length; i++) {
        view.setUint8(offset++, levelBytes[i]);
    }
    view.setUint16(offset, frameCount, true);
    offset += 2;

    const durationMs = frameCount > 0
        ? Math.round(frames[frameCount - 1].t * 1000)
        : 0;
    view.setUint16(offset, durationMs, true);
    offset += 2;

    let prevPos = [0, 0, 0];
    let prevQuat = [0, 0, 0, 0];

    for (let i = 0; i < frameCount; i++) {
        const frame = frames[i];
        const pos = [quantizePos(frame.x), quantizePos(frame.y), quantizePos(frame.z)];
        const quat = [
            quantizeQuat(frame.qx),
            quantizeQuat(frame.qy),
            quantizeQuat(frame.qz),
            quantizeQuat(frame.qw),
        ];

        const posOut = i === 0
            ? pos
            : pos.map((v, idx) => clampInt32(v - prevPos[idx]));
        const quatOut = i === 0
            ? quat
            : quat.map((v, idx) => clampInt16(v - prevQuat[idx]));

        for (let j = 0; j < 3; j++) {
            view.setInt32(offset, posOut[j], true);
            offset += 4;
        }
        for (let j = 0; j < 4; j++) {
            view.setInt16(offset, quatOut[j], true);
            offset += 2;
        }

        prevPos = pos;
        prevQuat = quat;
    }

    return new Uint8Array(buffer);
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ levelId: string, frames: ReplayFrame[] }}
 */
export function decodeReplayBinary(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    const magic = String.fromCharCode(
        view.getUint8(offset++),
        view.getUint8(offset++),
        view.getUint8(offset++),
        view.getUint8(offset++),
    );
    if (magic !== REPLAY_MAGIC) {
        throw new Error('Invalid replay magic');
    }

    const version = view.getUint8(offset++);
    if (version !== REPLAY_VERSION) {
        throw new Error(`Unsupported replay version: ${version}`);
    }

    const levelIdLen = view.getUint8(offset++);
    const levelBytes = new Uint8Array(levelIdLen);
    for (let i = 0; i < levelIdLen; i++) {
        levelBytes[i] = view.getUint8(offset++);
    }
    const levelId = new TextDecoder().decode(levelBytes);

    const frameCount = view.getUint16(offset, true);
    offset += 2;
    offset += 2; // durationMs — informational only

    const frames = [];
    let pos = [0, 0, 0];
    let quat = [0, 0, 0, 0];

    for (let i = 0; i < frameCount; i++) {
        const posDelta = [
            view.getInt32(offset, true),
            view.getInt32(offset + 4, true),
            view.getInt32(offset + 8, true),
        ];
        offset += 12;

        const quatDelta = [
            view.getInt16(offset, true),
            view.getInt16(offset + 2, true),
            view.getInt16(offset + 4, true),
            view.getInt16(offset + 6, true),
        ];
        offset += 8;

        if (i === 0) {
            pos = [...posDelta];
            quat = [...quatDelta];
        } else {
            pos = pos.map((v, idx) => v + posDelta[idx]);
            quat = quat.map((v, idx) => v + quatDelta[idx]);
        }

        const q = normalizeQuat({
            qx: dequantizeQuat(quat[0]),
            qy: dequantizeQuat(quat[1]),
            qz: dequantizeQuat(quat[2]),
            qw: dequantizeQuat(quat[3]),
        });

        frames.push({
            t: i / REPLAY_HZ,
            x: dequantizePos(pos[0]),
            y: dequantizePos(pos[1]),
            z: dequantizePos(pos[2]),
            ...q,
        });
    }

    return { levelId, frames };
}

/**
 * @param {ReplayFrame[]} frames
 * @param {string} levelId
 */
export function encodeReplayString(frames, levelId) {
    const binary = encodeReplayBinary(frames, levelId);
    let binaryStr = '';
    for (let i = 0; i < binary.length; i++) {
        binaryStr += String.fromCharCode(binary[i]);
    }
    return REPLAY_PREFIX + btoa(binaryStr);
}

/**
 * @param {string} shareString
 * @returns {{ levelId: string, frames: ReplayFrame[] }}
 */
export function decodeReplayString(shareString) {
    const trimmed = shareString.trim();
    if (!trimmed.startsWith(REPLAY_PREFIX)) {
        throw new Error('Invalid replay prefix');
    }
    const b64 = trimmed.slice(REPLAY_PREFIX.length);
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return decodeReplayBinary(bytes);
}

/**
 * @param {ReplayFrame | null} a
 * @param {ReplayFrame | null} b
 * @param {number} alpha 0..1
 * @returns {ReplayFrame | null}
 */
export function interpolateFrames(a, b, alpha) {
    if (!a) return b;
    if (!b) return a;
    const t = Math.max(0, Math.min(1, alpha));
    const q = normalizeQuat({
        qx: a.qx + (b.qx - a.qx) * t,
        qy: a.qy + (b.qy - a.qy) * t,
        qz: a.qz + (b.qz - a.qz) * t,
        qw: a.qw + (b.qw - a.qw) * t,
    });
    return {
        t: a.t + (b.t - a.t) * t,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        ...q,
    };
}

/**
 * @param {ReplayFrame[]} frames
 * @param {number} elapsedSec
 * @returns {ReplayFrame | null}
 */
export function sampleReplayAtTime(frames, elapsedSec) {
    if (!frames?.length) return null;
    if (elapsedSec <= 0) return frames[0];
    if (elapsedSec >= frames[frames.length - 1].t) {
        return frames[frames.length - 1];
    }

    const idx = Math.min(
        frames.length - 2,
        Math.max(0, Math.floor(elapsedSec * REPLAY_HZ)),
    );
    const a = frames[idx];
    const b = frames[idx + 1];
    const span = b.t - a.t || (1 / REPLAY_HZ);
    const alpha = (elapsedSec - a.t) / span;
    return interpolateFrames(a, b, alpha);
}

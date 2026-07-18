export interface ReplayFrame {
    t: number;
    x: number;
    y: number;
    z: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
}

export interface DecodedReplay {
    levelId: string;
    frames: ReplayFrame[];
}

export const REPLAY_HZ = 30;
export const REPLAY_MAGIC = 'M3G1';
export const REPLAY_VERSION = 1;
export const REPLAY_PREFIX = 'm3g1:';

const POS_SCALE = 200;
const QUAT_SCALE = 32767;

function clampInt16(v: number): number {
    return Math.max(-32768, Math.min(32767, v | 0));
}

function clampInt32(v: number): number {
    return Math.max(-2147483648, Math.min(2147483647, v | 0));
}

function quantizePos(v: number): number {
    return clampInt32(Math.round(v * POS_SCALE));
}

function quantizeQuat(v: number): number {
    return clampInt16(Math.round(v * QUAT_SCALE));
}

function dequantizePos(v: number): number {
    return v / POS_SCALE;
}

function dequantizeQuat(v: number): number {
    return v / QUAT_SCALE;
}

function normalizeQuat(q: Pick<ReplayFrame, 'qx' | 'qy' | 'qz' | 'qw'>): Pick<ReplayFrame, 'qx' | 'qy' | 'qz' | 'qw'> {
    const len = Math.hypot(q.qx, q.qy, q.qz, q.qw) || 1;
    return {
        qx: q.qx / len,
        qy: q.qy / len,
        qz: q.qz / len,
        qw: q.qw / len,
    };
}

export function encodeReplayBinary(frames: ReplayFrame[], levelId: string): Uint8Array {
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
        view.setUint8(offset++, REPLAY_MAGIC.charCodeAt(i)!);
    }
    view.setUint8(offset++, REPLAY_VERSION);
    view.setUint8(offset++, levelBytes.length);
    for (let i = 0; i < levelBytes.length; i++) {
        view.setUint8(offset++, levelBytes[i]!);
    }
    view.setUint16(offset, frameCount, true);
    offset += 2;

    const lastFrame = frames[frameCount - 1];
    const durationMs = frameCount > 0 && lastFrame
        ? Math.round(lastFrame.t * 1000)
        : 0;
    view.setUint16(offset, durationMs, true);
    offset += 2;

    let prevPos: [number, number, number] = [0, 0, 0];
    let prevQuat: [number, number, number, number] = [0, 0, 0, 0];

    for (let i = 0; i < frameCount; i++) {
        const frame = frames[i]!;
        const pos: [number, number, number] = [
            quantizePos(frame.x),
            quantizePos(frame.y),
            quantizePos(frame.z),
        ];
        const quat: [number, number, number, number] = [
            quantizeQuat(frame.qx),
            quantizeQuat(frame.qy),
            quantizeQuat(frame.qz),
            quantizeQuat(frame.qw),
        ];

        const posOut = i === 0
            ? pos
            : pos.map((v, idx) => clampInt32(v - prevPos[idx]!)) as [number, number, number];
        const quatOut = i === 0
            ? quat
            : quat.map((v, idx) => clampInt16(v - prevQuat[idx]!)) as [number, number, number, number];

        for (let j = 0; j < 3; j++) {
            view.setInt32(offset, posOut[j]!, true);
            offset += 4;
        }
        for (let j = 0; j < 4; j++) {
            view.setInt16(offset, quatOut[j]!, true);
            offset += 2;
        }

        prevPos = pos;
        prevQuat = quat;
    }

    return new Uint8Array(buffer);
}

export function decodeReplayBinary(bytes: Uint8Array): DecodedReplay {
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
        levelBytes[i] = view.getUint8(offset++)!;
    }
    const levelId = new TextDecoder().decode(levelBytes);

    const frameCount = view.getUint16(offset, true);
    offset += 2;
    offset += 2;

    const frames: ReplayFrame[] = [];
    let pos: [number, number, number] = [0, 0, 0];
    let quat: [number, number, number, number] = [0, 0, 0, 0];

    for (let i = 0; i < frameCount; i++) {
        const posDelta: [number, number, number] = [
            view.getInt32(offset, true),
            view.getInt32(offset + 4, true),
            view.getInt32(offset + 8, true),
        ];
        offset += 12;

        const quatDelta: [number, number, number, number] = [
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
            pos = pos.map((v, idx) => v + posDelta[idx]!) as [number, number, number];
            quat = quat.map((v, idx) => v + quatDelta[idx]!) as [number, number, number, number];
        }

        const q = normalizeQuat({
            qx: dequantizeQuat(quat[0]!),
            qy: dequantizeQuat(quat[1]!),
            qz: dequantizeQuat(quat[2]!),
            qw: dequantizeQuat(quat[3]!),
        });

        frames.push({
            t: i / REPLAY_HZ,
            x: dequantizePos(pos[0]!),
            y: dequantizePos(pos[1]!),
            z: dequantizePos(pos[2]!),
            ...q,
        });
    }

    return { levelId, frames };
}

export function encodeReplayString(frames: ReplayFrame[], levelId: string): string {
    const binary = encodeReplayBinary(frames, levelId);
    let binaryStr = '';
    for (let i = 0; i < binary.length; i++) {
        binaryStr += String.fromCharCode(binary[i]!);
    }
    return REPLAY_PREFIX + btoa(binaryStr);
}

export function decodeReplayString(shareString: string): DecodedReplay {
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

export function interpolateFrames(a: ReplayFrame | null, b: ReplayFrame | null, alpha: number): ReplayFrame | null {
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

export function sampleReplayAtTime(frames: ReplayFrame[], elapsedSec: number): ReplayFrame | null {
    if (!frames.length) return null;
    const first = frames[0]!;
    const last = frames[frames.length - 1]!;
    if (elapsedSec <= 0) return first;
    if (elapsedSec >= last.t) {
        return last;
    }

    const idx = Math.min(
        frames.length - 2,
        Math.max(0, Math.floor(elapsedSec * REPLAY_HZ)),
    );
    const a = frames[idx]!;
    const b = frames[idx + 1]!;
    const span = b.t - a.t || (1 / REPLAY_HZ);
    const alpha = (elapsedSec - a.t) / span;
    return interpolateFrames(a, b, alpha);
}

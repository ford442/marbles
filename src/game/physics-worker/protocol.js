/** Shared layout for physics worker SharedArrayBuffers (main + worker). */

export const MAX_BODIES = 256;

/**
 * Snapshot layout version. Bump whenever the per-body record or header
 * changes; the worker stamps it into the header and the main thread refuses
 * a mismatched worker.
 *   v1: pose only (8 floats)
 *   v2: pose + linvel + angvel + mass + body type (16 floats), step interval,
 *       applied-command counter
 */
export const SNAPSHOT_LAYOUT_VERSION = 2;

/** Per-body record offsets (floats). */
export const BODY_POS = 0;
export const BODY_ROT = 3;
export const BODY_VALID = 7;
export const BODY_LINVEL = 8;
export const BODY_ANGVEL = 11;
export const BODY_MASS = 14;
export const BODY_TYPE = 15;
export const BODY_FLOATS = 16;
export const BODY_STRIDE_BYTES = BODY_FLOATS * 4;

/** Body-type codes in `BODY_TYPE` (match `RAPIER.RigidBodyType`). */
export const BODY_TYPE_CODE = {
    DYNAMIC: 0,
    FIXED: 1,
    KINEMATIC_POSITION: 2,
    KINEMATIC_VELOCITY: 3,
};

export const TRANSFORM_HEADER_U32 = 0;
export const TRANSFORM_HEADER_FRAME_TICK = 1;
export const TRANSFORM_HEADER_BODY_COUNT = 2;
export const TRANSFORM_HEADER_STEP_MS = 3;
export const TRANSFORM_HEADER_LAYOUT_VERSION = 4;
/** f32: wall-clock ms between steps at the current time scale (for interpolation). */
export const TRANSFORM_HEADER_STEP_INTERVAL_MS = 5;
export const TRANSFORM_HEADER_BYTES = 32;
export const TRANSFORM_SLOT_BYTES = MAX_BODIES * BODY_STRIDE_BYTES;
export const TRANSFORM_BUFFER_BYTES = TRANSFORM_HEADER_BYTES + 2 * TRANSFORM_SLOT_BYTES;

export const CMD_HEADER_HEAD = 0;
export const CMD_HEADER_TAIL = 1;
export const CMD_HEADER_CAPACITY = 2;
export const CMD_HEADER_BYTES = 12;
export const CMD_ENTRY_BYTES = 32;
export const CMD_RING_CAPACITY = 4096;
export const CMD_RING_BYTES = CMD_HEADER_BYTES + CMD_RING_CAPACITY * CMD_ENTRY_BYTES;

export const CMD_OP = {
    IMPULSE: 1,
    TORQUE: 2,
    KINEMATIC_POSE: 3,
    /** f0 = time scale; scales the worker clock's accumulated dt. */
    SET_TIME_SCALE: 4,
    STEP: 5,
    REMOVE_BODY: 6,
    SET_LINVEL: 7,
    SET_ANGVEL: 8,
    SET_GRAVITY_SCALE: 9,
    KINEMATIC_ROTATION: 10,
    SET_TRANSLATION: 11,
    SET_ROTATION: 12,
    /** f0 = 1 to enable continuous collision detection, 0 to disable. */
    SET_CCD: 13,
};

export const RAYCAST_STATUS = {
    IDLE: 0,
    PENDING: 1,
    READY: 2,
    ERROR: 3,
};

export const RAYCAST_HEADER_BYTES = 4;
export const RAYCAST_STATUS_INDEX = 0;
export const RAYCAST_HIT_INDEX = 1;
export const RAYCAST_TOI_INDEX = 2;
export const RAYCAST_POINT_INDEX = 3;
export const RAYCAST_NORMAL_INDEX = 6;
/** u32 body index, 0xffffffff when the collider has no tracked body. */
export const RAYCAST_BODY_INDEX = 9;
/** i32 `BODY_TYPE_CODE`, -1 when there is no body. */
export const RAYCAST_BODY_TYPE_INDEX = 10;
/** f64 index (byte 48) of the hit collider's handle. */
export const RAYCAST_COLLIDER_HANDLE_F64_INDEX = 6;
export const RAYCAST_RESULT_BYTES = 52;
export const RAYCAST_BUFFER_BYTES = RAYCAST_HEADER_BYTES + RAYCAST_RESULT_BYTES;

export const WORKER_MSG = {
    INIT_BUFFERS: 'INIT_BUFFERS',
    WORKER_READY: 'WORKER_READY',
    INIT_WORLD: 'INIT_WORLD',
    INIT_OK: 'INIT_OK',
    INIT_ERROR: 'INIT_ERROR',
    RESET_WORLD: 'RESET_WORLD',
    FRAME_READY: 'FRAME_READY',
    STEP: 'STEP',
    ADD_BODY: 'ADD_BODY',
    RAYCAST: 'RAYCAST',
    LOG: 'LOG',
};

export const DEFAULT_PHYSICS_HZ = 120;

/**
 * @param {number} [physicsHz]
 */
export function resolvePhysicsHz(physicsHz) {
    const hz = Number(physicsHz);
    if (hz === 60 || hz === 120) return hz;
    return DEFAULT_PHYSICS_HZ;
}

/**
 * @param {SharedArrayBuffer} sab
 */
export function createTransformViews(sab) {
    const u32 = new Uint32Array(sab, 0, TRANSFORM_HEADER_BYTES / 4);
    const f32 = new Float32Array(sab, 0, TRANSFORM_BUFFER_BYTES / 4);
    return { u32, f32, sab };
}

/**
 * @param {SharedArrayBuffer} sab
 */
export function createCommandViews(sab) {
    const u32 = new Uint32Array(sab, 0, CMD_RING_BYTES / 4);
    const f32 = new Float32Array(sab, 0, CMD_RING_BYTES / 4);
    u32[CMD_HEADER_CAPACITY] = CMD_RING_CAPACITY;
    return { u32, f32, sab };
}

/**
 * @param {SharedArrayBuffer} sab
 */
export function createRaycastViews(sab) {
    const i32 = new Int32Array(sab, 0, RAYCAST_BUFFER_BYTES / 4);
    const f32 = new Float32Array(sab, 0, RAYCAST_BUFFER_BYTES / 4);
    const u32 = new Uint32Array(sab, 0, RAYCAST_BUFFER_BYTES / 4);
    const f64 = new Float64Array(sab, 0, RAYCAST_BUFFER_BYTES / 8);
    return { i32, f32, u32, f64, sab };
}

/**
 * @param {Uint32Array} u32
 * @param {Float32Array} f32
 * @param {number} slot
 * @param {number} bodyIndex
 * @returns {{x:number,y:number,z:number,qx:number,qy:number,qz:number,qw:number}}
 */
export function readBodyTransform(u32, f32, slot, bodyIndex) {
    const baseFloat =
        TRANSFORM_HEADER_BYTES / 4 +
        slot * (TRANSFORM_SLOT_BYTES / 4) +
        bodyIndex * BODY_FLOATS;
    return {
        x: f32[baseFloat],
        y: f32[baseFloat + 1],
        z: f32[baseFloat + 2],
        qx: f32[baseFloat + 3],
        qy: f32[baseFloat + 4],
        qz: f32[baseFloat + 5],
        qw: f32[baseFloat + 6],
    };
}

/**
 * @param {number} slot
 * @param {number} bodyIndex
 * @returns {number} float offset of the body's record in `slot`
 */
export function bodyRecordOffset(slot, bodyIndex) {
    return TRANSFORM_HEADER_BYTES / 4 + slot * (TRANSFORM_SLOT_BYTES / 4) + bodyIndex * BODY_FLOATS;
}

/**
 * Velocity, mass and type half of a body record (layout v2).
 * @param {Float32Array} f32
 * @param {number} slot
 * @param {number} bodyIndex
 */
export function readBodyDynamics(f32, slot, bodyIndex) {
    const base = bodyRecordOffset(slot, bodyIndex);
    return {
        valid: (f32[base + BODY_VALID] ?? 0) > 0.5,
        linvel: {
            x: f32[base + BODY_LINVEL] ?? 0,
            y: f32[base + BODY_LINVEL + 1] ?? 0,
            z: f32[base + BODY_LINVEL + 2] ?? 0,
        },
        angvel: {
            x: f32[base + BODY_ANGVEL] ?? 0,
            y: f32[base + BODY_ANGVEL + 1] ?? 0,
            z: f32[base + BODY_ANGVEL + 2] ?? 0,
        },
        mass: f32[base + BODY_MASS] ?? 0,
        type: Math.round(f32[base + BODY_TYPE] ?? 0),
    };
}

/**
 * Blends two body transforms for render-time interpolation between physics
 * ticks. Rotation uses nlerp (shortest-path lerp + renormalize) rather than
 * full slerp — cheap, and accurate enough given how small the angular delta
 * between consecutive ticks is.
 * @param {{x:number,y:number,z:number,qx:number,qy:number,qz:number,qw:number}} prev
 * @param {{x:number,y:number,z:number,qx:number,qy:number,qz:number,qw:number}} curr
 * @param {number} alpha
 */
export function lerpBodyTransform(prev, curr, alpha) {
    const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const x = prev.x + (curr.x - prev.x) * t;
    const y = prev.y + (curr.y - prev.y) * t;
    const z = prev.z + (curr.z - prev.z) * t;

    let cx = curr.qx, cy = curr.qy, cz = curr.qz, cw = curr.qw;
    const dot = prev.qx * cx + prev.qy * cy + prev.qz * cz + prev.qw * cw;
    if (dot < 0) { cx = -cx; cy = -cy; cz = -cz; cw = -cw; }

    const qx = prev.qx + (cx - prev.qx) * t;
    const qy = prev.qy + (cy - prev.qy) * t;
    const qz = prev.qz + (cz - prev.qz) * t;
    const qw = prev.qw + (cw - prev.qw) * t;
    const len = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw) || 1;

    return { x, y, z, qx: qx / len, qy: qy / len, qz: qz / len, qw: qw / len };
}

/**
 * @param {Uint32Array} cmdU32
 * @param {Float32Array} cmdF32
 * @param {number} op
 * @param {number} bodyIndex
 * @param {number} f0
 * @param {number} [f1]
 * @param {number} [f2]
 * @param {number} [f3]
 * @returns {boolean}
 */
export function enqueueCommand(cmdU32, cmdF32, op, bodyIndex, f0, f1 = 0, f2 = 0, f3 = 0) {
    const capacity = cmdU32[CMD_HEADER_CAPACITY];
    const head = Atomics.load(cmdU32, CMD_HEADER_HEAD);
    const tail = Atomics.load(cmdU32, CMD_HEADER_TAIL);
    const nextHead = (head + 1) % capacity;
    if (nextHead === tail) {
        console.warn('[PhysicsWorker] command ring full');
        return false;
    }
    const entryIndex = (CMD_HEADER_BYTES / 4 + head * (CMD_ENTRY_BYTES / 4));
    cmdU32[entryIndex] = op;
    cmdU32[entryIndex + 1] = bodyIndex;
    cmdF32[entryIndex + 2] = f0;
    cmdF32[entryIndex + 3] = f1;
    cmdF32[entryIndex + 4] = f2;
    cmdF32[entryIndex + 5] = f3;
    Atomics.store(cmdU32, CMD_HEADER_HEAD, nextHead);
    return true;
}

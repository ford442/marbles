/** Shared layout for physics worker SharedArrayBuffers (main + worker). */

export const MAX_BODIES = 256;
export const BODY_FLOATS = 8;
export const BODY_STRIDE_BYTES = BODY_FLOATS * 4;

export const TRANSFORM_HEADER_U32 = 0;
export const TRANSFORM_HEADER_FRAME_TICK = 1;
export const TRANSFORM_HEADER_BODY_COUNT = 2;
export const TRANSFORM_HEADER_STEP_MS = 3;
export const TRANSFORM_HEADER_BYTES = 16;
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
    SET_TIMESTEP: 4,
    STEP: 5,
    REMOVE_BODY: 6,
    SET_LINVEL: 7,
    SET_ANGVEL: 8,
    SET_GRAVITY_SCALE: 9,
};

export const RAYCAST_STATUS = {
    IDLE: 0,
    PENDING: 1,
    READY: 2,
    ERROR: 3,
};

export const RAYCAST_HEADER_BYTES = 4;
export const RAYCAST_RESULT_BYTES = 36;
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
    return { i32, f32, sab };
}

/**
 * @param {Uint32Array} u32
 * @param {Float32Array} f32
 * @param {number} slot
 * @param {number} bodyIndex
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

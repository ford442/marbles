import { CMD_HEADER_BYTES, CMD_ENTRY_BYTES, CMD_HEADER_HEAD, CMD_HEADER_TAIL, CMD_OP } from './protocol.js';

/**
 * Apply one command-ring entry to a Rapier rigid body (shared by worker + unit tests).
 * @param {import('@dimforge/rapier3d-compat').RigidBody | null} body
 * @param {number} op
 * @param {number} f0
 * @param {number} f1
 * @param {number} f2
 * @param {number} f3
 * @param {import('@dimforge/rapier3d-compat').World | null} world
 * @param {{ timestep: number }} state
 * @returns {boolean} true if body was removed
 */
export function applyCommandOp(body, op, f0, f1, f2, f3, world, state) {
    if (op === CMD_OP.SET_TIMESTEP) {
        state.timestep = f0;
        if (world) world.timestep = f0;
        return false;
    }

    if (!body) return false;

    switch (op) {
        case CMD_OP.IMPULSE:
            body.applyImpulse({ x: f0, y: f1, z: f2 }, f3 !== 0);
            break;
        case CMD_OP.TORQUE:
            body.applyTorqueImpulse({ x: f0, y: f1, z: f2 }, f3 !== 0);
            break;
        case CMD_OP.KINEMATIC_POSE:
            body.setNextKinematicTranslation({ x: f0, y: f1, z: f2 });
            break;
        case CMD_OP.KINEMATIC_ROTATION:
            body.setNextKinematicRotation({ x: f0, y: f1, z: f2, w: f3 });
            break;
        case CMD_OP.SET_TRANSLATION:
            body.setTranslation({ x: f0, y: f1, z: f2 }, f3 !== 0);
            break;
        case CMD_OP.SET_ROTATION:
            body.setRotation({ x: f0, y: f1, z: f2, w: f3 }, true);
            break;
        case CMD_OP.SET_LINVEL:
            body.setLinvel({ x: f0, y: f1, z: f2 }, f3 !== 0);
            break;
        case CMD_OP.SET_ANGVEL:
            body.setAngvel({ x: f0, y: f1, z: f2 }, f3 !== 0);
            break;
        case CMD_OP.SET_GRAVITY_SCALE:
            body.setGravityScale(f0, f3 !== 0);
            break;
        case CMD_OP.REMOVE_BODY:
            return true;
        default:
            break;
    }
    return false;
}

/**
 * Drain the command ring until empty.
 * @param {Uint32Array} u32
 * @param {Float32Array} f32
 * @param {Array<import('@dimforge/rapier3d-compat').RigidBody | null>} bodies
 * @param {Set<number>} removedIndices
 * @param {import('@dimforge/rapier3d-compat').World} world
 * @param {{ timestep: number }} state
 */
export function drainCommandRing(u32, f32, bodies, removedIndices, world, state) {
    const capacity = u32[2];

    for (;;) {
        const tail = Atomics.load(u32, CMD_HEADER_TAIL);
        const head = Atomics.load(u32, CMD_HEADER_HEAD);
        if (tail === head) break;

        const entryIndex = CMD_HEADER_BYTES / 4 + tail * (CMD_ENTRY_BYTES / 4);
        const op = u32[entryIndex];
        const bodyIndex = u32[entryIndex + 1];
        const f0 = f32[entryIndex + 2];
        const f1 = f32[entryIndex + 3];
        const f2 = f32[entryIndex + 4];
        const f3 = f32[entryIndex + 5];

        const body = bodies[bodyIndex];
        if (op === CMD_OP.REMOVE_BODY) {
            if (body && !removedIndices.has(bodyIndex)) {
                world.removeRigidBody(body);
                bodies[bodyIndex] = null;
                removedIndices.add(bodyIndex);
            }
        } else if (op === CMD_OP.SET_TIMESTEP) {
            applyCommandOp(null, op, f0, f1, f2, f3, world, state);
        } else if (body && !removedIndices.has(bodyIndex)) {
            applyCommandOp(body, op, f0, f1, f2, f3, world, state);
        }

        Atomics.store(u32, CMD_HEADER_TAIL, (tail + 1) % capacity);
    }
}

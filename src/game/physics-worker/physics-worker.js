import RAPIER from '@dimforge/rapier3d-compat';
import {
    CMD_HEADER_HEAD,
    CMD_HEADER_TAIL,
    CMD_OP,
    TRANSFORM_HEADER_BODY_COUNT,
    TRANSFORM_HEADER_BYTES,
    TRANSFORM_HEADER_FRAME_TICK,
    TRANSFORM_HEADER_STEP_MS,
    TRANSFORM_HEADER_U32,
    TRANSFORM_SLOT_BYTES,
    WORKER_MSG,
    createCommandViews,
    createRaycastViews,
    createTransformViews,
    RAYCAST_STATUS,
} from './protocol.js';
import { buildWorldFromDescriptors, writeBodyTransforms } from './world-builder.js';
import { initMarblePhysicsWasm } from '../../wasm-bridge.js';

/** @type {ReturnType<typeof createTransformViews> | null} */
let transformViews = null;
/** @type {ReturnType<typeof createCommandViews> | null} */
let commandViews = null;
/** @type {ReturnType<typeof createRaycastViews> | null} */
let raycastViews = null;

/** @type {import('@dimforge/rapier3d-compat').World | null} */
let world = null;
/** @type {import('@dimforge/rapier3d-compat').RigidBody[]} */
let bodies = [];
/** @type {Set<number>} */
let removedIndices = new Set();

let physicsHz = 120;
let timestep = 1 / 120;
let frameTick = 0;
let writeSlot = 0;
let running = false;
let intervalId = null;

function publishTransforms(stepMs) {
    if (!transformViews || !bodies.length) return;
    const { u32, f32 } = transformViews;
    const slotOffsetFloats = TRANSFORM_HEADER_BYTES / 4 + writeSlot * (TRANSFORM_SLOT_BYTES / 4);
    writeBodyTransforms(bodies, f32, slotOffsetFloats);
    u32[TRANSFORM_HEADER_BODY_COUNT] = bodies.length;
    f32[TRANSFORM_HEADER_STEP_MS] = stepMs;
    u32[TRANSFORM_HEADER_FRAME_TICK] = frameTick;
    Atomics.store(u32, TRANSFORM_HEADER_U32, writeSlot);
    writeSlot = 1 - writeSlot;
}

function drainCommands() {
    if (!commandViews || !world) return;
    const { u32, f32 } = commandViews;

    while (true) {
        const tail = Atomics.load(u32, CMD_HEADER_TAIL);
        const head = Atomics.load(u32, CMD_HEADER_HEAD);
        if (tail === head) break;

        const entryIndex = CMD_HEADER_BYTES / 4 + tail * (32 / 4);
        const op = u32[entryIndex];
        const bodyIndex = u32[entryIndex + 1];
        const f0 = f32[entryIndex + 2];
        const f1 = f32[entryIndex + 3];
        const f2 = f32[entryIndex + 4];
        const f3 = f32[entryIndex + 5];

        const body = bodies[bodyIndex];
        if (body && !removedIndices.has(bodyIndex)) {
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
                case CMD_OP.SET_LINVEL:
                    body.setLinvel({ x: f0, y: f1, z: f2 }, f3 !== 0);
                    break;
                case CMD_OP.SET_ANGVEL:
                    body.setAngvel({ x: f0, y: f1, z: f2 }, f3 !== 0);
                    break;
                case CMD_OP.SET_GRAVITY_SCALE:
                    body.setGravityScale(f0, f3 !== 0);
                    break;
                case CMD_OP.SET_TIMESTEP:
                    timestep = f0;
                    if (world) world.timestep = timestep;
                    break;
                case CMD_OP.REMOVE_BODY:
                    if (bodies[bodyIndex]) {
                        world.removeRigidBody(bodies[bodyIndex]);
                        bodies[bodyIndex] = null;
                        removedIndices.add(bodyIndex);
                    }
                    break;
                default:
                    break;
            }
        }

        Atomics.store(u32, CMD_HEADER_TAIL, (tail + 1) % u32[2]);
    }
}

function runPhysicsStep() {
    if (!world || !running) return;
    drainCommands();
    const start = performance.now();
    world.timestep = timestep;
    world.step();
    frameTick += 1;
    publishTransforms(performance.now() - start);
    self.postMessage({ type: WORKER_MSG.FRAME_READY, frameTick });
}

function startLoop() {
    if (intervalId != null) return;
    intervalId = setInterval(runPhysicsStep, 1000 / physicsHz);
}

function stopLoop() {
    if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function resetWorldState() {
    stopLoop();
    world = null;
    bodies = [];
    removedIndices = new Set();
    frameTick = 0;
    writeSlot = 0;
}

function handleRaycastRequest(data) {
    if (!raycastViews || !world) return;
    const { i32, f32 } = raycastViews;
    try {
        const ray = data.ray;
        const maxDist = data.maxDist ?? 100;
        const hit = world.castRay(ray, maxDist, data.solid !== false);
        const resultBase = 1;
        if (hit) {
            f32[resultBase] = 1;
            f32[resultBase + 1] = hit.timeOfImpact;
            const p = ray.pointAt(hit.timeOfImpact);
            f32[resultBase + 2] = p.x;
            f32[resultBase + 3] = p.y;
            f32[resultBase + 4] = p.z;
            f32[resultBase + 5] = hit.normal?.x ?? 0;
            f32[resultBase + 6] = hit.normal?.y ?? 0;
            f32[resultBase + 7] = hit.normal?.z ?? 0;
        } else {
            f32[resultBase] = 0;
        }
        Atomics.store(i32, 0, RAYCAST_STATUS.READY);
    } catch {
        Atomics.store(i32, 0, RAYCAST_STATUS.ERROR);
    }
}

self.onmessage = async (event) => {
    const msg = event.data;
    try {
        switch (msg.type) {
            case WORKER_MSG.INIT_BUFFERS:
                transformViews = createTransformViews(msg.transformSab);
                commandViews = createCommandViews(msg.commandSab);
                raycastViews = createRaycastViews(msg.raycastSab);
                physicsHz = msg.physicsHz ?? 120;
                timestep = 1 / physicsHz;
                await RAPIER.init();
                initMarblePhysicsWasm().catch(() => {});
                self.postMessage({ type: WORKER_MSG.WORKER_READY });
                break;

            case WORKER_MSG.INIT_WORLD:
                resetWorldState();
                removedIndices = new Set();
                ({ world, bodies } = buildWorldFromDescriptors(msg.gravity, msg.descriptors || []));
                world.timestep = timestep;
                running = true;
                publishTransforms(0);
                startLoop();
                self.postMessage({ type: WORKER_MSG.INIT_OK, bodyCount: bodies.length });
                break;

            case WORKER_MSG.RESET_WORLD:
                resetWorldState();
                if (transformViews) {
                    transformViews.u32[TRANSFORM_HEADER_BODY_COUNT] = 0;
                }
                self.postMessage({ type: WORKER_MSG.INIT_OK, bodyCount: 0 });
                break;

            case WORKER_MSG.STEP:
                drainCommands();
                break;

            default:
                if (msg.type === 'RAYCAST') {
                    handleRaycastRequest(msg);
                }
                break;
        }
    } catch (err) {
        self.postMessage({
            type: WORKER_MSG.INIT_ERROR,
            message: err?.message || String(err),
        });
    }
};

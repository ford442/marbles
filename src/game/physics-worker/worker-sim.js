import RAPIER from '@dimforge/rapier3d-compat';
import {
    SNAPSHOT_LAYOUT_VERSION,
    TRANSFORM_HEADER_BODY_COUNT,
    TRANSFORM_HEADER_BYTES,
    TRANSFORM_HEADER_FRAME_TICK,
    TRANSFORM_HEADER_LAYOUT_VERSION,
    TRANSFORM_HEADER_STEP_INTERVAL_MS,
    TRANSFORM_HEADER_STEP_MS,
    TRANSFORM_HEADER_U32,
    TRANSFORM_SLOT_BYTES,
    WORKER_MSG,
    createCommandViews,
    createRaycastViews,
    createTransformViews,
    RAYCAST_STATUS,
    RAYCAST_HIT_INDEX,
    RAYCAST_TOI_INDEX,
    RAYCAST_POINT_INDEX,
    RAYCAST_NORMAL_INDEX,
    RAYCAST_BODY_INDEX,
    RAYCAST_BODY_TYPE_INDEX,
    RAYCAST_COLLIDER_HANDLE_F64_INDEX,
    resolvePhysicsHz,
} from './protocol.js';
import {
    buildWorldFromDescriptors,
    getBodySlotCount,
    insertBodyAtIndex,
    writeBodyTransforms,
} from './world-builder.js';
import { drainCommandRing } from './command-drain.js';
import { FixedStepClock } from '../systems/fixed-step-clock.ts';
import { RapierPhysicsQueries } from '../systems/physics-queries.ts';

const NO_BODY = 0xffffffff;

/**
 * Physics-worker state machine, independent of the worker global so it can be
 * driven in-process by unit tests. `physics-worker.js` wires it to `self`.
 *
 * The sim owns a `FixedStepClock`: each `tick()` feeds elapsed wall time
 * (scaled by `SET_TIME_SCALE`) into the accumulator and runs whole fixed
 * steps, the same contract as the main-thread loop.
 *
 * @param {object} io
 * @param {(msg: object) => void} io.post
 * @param {() => number} [io.now] wall clock in ms
 * @param {(fn: () => void, ms: number) => unknown} [io.setInterval]
 * @param {(id: unknown) => void} [io.clearInterval]
 */
export function createWorkerSim({
    post,
    now = () => performance.now(),
    setInterval: startTimer = (fn, ms) => setInterval(fn, ms),
    clearInterval: stopTimer = (id) => clearInterval(/** @type {any} */ (id)),
}) {
    /** @type {ReturnType<typeof createTransformViews> | null} */
    let transformViews = null;
    /** @type {ReturnType<typeof createCommandViews> | null} */
    let commandViews = null;
    /** @type {ReturnType<typeof createRaycastViews> | null} */
    let raycastViews = null;

    /** @type {import('@dimforge/rapier3d-compat').World | null} */
    let world = null;
    /** @type {Array<import('@dimforge/rapier3d-compat').RigidBody | null>} */
    let bodies = [];
    /** @type {Set<number>} */
    let removedIndices = new Set();
    /** @type {Map<number, number>} Rapier body handle → stable body index */
    let indexByHandle = new Map();

    let physicsHz = 120;
    let clock = new FixedStepClock({ step: 1 / physicsHz });
    let frameTick = 0;
    let writeSlot = 0;
    let running = false;
    /** @type {unknown} */
    let intervalId = null;
    let lastTickAt = 0;

    const queries = new RapierPhysicsQueries(() => world);

    function stepIntervalMs() {
        const scale = clock.timeScale > 0 ? clock.timeScale : 0;
        return scale > 0 ? (clock.step * 1000) / scale : 0;
    }

    function publishTransforms(stepMs) {
        if (!transformViews) return;
        const { u32, f32 } = transformViews;
        const slotOffsetFloats = TRANSFORM_HEADER_BYTES / 4 + writeSlot * (TRANSFORM_SLOT_BYTES / 4);
        writeBodyTransforms(bodies, f32, slotOffsetFloats);
        u32[TRANSFORM_HEADER_BODY_COUNT] = getBodySlotCount(bodies);
        f32[TRANSFORM_HEADER_STEP_MS] = stepMs;
        f32[TRANSFORM_HEADER_STEP_INTERVAL_MS] = stepIntervalMs();
        u32[TRANSFORM_HEADER_FRAME_TICK] = frameTick;
        Atomics.store(u32, TRANSFORM_HEADER_U32, writeSlot);
        writeSlot = 1 - writeSlot;
    }

    function drainCommands() {
        if (!commandViews || !world) return;
        drainCommandRing(commandViews.u32, commandViews.f32, bodies, removedIndices, world, clock);
    }

    function rebuildHandleIndex() {
        indexByHandle = new Map();
        bodies.forEach((body, i) => {
            if (body) indexByHandle.set(body.handle, i);
        });
    }

    /** Advance the fixed-step clock by elapsed wall time and run whole steps. */
    function tick() {
        if (!world || !running) return;
        const t = now();
        const frameDt = lastTickAt ? (t - lastTickAt) / 1000 : clock.step;
        lastTickAt = t;

        drainCommands();
        const steps = clock.advance(frameDt);
        if (steps === 0) {
            // Keep the published interval current so the main thread's
            // interpolation tracks slow-mo changes between steps.
            if (transformViews) transformViews.f32[TRANSFORM_HEADER_STEP_INTERVAL_MS] = stepIntervalMs();
            return;
        }

        const start = now();
        for (let i = 0; i < steps; i++) {
            world.timestep = clock.step;
            world.step();
        }
        frameTick += 1;
        publishTransforms(now() - start);
        post({ type: WORKER_MSG.FRAME_READY, frameTick });
    }

    function startLoop() {
        if (intervalId != null) return;
        lastTickAt = now();
        intervalId = startTimer(tick, 1000 / physicsHz);
    }

    function stopLoop() {
        if (intervalId != null) {
            stopTimer(intervalId);
            intervalId = null;
        }
    }

    function resetWorldState() {
        stopLoop();
        running = false;
        world = null;
        bodies = [];
        removedIndices = new Set();
        indexByHandle = new Map();
        frameTick = 0;
        writeSlot = 0;
        clock.reset();
    }

    /** @param {any} data */
    function handleRaycastRequest(data) {
        if (!raycastViews) return;
        const { i32, f32, u32, f64 } = raycastViews;
        try {
            const excludeIndex = data.excludeBodyIndex;
            const hit = world ? queries.castRay(data.origin, data.dir, data.maxToi ?? 100, {
                solid: data.solid !== false,
                groups: data.groups ?? undefined,
                excludeSensors: data.excludeSensors === true,
                excludeBody: excludeIndex != null ? bodies[excludeIndex] : null,
            }) : null;

            if (hit) {
                f32[RAYCAST_HIT_INDEX] = 1;
                f32[RAYCAST_TOI_INDEX] = hit.toi;
                f32[RAYCAST_POINT_INDEX] = hit.point.x;
                f32[RAYCAST_POINT_INDEX + 1] = hit.point.y;
                f32[RAYCAST_POINT_INDEX + 2] = hit.point.z;
                f32[RAYCAST_NORMAL_INDEX] = hit.normal?.x ?? 0;
                f32[RAYCAST_NORMAL_INDEX + 1] = hit.normal?.y ?? 0;
                f32[RAYCAST_NORMAL_INDEX + 2] = hit.normal?.z ?? 0;
                const idx = hit.bodyHandle != null ? indexByHandle.get(hit.bodyHandle) : undefined;
                u32[RAYCAST_BODY_INDEX] = idx ?? NO_BODY;
                const parent = /** @type {import('@dimforge/rapier3d-compat').RigidBody | null} */ (hit.body);
                i32[RAYCAST_BODY_TYPE_INDEX] = parent ? parent.bodyType() : -1;
                f64[RAYCAST_COLLIDER_HANDLE_F64_INDEX] = hit.colliderHandle;
            } else {
                f32[RAYCAST_HIT_INDEX] = 0;
                u32[RAYCAST_BODY_INDEX] = NO_BODY;
                i32[RAYCAST_BODY_TYPE_INDEX] = -1;
            }
            Atomics.store(i32, 0, RAYCAST_STATUS.READY);
        } catch (err) {
            Atomics.store(i32, 0, RAYCAST_STATUS.ERROR);
            post({ type: WORKER_MSG.LOG, level: 'error', message: `raycast failed: ${err?.message || err}` });
        }
    }

    /** @param {any} msg */
    async function handleMessage(msg) {
        try {
            switch (msg.type) {
                case WORKER_MSG.INIT_BUFFERS:
                    transformViews = createTransformViews(msg.transformSab);
                    commandViews = createCommandViews(msg.commandSab);
                    raycastViews = createRaycastViews(msg.raycastSab);
                    physicsHz = resolvePhysicsHz(msg.physicsHz);
                    clock = new FixedStepClock({ step: 1 / physicsHz });
                    transformViews.u32[TRANSFORM_HEADER_LAYOUT_VERSION] = SNAPSHOT_LAYOUT_VERSION;
                    await RAPIER.init();
                    post({ type: WORKER_MSG.WORKER_READY, layoutVersion: SNAPSHOT_LAYOUT_VERSION });
                    break;

                case WORKER_MSG.INIT_WORLD:
                    resetWorldState();
                    ({ world, bodies } = buildWorldFromDescriptors(msg.gravity, msg.descriptors || []));
                    rebuildHandleIndex();
                    running = true;
                    // Publish twice so both double-buffer slots start with valid
                    // data — otherwise render-side interpolation would blend
                    // against the other slot's stale/zeroed memory on the very
                    // first frame.
                    publishTransforms(0);
                    publishTransforms(0);
                    startLoop();
                    post({ type: WORKER_MSG.INIT_OK, bodyCount: bodies.length });
                    break;

                case WORKER_MSG.ADD_BODY: {
                    if (!world) break;
                    const body = insertBodyAtIndex(world, bodies, msg.descriptor, msg.bodyIndex);
                    indexByHandle.set(body.handle, msg.bodyIndex);
                    removedIndices.delete(msg.bodyIndex);
                    // Seed both slots (see INIT_WORLD) so the new body index has
                    // valid interpolation data on both sides immediately.
                    publishTransforms(0);
                    publishTransforms(0);
                    break;
                }

                case WORKER_MSG.RESET_WORLD:
                    resetWorldState();
                    if (transformViews) {
                        transformViews.u32[TRANSFORM_HEADER_BODY_COUNT] = 0;
                    }
                    post({ type: WORKER_MSG.INIT_OK, bodyCount: 0 });
                    break;

                case WORKER_MSG.STEP:
                    drainCommands();
                    break;

                case WORKER_MSG.RAYCAST:
                    handleRaycastRequest(msg);
                    break;

                default:
                    break;
            }
        } catch (err) {
            post({
                type: WORKER_MSG.INIT_ERROR,
                message: err?.message || String(err),
            });
        }
    }

    return {
        handleMessage,
        tick,
        /** Test hook: the current Rapier world. */
        getWorld: () => world,
        getClock: () => clock,
    };
}

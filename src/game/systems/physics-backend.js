import {
    CMD_OP,
    TRANSFORM_BUFFER_BYTES,
    CMD_RING_BYTES,
    RAYCAST_BUFFER_BYTES,
    TRANSFORM_HEADER_STEP_MS,
    TRANSFORM_HEADER_U32,
    WORKER_MSG,
    createCommandViews,
    createRaycastViews,
    createTransformViews,
    enqueueCommand,
    readBodyTransform,
    RAYCAST_STATUS,
} from '../physics-worker/protocol.js';
import { createProxyRigidBody, createProxyWorld } from '../physics-worker/proxy-rigid-body.js';
import {
    resolvePhysicsHzFromSearch,
    shouldUsePhysicsWorker,
} from './physics-backend-pure.js';

export { shouldUsePhysicsWorker, resolvePhysicsHzFromSearch, WORKER_SPIKE_LEVEL_ID } from './physics-backend-pure.js';

/**
 * Main-thread Rapier backend (default).
 */
export class MainThreadPhysicsBackend {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.mode = 'main';
        this.timestep = 1 / 60;
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
    }

    isWorkerMode() {
        return false;
    }

    getMode() {
        return 'main';
    }

    /** @param {{ x: number, y: number, z: number }} gravity */
    init(gravity) {
        this.gravity = gravity;
    }

    beginLevel() {
        // no-op
    }

    async commitWorldBuild() {
        // no-op
    }

    resetWorld() {
        // no-op
    }

    step() {
        const start = performance.now();
        this.game.physicsWorld.step();
        this.lastStepMs = performance.now() - start;
        this.lastWaitMs = 0;
    }

    setTimestep(value) {
        this.timestep = value;
        if (this.game.world) {
            this.game.world.timestep = value;
        }
    }

    /**
     * @param {object} desc
     */
    registerBody(desc) {
        return null;
    }

    removeRigidBody(body) {
        const g = this.game;
        if (g.world && body) {
            g.world.removeRigidBody(body);
        }
    }

    destroy() {
        // no-op
    }
}

/**
 * Worker-thread Rapier backend (tutorial spike).
 */
export class WorkerPhysicsBackend {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
        this.mode = 'worker';
        this.timestep = 1 / 120;
        this.physicsHz = 120;
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
        this._ready = false;
        this._active = false;
        this._descriptors = [];
        this._proxies = new Map();
        this._linvelCache = new Map();
        this._gravityScaleCache = new Map();
        this._pendingFrame = null;
        this._initPromise = null;
    }

    isWorkerMode() {
        return this._active && this._ready;
    }

    getMode() {
        return this.isWorkerMode() ? 'worker' : 'main';
    }

    /** @param {{ x: number, y: number, z: number }} gravity */
    async init(gravity) {
        this.gravity = gravity;
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error('SharedArrayBuffer unavailable');
        }

        this.physicsHz = resolvePhysicsHzFromSearch(
            typeof window !== 'undefined' ? window.location.search : '',
        );
        this.timestep = 1 / this.physicsHz;

        this.transformSab = new SharedArrayBuffer(TRANSFORM_BUFFER_BYTES);
        this.commandSab = new SharedArrayBuffer(CMD_RING_BYTES);
        this.raycastSab = new SharedArrayBuffer(RAYCAST_BUFFER_BYTES);

        this.transformViews = createTransformViews(this.transformSab);
        this.commandViews = createCommandViews(this.commandSab);
        this.raycastViews = createRaycastViews(this.raycastSab);

        this.worker = new Worker(
            new URL('../physics-worker/physics-worker.js', import.meta.url),
            { type: 'module' },
        );

        this._initPromise = new Promise((resolve, reject) => {
            const onMessage = (event) => {
                const msg = event.data;
                if (msg.type === WORKER_MSG.WORKER_READY) {
                    this._ready = true;
                    this.worker.removeEventListener('message', onMessage);
                    resolve(true);
                } else if (msg.type === WORKER_MSG.INIT_ERROR) {
                    this.worker.removeEventListener('message', onMessage);
                    reject(new Error(msg.message || 'Worker init failed'));
                }
            };
            this.worker.addEventListener('message', onMessage);
            this.worker.onerror = (err) => reject(err);
        });

        this.worker.postMessage({
            type: WORKER_MSG.INIT_BUFFERS,
            transformSab: this.transformSab,
            commandSab: this.commandSab,
            raycastSab: this.raycastSab,
            physicsHz: this.physicsHz,
        });

        await this._initPromise;

        this.worker.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === WORKER_MSG.FRAME_READY && this._pendingFrame) {
                this._pendingFrame.resolve(msg.frameTick);
                this._pendingFrame = null;
            }
        });
    }

    beginLevel(levelId) {
        this._descriptors = [];
        this._proxies.clear();
        this._linvelCache.clear();
        this._gravityScaleCache.clear();
        this._nextBodyIndex = 0;
        this._active = true;
        this.game.world = createProxyWorld(this);
    }

    /**
     * @param {object} desc
     */
    registerBody(desc) {
        const bodyIndex = this._nextBodyIndex++;
        const stored = {
            ...desc,
            translation: [...(desc.translation || [0, 0, 0])],
            rotation: [...(desc.rotation || [0, 0, 0, 1])],
        };
        this._descriptors.push(stored);
        if (desc.gravityScale != null) {
            this._gravityScaleCache.set(bodyIndex, desc.gravityScale);
        } else {
            this._gravityScaleCache.set(bodyIndex, 1);
        }
        this._linvelCache.set(bodyIndex, { x: 0, y: 0, z: 0 });
        return createProxyRigidBody(this, bodyIndex);
    }

    registerProxy(bodyIndex, proxy) {
        this._proxies.set(bodyIndex, proxy);
    }

    async commitWorldBuild() {
        if (!this._active || !this._ready) return false;

        return new Promise((resolve, reject) => {
            const onMessage = (event) => {
                const msg = event.data;
                if (msg.type === WORKER_MSG.INIT_OK) {
                    this.worker.removeEventListener('message', onMessage);
                    resolve(true);
                } else if (msg.type === WORKER_MSG.INIT_ERROR) {
                    this.worker.removeEventListener('message', onMessage);
                    reject(new Error(msg.message || 'World build failed'));
                }
            };
            this.worker.addEventListener('message', onMessage);
            this.worker.postMessage({
                type: WORKER_MSG.INIT_WORLD,
                gravity: this.gravity,
                descriptors: this._descriptors,
            });
        });
    }

    resetWorld() {
        if (this.worker && this._ready) {
            this.worker.postMessage({ type: WORKER_MSG.RESET_WORLD });
        }
        this._descriptors = [];
        this._proxies.clear();
        this._active = false;
    }

    step() {
        if (!this.isWorkerMode()) return;

        const waitStart = performance.now();
        this.worker.postMessage({ type: WORKER_MSG.STEP });

        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        this.lastStepMs = this.transformViews.f32[TRANSFORM_HEADER_STEP_MS];
        this.lastWaitMs = performance.now() - waitStart;
    }

    setTimestep(value) {
        this.timestep = value;
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_TIMESTEP,
            0,
            value,
        );
    }

    getTranslation(bodyIndex) {
        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        const t = readBodyTransform(this.transformViews.u32, this.transformViews.f32, slot, bodyIndex);
        return { x: t.x, y: t.y, z: t.z };
    }

    getRotation(bodyIndex) {
        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        const t = readBodyTransform(this.transformViews.u32, this.transformViews.f32, slot, bodyIndex);
        return { x: t.qx, y: t.qy, z: t.qz, w: t.qw };
    }

    getLinvel(bodyIndex) {
        return this._linvelCache.get(bodyIndex) || { x: 0, y: 0, z: 0 };
    }

    getAngvel() {
        return { x: 0, y: 0, z: 0 };
    }

    getGravityScale(bodyIndex) {
        return this._gravityScaleCache.get(bodyIndex) ?? 1;
    }

    queueImpulse(bodyIndex, force, wake = true) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.IMPULSE,
            bodyIndex,
            force.x,
            force.y,
            force.z,
            wake ? 1 : 0,
        );
        const lv = this._linvelCache.get(bodyIndex) || { x: 0, y: 0, z: 0 };
        lv.x += force.x;
        lv.y += force.y;
        lv.z += force.z;
        this._linvelCache.set(bodyIndex, lv);
    }

    queueTorque(bodyIndex, torque, wake = true) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.TORQUE,
            bodyIndex,
            torque.x,
            torque.y,
            torque.z,
            wake ? 1 : 0,
        );
    }

    queueSetLinvel(bodyIndex, v, wake = true) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_LINVEL,
            bodyIndex,
            v.x,
            v.y,
            v.z,
            wake ? 1 : 0,
        );
        this._linvelCache.set(bodyIndex, { x: v.x, y: v.y, z: v.z });
    }

    queueSetAngvel(bodyIndex, v, wake = true) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_ANGVEL,
            bodyIndex,
            v.x,
            v.y,
            v.z,
            wake ? 1 : 0,
        );
    }

    queueSetGravityScale(bodyIndex, scale, wake = true) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_GRAVITY_SCALE,
            bodyIndex,
            scale,
            0,
            0,
            wake ? 1 : 0,
        );
        this._gravityScaleCache.set(bodyIndex, scale);
    }

    queueKinematicTranslation(bodyIndex, t) {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.KINEMATIC_POSE,
            bodyIndex,
            t.x,
            t.y,
            t.z,
            0,
        );
    }

    queueKinematicRotation(bodyIndex, r) {
        void bodyIndex;
        void r;
    }

    removeRigidBody(body) {
        const index = body?.handle ?? body?._bodyIndex;
        if (index == null) return;
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.REMOVE_BODY,
            index,
            0,
        );
        this._proxies.delete(index);
    }

    castRay(spec) {
        if (!this.worker || !this.isWorkerMode()) return null;
        const { i32, f32 } = this.raycastViews;
        Atomics.store(i32, 0, RAYCAST_STATUS.PENDING);
        this.worker.postMessage({
            type: 'RAYCAST',
            ray: spec.ray,
            maxDist: spec.maxDist,
            solid: spec.solid,
        });

        const deadline = performance.now() + 8;
        while (Atomics.load(i32, 0) === RAYCAST_STATUS.PENDING && performance.now() < deadline) {
            // spin wait — spike only
        }
        if (Atomics.load(i32, 0) !== RAYCAST_STATUS.READY) return null;
        if (f32[1] < 0.5) return null;
        return {
            timeOfImpact: f32[2],
            normal: { x: f32[6], y: f32[7], z: f32[8] },
        };
    }

    destroy() {
        this.resetWorld();
        this.worker?.terminate();
        this.worker = null;
        this._ready = false;
    }
}

/**
 * @param {object} game
 * @param {object} [options]
 */
export async function createPhysicsBackend(game, options = {}) {
    const mainBackend = new MainThreadPhysicsBackend(game);
    game.mainPhysicsBackend = mainBackend;

    const search = typeof window !== 'undefined' ? window.location.search : '';
    const wantWorker = shouldUsePhysicsWorker({
        search,
        crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        multiplayerMode: game.multiplayerMode,
        hostAuthorityMode: game.hostAuthorityMode,
        editorMode: options.editorMode ?? false,
        levelId: options.levelId ?? null,
    });

    if (!wantWorker) {
        game.physicsBackend = mainBackend;
        return mainBackend;
    }

    try {
        const workerBackend = new WorkerPhysicsBackend(game);
        await workerBackend.init(options.gravity || { x: 0, y: -9.81, z: 0 });
        game.workerPhysicsBackend = workerBackend;
        game.physicsBackend = mainBackend;
        console.info('[Physics] Worker infrastructure ready (activates on tutorial + ?physicsWorker=1)');
        return mainBackend;
    } catch (err) {
        console.warn('[Physics] Worker init failed, using main thread:', err?.message || err);
        game.physicsBackend = mainBackend;
        return mainBackend;
    }
}

/**
 * Select backend for a level load.
 * @param {object} game
 * @param {string} levelId
 */
export async function activatePhysicsBackendForLevel(game, levelId) {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const useWorker = shouldUsePhysicsWorker({
        search,
        crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        multiplayerMode: game.multiplayerMode,
        hostAuthorityMode: game.hostAuthorityMode,
        editorMode: false,
        levelId,
    });

    if (useWorker && game.workerPhysicsBackend?._ready) {
        game.physicsBackend = game.workerPhysicsBackend;
        game.workerPhysicsBackend.beginLevel(levelId);
        return 'worker';
    }

    game.physicsBackend = game.mainPhysicsBackend || new MainThreadPhysicsBackend(game);
    game.physicsWorld.init(game.physicsGravity || { x: 0, y: -9.81, z: 0 });
    return 'main';
}

/**
 * @param {object} game
 */
export function getRapierBackendMode(game) {
    return game.physicsBackend?.getMode?.() || 'main';
}

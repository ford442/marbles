import {
    CMD_OP,
    TRANSFORM_BUFFER_BYTES,
    CMD_RING_BYTES,
    RAYCAST_BUFFER_BYTES,
    TRANSFORM_HEADER_FRAME_TICK,
    TRANSFORM_HEADER_STEP_MS,
    TRANSFORM_HEADER_U32,
    WORKER_MSG,
    createCommandViews,
    createRaycastViews,
    createTransformViews,
    enqueueCommand,
    lerpBodyTransform,
    readBodyTransform,
    RAYCAST_STATUS,
    RAYCAST_HIT_INDEX,
    RAYCAST_TOI_INDEX,
    RAYCAST_POINT_INDEX,
    RAYCAST_NORMAL_INDEX,
    RAYCAST_BODY_INDEX,
} from '../physics-worker/protocol.js';
import { createProxyRigidBody, createProxyWorld } from '../physics-worker/proxy-rigid-body.js';
import {
    resolvePhysicsHzFromSearch,
    shouldUsePhysicsWorker,
} from './physics-backend-pure.ts';

import type { Vec3, Quat } from '../../types/geometry.ts';

export { shouldUsePhysicsWorker, resolvePhysicsHzFromSearch, WORKER_SPIKE_LEVEL_ID } from './physics-backend-pure.ts';
export { MANIFEST_LEVEL_IDS, isManifestLevel } from './manifest-level-ids.js';

/** Rigid-body description handed to `registerBody` (also the worker's `ADD_BODY` payload). */
export interface BodyDescriptor {
    type?: string;
    translation?: readonly number[];
    rotation?: readonly number[];
    linvel?: readonly number[];
    gravityScale?: number | null;
    collider?: unknown;
    [key: string]: unknown;
}

/** Shape shared by both backends; the game holds one as `game.physicsBackend`. */
export interface PhysicsBackend {
    isWorkerMode(): boolean;
    getMode(): 'main' | 'worker';
    beginLevel(levelId?: string): void;
    commitWorldBuild(): Promise<unknown>;
    resetWorld(): void;
    step(): void;
    setTimestep(value: number): void;
    removeRigidBody(body: unknown): void;
    destroy(): void;
}

/** The slice of the game runtime the physics backends read and write. */
export interface PhysicsBackendHost {
    /** Rapier world on the main thread, or the worker proxy while a worker level is active. */
    world?: { timestep: number; removeRigidBody(body: unknown): void } | null;
    physicsWorld: { step(): void; init(gravity: Vec3): unknown };
    physicsGravity?: Vec3;
    physicsBackend?: PhysicsBackend | null;
    mainPhysicsBackend?: MainThreadPhysicsBackend;
    workerPhysicsBackend?: WorkerPhysicsBackend | null;
    multiplayerMode?: boolean;
    hostAuthorityMode?: boolean;
}

export interface CreatePhysicsBackendOptions {
    editorMode?: boolean;
    levelId?: string | null;
    gravity?: Vec3;
}

/** Ray query forwarded to the physics worker. */
export interface WorkerRaycastSpec {
    ray: unknown;
    maxDist: number;
    solid: boolean;
    filterExcludeRigidBody?: { handle?: number; _bodyIndex?: number } | null;
}

/**
 * Main-thread Rapier backend (default).
 */
export class MainThreadPhysicsBackend implements PhysicsBackend {
    game: PhysicsBackendHost;
    mode: 'main';
    timestep: number;
    lastStepMs: number;
    lastWaitMs: number;
    gravity: Vec3 | undefined;

    constructor(game: PhysicsBackendHost) {
        this.game = game;
        this.gravity = undefined;
        this.mode = 'main';
        this.timestep = 1 / 60;
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
    }

    isWorkerMode(): boolean {
        return false;
    }

    getMode(): 'main' {
        return 'main';
    }

    init(gravity: Vec3): void {
        this.gravity = gravity;
    }

    beginLevel(): void {
        // no-op
    }

    async commitWorldBuild(): Promise<void> {
        // no-op
    }

    resetWorld(): void {
        // no-op
    }

    step(): void {
        const start = performance.now();
        this.game.physicsWorld.step();
        this.lastStepMs = performance.now() - start;
        this.lastWaitMs = 0;
    }

    setTimestep(value: number): void {
        this.timestep = value;
        if (this.game.world) {
            this.game.world.timestep = value;
        }
    }

    /** Main-thread bodies are created directly in Rapier; nothing to register. */
    registerBody(_desc?: BodyDescriptor): null {
        return null;
    }

    removeRigidBody(body: unknown): void {
        const g = this.game;
        if (g.world && body) {
            g.world.removeRigidBody(body);
        }
    }

    destroy(): void {
        // no-op
    }
}

/**
 * Worker-thread Rapier backend (tutorial spike).
 */
export class WorkerPhysicsBackend implements PhysicsBackend {
    game: PhysicsBackendHost;
    mode: 'worker';
    timestep: number;
    physicsHz: number;
    lastStepMs: number;
    lastWaitMs: number;
    gravity: Vec3 | undefined;
    _ready: boolean;
    _active: boolean;
    _descriptors: BodyDescriptor[];
    _descriptorSlots: (BodyDescriptor | null)[];
    _proxies: Map<number, unknown>;
    _linvelCache: Map<number, { x: number; y: number; z: number }>;
    _gravityScaleCache: Map<number, number>;
    _pendingFrame: { resolve(frameTick: number): void } | null;
    _initPromise: Promise<unknown> | null;
    _worldCommitted: boolean;
    _pendingBodies: Map<number, BodyDescriptor>;
    _lastTick: number;
    _lastTickAt: number;
    _nextBodyIndex: number;
    // Created by init(); the worker path is only entered once `_ready` is true.
    worker: Worker | null;
    transformSab!: SharedArrayBuffer;
    commandSab!: SharedArrayBuffer;
    raycastSab!: SharedArrayBuffer;
    transformViews!: ReturnType<typeof createTransformViews>;
    commandViews!: ReturnType<typeof createCommandViews>;
    raycastViews!: ReturnType<typeof createRaycastViews>;

    constructor(game: PhysicsBackendHost) {
        this.game = game;
        this.gravity = undefined;
        this.worker = null;
        this._nextBodyIndex = 0;
        this.mode = 'worker';
        this.timestep = 1 / 120;
        this.physicsHz = 120;
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
        this._ready = false;
        this._active = false;
        this._descriptors = [];
        this._descriptorSlots = [];
        this._proxies = new Map();
        this._linvelCache = new Map();
        this._gravityScaleCache = new Map();
        this._pendingFrame = null;
        this._initPromise = null;
        this._worldCommitted = false;
        this._pendingBodies = new Map();
        this._lastTick = -1;
        this._lastTickAt = 0;
    }

    isWorkerMode(): boolean {
        return this._active && this._ready;
    }

    /** The physics worker; only valid between `init()` and `destroy()`. */
    private _requireWorker(): Worker {
        if (!this.worker) throw new Error('[PhysicsWorker] worker not initialized');
        return this.worker;
    }

    getMode(): 'main' | 'worker' {
        return this.isWorkerMode() ? 'worker' : 'main';
    }

    async init(gravity: Vec3): Promise<void> {
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

        const worker = new Worker(
            new URL('../physics-worker/physics-worker.js', import.meta.url),
            { type: 'module' },
        );
        this.worker = worker;

        this._initPromise = new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === WORKER_MSG.WORKER_READY) {
                    this._ready = true;
                    worker.removeEventListener('message', onMessage);
                    resolve(true);
                } else if (msg.type === WORKER_MSG.INIT_ERROR) {
                    worker.removeEventListener('message', onMessage);
                    reject(new Error(msg.message || 'Worker init failed'));
                }
            };
            worker.addEventListener('message', onMessage);
            worker.onerror = (err) => reject(err);
        });

        worker.postMessage({
            type: WORKER_MSG.INIT_BUFFERS,
            transformSab: this.transformSab,
            commandSab: this.commandSab,
            raycastSab: this.raycastSab,
            physicsHz: this.physicsHz,
        });

        await this._initPromise;

        worker.addEventListener('message', (event: MessageEvent) => {
            const msg = event.data;
            if (msg.type === WORKER_MSG.FRAME_READY && this._pendingFrame) {
                this._pendingFrame.resolve(msg.frameTick);
                this._pendingFrame = null;
            }
        });
    }

    beginLevel(_levelId?: string): void {
        this._descriptors = [];
        this._descriptorSlots = [];
        this._proxies.clear();
        this._linvelCache.clear();
        this._gravityScaleCache.clear();
        this._pendingBodies.clear();
        this._nextBodyIndex = 0;
        this._worldCommitted = false;
        this._active = true;
        this.game.world = createProxyWorld(this);
    }

    reserveBodyIndex(): number {
        return this._nextBodyIndex++;
    }

    /**
     * @param {number} bodyIndex
     * @param {object} stored
     */
    _storeDescriptorSlot(bodyIndex: number, stored: BodyDescriptor): void {
        while (this._descriptorSlots.length <= bodyIndex) {
            this._descriptorSlots.push(null);
        }
        this._descriptorSlots[bodyIndex] = stored;
    }

    /**
     * @param {number} bodyIndex
     * @param {object} desc
     */
    finalizeBodyDescriptor(bodyIndex: number, desc: BodyDescriptor): void {
        const stored = {
            ...desc,
            translation: [...(desc.translation || [0, 0, 0])],
            rotation: [...(desc.rotation || [0, 0, 0, 1])],
        };
        if (desc.gravityScale != null) {
            this._gravityScaleCache.set(bodyIndex, desc.gravityScale);
        } else {
            this._gravityScaleCache.set(bodyIndex, 1);
        }
        if (desc.linvel) {
            this._linvelCache.set(bodyIndex, {
                x: desc.linvel[0] ?? 0,
                y: desc.linvel[1] ?? 0,
                z: desc.linvel[2] ?? 0,
            });
        } else {
            this._linvelCache.set(bodyIndex, { x: 0, y: 0, z: 0 });
        }

        if (!this._worldCommitted) {
            this._storeDescriptorSlot(bodyIndex, stored);
            return;
        }

        this._requireWorker().postMessage({
            type: WORKER_MSG.ADD_BODY,
            bodyIndex,
            descriptor: stored,
        });
    }

    /**
     * @param {object} desc
     */
    registerBody(desc: BodyDescriptor): unknown {
        const bodyIndex = this.reserveBodyIndex();
        const stored = {
            ...desc,
            translation: [...(desc.translation || [0, 0, 0])],
            rotation: [...(desc.rotation || [0, 0, 0, 1])],
        };
        if (!this._worldCommitted) {
            this._storeDescriptorSlot(bodyIndex, stored);
        } else {
            this._requireWorker().postMessage({
                type: WORKER_MSG.ADD_BODY,
                bodyIndex,
                descriptor: stored,
            });
        }
        if (desc.gravityScale != null) {
            this._gravityScaleCache.set(bodyIndex, desc.gravityScale);
        } else {
            this._gravityScaleCache.set(bodyIndex, 1);
        }
        if (desc.linvel) {
            this._linvelCache.set(bodyIndex, {
                x: desc.linvel[0] ?? 0,
                y: desc.linvel[1] ?? 0,
                z: desc.linvel[2] ?? 0,
            });
        } else {
            this._linvelCache.set(bodyIndex, { x: 0, y: 0, z: 0 });
        }
        return createProxyRigidBody(this, bodyIndex);
    }

    registerProxy(bodyIndex: number, proxy: unknown): void {
        this._proxies.set(bodyIndex, proxy);
    }

    async commitWorldBuild(): Promise<boolean> {
        if (!this._active || !this._ready) return false;

        const worker = this._requireWorker();
        return new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === WORKER_MSG.INIT_OK) {
                    worker.removeEventListener('message', onMessage);
                    this._worldCommitted = true;
                    resolve(true);
                } else if (msg.type === WORKER_MSG.INIT_ERROR) {
                    worker.removeEventListener('message', onMessage);
                    reject(new Error(msg.message || 'World build failed'));
                }
            };
            worker.addEventListener('message', onMessage);
            worker.postMessage({
                type: WORKER_MSG.INIT_WORLD,
                gravity: this.gravity,
                descriptors: this._descriptorSlots.slice(0, this._nextBodyIndex),
            });
        });
    }

    resetWorld(): void {
        if (this.worker && this._ready) {
            this.worker.postMessage({ type: WORKER_MSG.RESET_WORLD });
        }
        this._descriptors = [];
        this._descriptorSlots = [];
        this._proxies.clear();
        this._pendingBodies.clear();
        this._worldCommitted = false;
        this._active = false;

        const g = this.game;
        if (g.mainPhysicsBackend) {
            g.physicsBackend = g.mainPhysicsBackend;
            g.physicsWorld.init(g.physicsGravity || { x: 0, y: -9.81, z: 0 });
        }
    }

    step(): void {
        if (!this.isWorkerMode()) return;

        const waitStart = performance.now();
        this._requireWorker().postMessage({ type: WORKER_MSG.STEP });

        Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        this.lastStepMs = this.transformViews.f32[TRANSFORM_HEADER_STEP_MS] ?? 0;
        this.lastWaitMs = performance.now() - waitStart;

        const tick = this.transformViews.u32[TRANSFORM_HEADER_FRAME_TICK] ?? 0;
        if (tick !== this._lastTick) {
            this._lastTick = tick;
            this._lastTickAt = waitStart;
        }
    }

    /** Progress [0,1] between the last observed physics tick and the next one, for render interpolation. */
    getInterpolationAlpha(): number {
        const intervalMs = 1000 / this.physicsHz;
        if (!intervalMs) return 1;
        const alpha = (performance.now() - this._lastTickAt) / intervalMs;
        return alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    }

    /**
     * Blends a body's transform between the previous and current SAB slot,
     * decoupling the (up to 120Hz) physics tick from the render tick.
     * @param {number} bodyIndex
     * @param {number} [alpha]
     */
    getInterpolatedTransform(bodyIndex: number, alpha = this.getInterpolationAlpha()) {
        const { u32, f32 } = this.transformViews;
        const currentSlot = Atomics.load(u32, TRANSFORM_HEADER_U32);
        const curr = readBodyTransform(u32, f32, currentSlot, bodyIndex);
        const prev = readBodyTransform(u32, f32, 1 - currentSlot, bodyIndex);
        const blended = lerpBodyTransform(prev, curr, alpha);
        return {
            translation: { x: blended.x, y: blended.y, z: blended.z },
            rotation: { x: blended.qx, y: blended.qy, z: blended.qz, w: blended.qw },
        };
    }

    setTimestep(value: number): void {
        this.timestep = value;
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_TIMESTEP,
            0,
            value,
        );
    }

    getTranslation(bodyIndex: number): Vec3 {
        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        const t = readBodyTransform(this.transformViews.u32, this.transformViews.f32, slot, bodyIndex);
        return { x: t.x, y: t.y, z: t.z };
    }

    getRotation(bodyIndex: number): Quat {
        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        const t = readBodyTransform(this.transformViews.u32, this.transformViews.f32, slot, bodyIndex);
        return { x: t.qx, y: t.qy, z: t.qz, w: t.qw };
    }

    getLinvel(bodyIndex: number): { x: number; y: number; z: number } {
        return this._linvelCache.get(bodyIndex) || { x: 0, y: 0, z: 0 };
    }

    getAngvel(): Vec3 {
        return { x: 0, y: 0, z: 0 };
    }

    getGravityScale(bodyIndex: number): number {
        return this._gravityScaleCache.get(bodyIndex) ?? 1;
    }

    queueImpulse(bodyIndex: number, force: Vec3, wake = true): void {
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

    queueTorque(bodyIndex: number, torque: Vec3, wake = true): void {
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

    queueSetLinvel(bodyIndex: number, v: Vec3, wake = true): void {
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

    queueSetAngvel(bodyIndex: number, v: Vec3, wake = true): void {
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

    queueSetGravityScale(bodyIndex: number, scale: number, wake = true): void {
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

    queueKinematicTranslation(bodyIndex: number, t: Vec3): void {
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

    queueKinematicRotation(bodyIndex: number, r: Quat): void {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.KINEMATIC_ROTATION,
            bodyIndex,
            r.x,
            r.y,
            r.z,
            r.w,
        );
    }

    queueSetTranslation(bodyIndex: number, t: Vec3, wake = true): void {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_TRANSLATION,
            bodyIndex,
            t.x,
            t.y,
            t.z,
            wake ? 1 : 0,
        );
    }

    queueSetRotation(bodyIndex: number, r: Quat, wake = true): void {
        void wake;
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_ROTATION,
            bodyIndex,
            r.x,
            r.y,
            r.z,
            r.w,
        );
    }

    removeRigidBody(body: { handle?: number; _bodyIndex?: number } | null | undefined): void {
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

    castRay(spec: WorkerRaycastSpec) {
        const worker = this.worker;
        if (!worker || !this.isWorkerMode()) return null;
        const { i32, f32, u32 } = this.raycastViews;
        Atomics.store(i32, 0, RAYCAST_STATUS.PENDING);
        worker.postMessage({
            type: WORKER_MSG.RAYCAST,
            ray: spec.ray,
            maxDist: spec.maxDist,
            solid: spec.solid,
            filterExcludeRigidBody: spec.filterExcludeRigidBody?.handle
                ?? spec.filterExcludeRigidBody?._bodyIndex
                ?? null,
        });

        const deadline = performance.now() + 8;
        while (Atomics.load(i32, 0) === RAYCAST_STATUS.PENDING && performance.now() < deadline) {
            // spin wait — worker fills SAB synchronously on message
        }
        if (Atomics.load(i32, 0) !== RAYCAST_STATUS.READY) return null;
        if ((f32[RAYCAST_HIT_INDEX] ?? 0) < 0.5) return null;

        const hitBodyIndex = u32[RAYCAST_BODY_INDEX] ?? 0xffffffff;
        const hitBody = hitBodyIndex !== 0xffffffff
            ? { handle: hitBodyIndex, _bodyIndex: hitBodyIndex }
            : null;

        return {
            timeOfImpact: f32[RAYCAST_TOI_INDEX] ?? 0,
            toi: f32[RAYCAST_TOI_INDEX] ?? 0,
            normal: {
                x: f32[RAYCAST_NORMAL_INDEX] ?? 0,
                y: f32[RAYCAST_NORMAL_INDEX + 1] ?? 0,
                z: f32[RAYCAST_NORMAL_INDEX + 2] ?? 0,
            },
            collider: {
                parent() {
                    return hitBody;
                },
            },
        };
    }

    destroy(): void {
        this.resetWorld();
        this.worker?.terminate();
        this.worker = null;
        this._ready = false;
    }
}

export async function createPhysicsBackend(
    game: PhysicsBackendHost,
    options: CreatePhysicsBackendOptions = {},
): Promise<MainThreadPhysicsBackend> {
    const mainBackend = new MainThreadPhysicsBackend(game);
    game.mainPhysicsBackend = mainBackend;

    const search = typeof window !== 'undefined' ? window.location.search : '';
    const wantWorker = shouldUsePhysicsWorker({
        search,
        crossOriginIsolated: typeof window !== 'undefined' && typeof window.crossOriginIsolated !== 'undefined' ? window.crossOriginIsolated : false,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        multiplayerMode: game.multiplayerMode ?? false,
        hostAuthorityMode: game.hostAuthorityMode ?? false,
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
        console.info('[Physics] Worker infrastructure ready (?physicsWorker=1 + manifest level)');
        return mainBackend;
    } catch (err) {
        console.warn('[Physics] Worker init failed, using main thread:', (err instanceof Error && err.message) || err);
        game.physicsBackend = mainBackend;
        return mainBackend;
    }
}

/** Select backend for a level load. */
export async function activatePhysicsBackendForLevel(
    game: PhysicsBackendHost,
    levelId: string,
): Promise<'worker' | 'main'> {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const useWorker = shouldUsePhysicsWorker({
        search,
        crossOriginIsolated: typeof window !== 'undefined' && typeof window.crossOriginIsolated !== 'undefined' ? window.crossOriginIsolated : false,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        multiplayerMode: game.multiplayerMode ?? false,
        hostAuthorityMode: game.hostAuthorityMode ?? false,
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

export function getRapierBackendMode(game: Pick<PhysicsBackendHost, 'physicsBackend'>): 'main' | 'worker' {
    return game.physicsBackend?.getMode?.() || 'main';
}

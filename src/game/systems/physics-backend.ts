import {
    CMD_OP,
    TRANSFORM_BUFFER_BYTES,
    CMD_RING_BYTES,
    RAYCAST_BUFFER_BYTES,
    TRANSFORM_HEADER_FRAME_TICK,
    TRANSFORM_HEADER_LAYOUT_VERSION,
    TRANSFORM_HEADER_STEP_INTERVAL_MS,
    TRANSFORM_HEADER_STEP_MS,
    TRANSFORM_HEADER_U32,
    SNAPSHOT_LAYOUT_VERSION,
    WORKER_MSG,
    createCommandViews,
    createRaycastViews,
    createTransformViews,
    enqueueCommand,
    lerpBodyTransform,
    readBodyDynamics,
    readBodyTransform,
    RAYCAST_STATUS,
    RAYCAST_HIT_INDEX,
    RAYCAST_TOI_INDEX,
    RAYCAST_POINT_INDEX,
    RAYCAST_NORMAL_INDEX,
    RAYCAST_BODY_INDEX,
    RAYCAST_BODY_TYPE_INDEX,
    RAYCAST_COLLIDER_HANDLE_F64_INDEX,
} from '../physics-worker/protocol.js';
import { createProxyRigidBody, createProxyWorld } from '../physics-worker/proxy-rigid-body.js';
import {
    resolvePhysicsHzFromSearch,
    shouldUsePhysicsWorker,
} from './physics-backend-pure.ts';
import {
    rayBodyTypeFromRapier,
    type RayHit,
    type RayQueryOptions,
    type RigidBodyLike,
} from './physics-queries.ts';

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
    /** Slow-mo / focus: scales the fixed-step clock's accumulated time. */
    setTimeScale(scale: number): void;
    /** Render pose: blended between the last two fixed steps. */
    getRenderTransform(body: RigidBodyLike & { _bodyIndex?: number }): RenderTransform;
    removeRigidBody(body: unknown): void;
    destroy(): void;
}

export interface RenderTransform {
    translation: Vec3;
    rotation: Quat;
}

/** Rapier body surface the main-thread interpolation reads. */
interface PoseBody {
    readonly handle: number;
    translation(): Vec3;
    rotation(): Quat;
}

/** Bodies further apart than this between steps are teleports; don't blend. */
const TELEPORT_SNAP_DIST_SQ = 5 * 5;

/** The slice of the game runtime the physics backends read and write. */
export interface PhysicsBackendHost {
    /** Rapier world on the main thread, or the worker proxy while a worker level is active. */
    world?: { removeRigidBody(body: unknown): void } | null;
    physicsWorld: { step(): void; init(gravity: Vec3): unknown };
    /** Main-thread fixed-step clock (also supplies per-frame sim dt in worker mode). */
    physicsClock?: { timeScale: number; alpha: number } | null;
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

export interface WorkerBackendInitOptions {
    /** Test hook: build the worker (defaults to the bundled module worker). */
    createWorker?: () => Worker;
}

/** Spin-wait budget for a synchronous worker raycast. */
const RAYCAST_TIMEOUT_MS = 8;
const NO_BODY = 0xffffffff;

/**
 * Main-thread Rapier backend (default).
 */
export class MainThreadPhysicsBackend implements PhysicsBackend {
    game: PhysicsBackendHost;
    mode: 'main';
    lastStepMs: number;
    lastWaitMs: number;
    gravity: Vec3 | undefined;
    /** Pose of each interpolated body before the most recent step, by handle. */
    _prevPoses: Map<number, { translation: Vec3; rotation: Quat }>;

    constructor(game: PhysicsBackendHost) {
        this.game = game;
        this.gravity = undefined;
        this.mode = 'main';
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
        this._prevPoses = new Map();
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
        this._prevPoses.clear();
    }

    step(): void {
        const start = performance.now();
        this.game.physicsWorld.step();
        this.lastStepMs = performance.now() - start;
        this.lastWaitMs = 0;
    }

    setTimeScale(scale: number): void {
        if (this.game.physicsClock) this.game.physicsClock.timeScale = scale;
    }

    /**
     * Record each body's pose before the frame's last fixed step (for
     * interpolation). Replaces the previous capture, so removed bodies drop out.
     */
    capturePrevPoses(bodies: Iterable<PoseBody | null | undefined>): void {
        this._prevPoses.clear();
        for (const body of bodies) {
            if (!body) continue;
            const t = body.translation();
            const r = body.rotation();
            this._prevPoses.set(body.handle, {
                translation: { x: t.x, y: t.y, z: t.z },
                rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
            });
        }
    }

    getRenderTransform(body: RigidBodyLike): RenderTransform {
        const b = body as unknown as PoseBody;
        const t = b.translation();
        const r = b.rotation();
        const prev = this._prevPoses.get(b.handle);
        if (!prev) return { translation: t, rotation: r };

        const p = prev.translation;
        const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z;
        if (dx * dx + dy * dy + dz * dz > TELEPORT_SNAP_DIST_SQ) return { translation: t, rotation: r };

        const alpha = this.game.physicsClock?.alpha ?? 1;
        const q = prev.rotation;
        const blended = lerpBodyTransform(
            { x: p.x, y: p.y, z: p.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w },
            { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w },
            alpha,
        );
        return {
            translation: { x: blended.x, y: blended.y, z: blended.z },
            rotation: { x: blended.qx, y: blended.qy, z: blended.qz, w: blended.qw },
        };
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
    physicsHz: number;
    lastStepMs: number;
    lastWaitMs: number;
    gravity: Vec3 | undefined;
    _ready: boolean;
    _active: boolean;
    _descriptors: BodyDescriptor[];
    _descriptorSlots: (BodyDescriptor | null)[];
    _proxies: Map<number, RigidBodyLike>;
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
        this.physicsHz = 120;
        this.lastStepMs = 0;
        this.lastWaitMs = 0;
        this._ready = false;
        this._active = false;
        this._descriptors = [];
        this._descriptorSlots = [];
        this._proxies = new Map();
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

    async init(gravity: Vec3, options: WorkerBackendInitOptions = {}): Promise<void> {
        this.gravity = gravity;
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error('SharedArrayBuffer unavailable');
        }

        this.physicsHz = resolvePhysicsHzFromSearch(
            typeof window !== 'undefined' ? window.location.search : '',
        );

        this.transformSab = new SharedArrayBuffer(TRANSFORM_BUFFER_BYTES);
        this.commandSab = new SharedArrayBuffer(CMD_RING_BYTES);
        this.raycastSab = new SharedArrayBuffer(RAYCAST_BUFFER_BYTES);

        this.transformViews = createTransformViews(this.transformSab);
        this.commandViews = createCommandViews(this.commandSab);
        this.raycastViews = createRaycastViews(this.raycastSab);

        const worker = options.createWorker
            ? options.createWorker()
            : new Worker(
                new URL('../physics-worker/physics-worker.js', import.meta.url),
                { type: 'module' },
            );
        this.worker = worker;

        this._initPromise = new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === WORKER_MSG.WORKER_READY) {
                    worker.removeEventListener('message', onMessage);
                    const version = this.transformViews.u32[TRANSFORM_HEADER_LAYOUT_VERSION];
                    if (version !== SNAPSHOT_LAYOUT_VERSION) {
                        reject(new Error(
                            `Physics worker snapshot layout v${version}, expected v${SNAPSHOT_LAYOUT_VERSION}`,
                        ));
                        return;
                    }
                    this._ready = true;
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
        this._gravityScaleCache.set(bodyIndex, desc.gravityScale ?? 1);

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
        this._gravityScaleCache.set(bodyIndex, desc.gravityScale ?? 1);
        return createProxyRigidBody(this, bodyIndex);
    }

    registerProxy(bodyIndex: number, proxy: RigidBodyLike): void {
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

    /**
     * Progress [0,1] between the last observed physics tick and the next one,
     * for render interpolation. Uses the worker's published step interval,
     * which stretches under slow-mo.
     */
    getInterpolationAlpha(): number {
        const published = this.transformViews?.f32[TRANSFORM_HEADER_STEP_INTERVAL_MS];
        const intervalMs = published != null && published > 0 ? published : 1000 / this.physicsHz;
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

    getRenderTransform(body: RigidBodyLike & { _bodyIndex?: number }): RenderTransform {
        return this.getInterpolatedTransform(body._bodyIndex ?? body.handle);
    }

    setTimeScale(scale: number): void {
        if (this.game.physicsClock) this.game.physicsClock.timeScale = scale;
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_TIME_SCALE,
            0,
            scale,
        );
    }

    /** Current-slot dynamics record for a body (velocities, mass, type). */
    private _dynamics(bodyIndex: number) {
        const slot = Atomics.load(this.transformViews.u32, TRANSFORM_HEADER_U32);
        return readBodyDynamics(this.transformViews.f32, slot, bodyIndex);
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

    /** Linear velocity as of the worker's last published step (lags queued commands by ≤1 tick). */
    getLinvel(bodyIndex: number): Vec3 {
        return this._dynamics(bodyIndex).linvel;
    }

    getAngvel(bodyIndex: number): Vec3 {
        return this._dynamics(bodyIndex).angvel;
    }

    getMass(bodyIndex: number): number {
        return this._dynamics(bodyIndex).mass;
    }

    /** `RAPIER.RigidBodyType` code from the snapshot. */
    getBodyType(bodyIndex: number): number {
        return this._dynamics(bodyIndex).type;
    }

    isBodyAlive(body: RigidBodyLike | null | undefined): boolean {
        if (!body || !this.isWorkerMode()) return false;
        return this._proxies.get(body.handle) === body;
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

    queueSetCcd(bodyIndex: number, enabled: boolean): void {
        enqueueCommand(
            this.commandViews.u32,
            this.commandViews.f32,
            CMD_OP.SET_CCD,
            bodyIndex,
            enabled ? 1 : 0,
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

    /**
     * Synchronous ray query against the worker world: posts the request and
     * spin-waits (≤8 ms) for the worker to fill the raycast SAB. Returns the
     * same `RayHit` shape as the main-thread queries, with `body` resolved to
     * this backend's proxy.
     */
    castRay(origin: Vec3, dir: Vec3, maxToi: number, opts: RayQueryOptions = {}): RayHit | null {
        const worker = this.worker;
        if (!worker || !this.isWorkerMode()) return null;
        const { i32, f32, u32, f64 } = this.raycastViews;
        Atomics.store(i32, 0, RAYCAST_STATUS.PENDING);
        const exclude = opts.excludeBody as (RigidBodyLike & { _bodyIndex?: number }) | null | undefined;
        worker.postMessage({
            type: WORKER_MSG.RAYCAST,
            origin: { x: origin.x, y: origin.y, z: origin.z },
            dir: { x: dir.x, y: dir.y, z: dir.z },
            maxToi,
            solid: opts.solid ?? true,
            groups: opts.groups ?? null,
            excludeSensors: opts.excludeSensors === true,
            excludeBodyIndex: exclude ? (exclude._bodyIndex ?? exclude.handle) : null,
        });

        const deadline = performance.now() + RAYCAST_TIMEOUT_MS;
        while (Atomics.load(i32, 0) === RAYCAST_STATUS.PENDING && performance.now() < deadline) {
            // spin wait — worker fills SAB synchronously on message
        }
        if (Atomics.load(i32, 0) !== RAYCAST_STATUS.READY) return null;
        if ((f32[RAYCAST_HIT_INDEX] ?? 0) < 0.5) return null;

        const hitBodyIndex = u32[RAYCAST_BODY_INDEX] ?? NO_BODY;
        const body = hitBodyIndex !== NO_BODY ? this._proxies.get(hitBodyIndex) ?? null : null;
        const typeCode = i32[RAYCAST_BODY_TYPE_INDEX] ?? -1;

        return {
            toi: f32[RAYCAST_TOI_INDEX] ?? 0,
            point: {
                x: f32[RAYCAST_POINT_INDEX] ?? 0,
                y: f32[RAYCAST_POINT_INDEX + 1] ?? 0,
                z: f32[RAYCAST_POINT_INDEX + 2] ?? 0,
            },
            normal: {
                x: f32[RAYCAST_NORMAL_INDEX] ?? 0,
                y: f32[RAYCAST_NORMAL_INDEX + 1] ?? 0,
                z: f32[RAYCAST_NORMAL_INDEX + 2] ?? 0,
            },
            colliderHandle: f64[RAYCAST_COLLIDER_HANDLE_F64_INDEX] ?? -1,
            bodyHandle: body ? body.handle : null,
            bodyType: typeCode >= 0 ? rayBodyTypeFromRapier(typeCode) : null,
            body,
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

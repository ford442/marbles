import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../types/geometry.ts';

/**
 * The single place gameplay code casts rays. Rapier's raw `world.castRay` has
 * an eight-slot positional signature (flags, groups, exclude-collider,
 * exclude-body, predicate) and reports distance as `timeOfImpact`; getting
 * either wrong fails silently. Call sites go through `PhysicsQueries.castRay`
 * instead, and ESLint rejects direct `castRay` calls elsewhere.
 */

export type RayBodyType = 'dynamic' | 'fixed' | 'kinematic';

/** Anything that names a rigid body: a Rapier `RigidBody` or a worker proxy. */
export interface RigidBodyLike {
    readonly handle: number;
}

/** Normalised ray hit, identical across the main-thread and worker backends. */
export interface RayHit {
    /** Distance along `dir` (in units of `dir`'s length) to the hit. */
    toi: number;
    /** `origin + dir * toi`. */
    point: Vec3;
    /** Surface normal at the hit; zero when the ray started inside the shape. */
    normal?: Vec3;
    colliderHandle: number;
    bodyHandle: number | null;
    bodyType: RayBodyType | null;
    /** The hit collider's parent body (Rapier body or worker proxy), if any. */
    body: RigidBodyLike | null;
}

export interface RayQueryOptions {
    /** Ignore every collider attached to this body (usually the caster). */
    excludeBody?: RigidBodyLike | null | undefined;
    /** `true` (default): a ray starting inside a shape hits it at toi 0. */
    solid?: boolean | undefined;
    /** Rapier interaction groups (`membership << 16 | filter`). */
    groups?: number | undefined;
    /** Skip sensor colliders (pickups, triggers). */
    excludeSensors?: boolean | undefined;
}

export interface PhysicsQueries {
    castRay(origin: Vec3, dir: Vec3, maxToi: number, opts?: RayQueryOptions): RayHit | null;
    /** False once the body has been removed from the simulation. */
    isBodyAlive(body: RigidBodyLike | null | undefined): boolean;
}

const BODY_TYPE_BY_RAPIER: Readonly<Record<number, RayBodyType>> = {
    [RAPIER.RigidBodyType.Dynamic]: 'dynamic',
    [RAPIER.RigidBodyType.Fixed]: 'fixed',
    [RAPIER.RigidBodyType.KinematicPositionBased]: 'kinematic',
    [RAPIER.RigidBodyType.KinematicVelocityBased]: 'kinematic',
};

export function rayBodyTypeFromRapier(type: RAPIER.RigidBodyType | null | undefined): RayBodyType | null {
    return type == null ? null : BODY_TYPE_BY_RAPIER[type] ?? null;
}

export function rayPointAt(origin: Vec3, dir: Vec3, toi: number): Vec3 {
    return { x: origin.x + dir.x * toi, y: origin.y + dir.y * toi, z: origin.z + dir.z * toi };
}

/** Query filter flags for the given options (`undefined` when nothing is filtered). */
export function rayQueryFlags(opts: RayQueryOptions): RAPIER.QueryFilterFlags | undefined {
    return opts.excludeSensors ? RAPIER.QueryFilterFlags.EXCLUDE_SENSORS : undefined;
}

/**
 * Ray queries against a Rapier `World` the caller owns. Used directly by the
 * main thread and inside the physics worker, so both backends share one
 * argument order.
 */
export class RapierPhysicsQueries implements PhysicsQueries {
    getWorld: () => RAPIER.World | null | undefined;

    constructor(getWorld: () => RAPIER.World | null | undefined) {
        this.getWorld = getWorld;
    }

    castRay(origin: Vec3, dir: Vec3, maxToi: number, opts: RayQueryOptions = {}): RayHit | null {
        const world = this.getWorld();
        if (!world) return null;
        const excludeBody = opts.excludeBody as RAPIER.RigidBody | null | undefined;
        const hit = world.castRayAndGetNormal(
            new RAPIER.Ray(origin, dir),
            maxToi,
            opts.solid ?? true,
            rayQueryFlags(opts),
            opts.groups,
            undefined,
            excludeBody ?? undefined,
        );
        if (!hit) return null;

        const parent = hit.collider.parent();
        return {
            toi: hit.timeOfImpact,
            point: rayPointAt(origin, dir, hit.timeOfImpact),
            normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
            colliderHandle: hit.collider.handle,
            bodyHandle: parent ? parent.handle : null,
            bodyType: parent ? rayBodyTypeFromRapier(parent.bodyType()) : null,
            body: parent,
        };
    }

    isBodyAlive(body: RigidBodyLike | null | undefined): boolean {
        const world = this.getWorld();
        if (!world || !body) return false;
        return world.bodies.get(body.handle) === body;
    }
}

/** What `GamePhysicsQueries` needs from the game runtime. */
export interface PhysicsQueriesHost {
    world?: unknown;
    physicsBackend?: {
        isWorkerMode?(): boolean;
        castRay?(origin: Vec3, dir: Vec3, maxToi: number, opts?: RayQueryOptions): RayHit | null;
        isBodyAlive?(body: RigidBodyLike | null | undefined): boolean;
    } | null;
}

/**
 * The game's `physicsQueries`: routes to the worker backend while a worker
 * level is active, otherwise queries the main-thread Rapier world.
 */
export class GamePhysicsQueries implements PhysicsQueries {
    game: PhysicsQueriesHost;
    main: RapierPhysicsQueries;

    constructor(game: PhysicsQueriesHost) {
        this.game = game;
        this.main = new RapierPhysicsQueries(() => game.world as RAPIER.World | null | undefined);
    }

    private _worker() {
        const backend = this.game.physicsBackend;
        return backend?.isWorkerMode?.() ? backend : null;
    }

    castRay(origin: Vec3, dir: Vec3, maxToi: number, opts?: RayQueryOptions): RayHit | null {
        const worker = this._worker();
        if (worker?.castRay) return worker.castRay(origin, dir, maxToi, opts);
        return this.main.castRay(origin, dir, maxToi, opts);
    }

    isBodyAlive(body: RigidBodyLike | null | undefined): boolean {
        const worker = this._worker();
        if (worker?.isBodyAlive) return worker.isBodyAlive(body);
        return this.main.isBodyAlive(body);
    }
}

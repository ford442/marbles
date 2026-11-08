import type RAPIER from '@dimforge/rapier3d-compat';
import type { TransformSyncOwner } from '../game-loop/helpers.ts';
import type { Vec3 } from './geometry.ts';

/**
 * Runtime world objects the frame loop updates every tick. Shapes are taken
 * from their creators (`PhysicsWorld`, `zones/methods/*`, zone factories); the
 * `_`-prefixed cache slots belong to the transform-sync helpers.
 */

/** A kinematic platform that oscillates along one axis (`type`), driven by sim time. */
export interface MovingPlatform extends TransformSyncOwner {
    rigidBody: RAPIER.RigidBody;
    entity: unknown;
    initialPos: Vec3;
    halfExtents: Vec3;
    type: 'horizontal' | 'vertical' | 'depth';
    /** Centre of travel on the oscillating axis. */
    center: number;
    speed: number;
    amplitude: number;
}

/** A kinematic platform spinning about Y; `angle` advances by `speed` radians per frame. */
export interface RotatingPlatform extends TransformSyncOwner {
    rigidBody: RAPIER.RigidBody;
    entity: unknown;
    matInstance?: unknown;
    halfExtents: Vec3;
    axis?: string;
    speed: number;
    angle: number;
    pos?: Vec3;
}

/** A dynamic box (`createDynamicBox`). */
export interface DynamicObject extends TransformSyncOwner {
    rigidBody: RAPIER.RigidBody;
    entity: unknown;
    matInstance?: unknown;
    halfExtents: Vec3;
}

export interface PowerUp extends TransformSyncOwner {
    rigidBody?: RAPIER.RigidBody;
    entity: unknown;
    matInstance?: unknown;
    type: string;
    baseY: number;
    rotation: number;
    pos: Vec3;
}

export interface Collectible extends TransformSyncOwner {
    entity: unknown;
    pos: Vec3;
    baseY: number;
    type?: string;
    value?: number;
}

/** A placed portal (`firePortal`); `normal` is the surface it sits on. */
export interface Portal {
    pos: Vec3;
    normal: Vec3;
    entity?: unknown;
    lightEntity?: unknown;
    [slot: string]: unknown;
}

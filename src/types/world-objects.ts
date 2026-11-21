import type RAPIER from '@dimforge/rapier3d-compat';
import type { ColorSyncOwner, TransformSyncOwner } from '../game-loop/helpers.ts';
import type { FilamentHandle } from './filament.ts';
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
    matInstance?: unknown;
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

/** A checkpoint trigger volume (`createCheckpointZone`); `pos` is its centre. */
export interface Checkpoint {
    pos: Vec3;
    halfExtents: Vec3;
    entity: FilamentHandle;
    matInstance: FilamentHandle;
    lightEntity: FilamentHandle;
    activated: boolean;
}

/** A grapple anchor point (`createGrappleAnchorZone`). */
export interface GrappleAnchor {
    id: string;
    pos: Vec3;
    radius: number;
    entity: FilamentHandle;
}

/** One floating ring of a goal effect; cache slots belong to `updateGoalEffects`. */
export interface GoalRing extends TransformSyncOwner, ColorSyncOwner {
    entity: FilamentHandle;
    matInstance: FilamentHandle;
    baseY: number;
    radius: number;
    rotation: number;
    rotationSpeed: number;
    bobPhase: number;
    bobSpeed: number;
    bobHeight: number;
    index: number;
    _mat?: Float32Array;
}

/** Goal light / rings / particle fountain (`createGoalEffects`), indexed by goal id. */
export interface GoalEffect {
    pos: Vec3;
    rings: GoalRing[];
    light: FilamentHandle;
    baseColor: readonly number[];
    particleSpawner: { nextSpawnTime: number; spawnInterval: number; particles: unknown[] };
    state: 'idle' | 'near' | 'completed';
    baseIntensity: number;
    nearIntensity: number;
    time: number;
    id: number;
    _forceGoalRingSync?: boolean;
    _lastLightState?: GoalEffect['state'];
    _lastLightIntensity?: number;
    _lastLightUpdateAt?: number;
}

/** A live pooled ability projectile (`spawnBomb` / `spawnMissile` / `spawnBlackHole`). */
export interface ActiveProjectile extends TransformSyncOwner, ColorSyncOwner {
    /** Transform cache for `lightEntity` (`tickActiveProjectiles`). */
    _lightSync?: TransformSyncOwner;
    entity: FilamentHandle;
    rigidBody: RAPIER.RigidBody;
    matInstance: FilamentHandle;
    lightEntity: FilamentHandle;
    /** Effect-pool slot to release on expiry (`EffectPoolManager.releaseProjectile`). */
    _poolSlot: unknown;
    /** `Date.now()` at spawn. */
    spawnTime: number;
    /** Lifetime in ms. */
    duration: number;
}

/** A short-lived fixed platform (ice block, build piece, holo platform). */
export interface TemporaryPlatform {
    entity: FilamentHandle;
    rigidBody: RAPIER.RigidBody;
    matInstance: FilamentHandle;
    /** Set for pooled holo platforms. */
    _poolSlot?: unknown;
    /** `Date.now()` at spawn. */
    spawnTime: number;
    /** Lifetime in ms; holo platforms use `holoDuration` instead. */
    duration?: number;
    /** Expiry-blink colour cache (`syncTransformsAndRender`). */
    _lastBlinkColor?: number[];
    _lastBlinkColorAt?: number;
}

/** World-space vector a particle integrates in place (`pos += vel * dt`). */
export interface MutableVec3 {
    x: number;
    y: number;
    z: number;
}

/** Linear RGB in [0, 1]. */
export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

/**
 * A pooled visual particle: the spawn config passed to
 * `EffectPoolManager.spawnVisualParticle`, spread with its pool slot. Configs
 * are loosely shaped, so everything past the core fields is optional; the
 * `is*` flag picks how `GameLoopSyncMethods` animates it, and each flag's
 * spawner sets the fields that branch reads (`startRadius`/`maxRadius` for
 * rings, `vel` for moving particles, `maxScale` for flashes, …).
 */
export interface VisualParticle extends TransformSyncOwner, ColorSyncOwner {
    entity: FilamentHandle;
    matInstance: FilamentHandle;
    /** `Date.now()` at spawn. */
    spawnTime: number;
    /** Lifetime in ms. */
    duration: number;
    pos: MutableVec3;
    vel?: MutableVec3;
    scale?: number;
    startRadius?: number;
    maxRadius?: number;
    maxScale?: number;
    /** Yaw of a collection ray (radians). */
    angle?: number;
    rotationSpeed?: number;
    color?: readonly number[] | RgbColor;
    roughness?: number;
    isEMPRing?: boolean;
    isEMPSpark?: boolean;
    isRing?: boolean;
    isGoalParticle?: boolean;
    isCheckpointParticle?: boolean;
    isCheckpointRing?: boolean;
    isCollectionParticle?: boolean;
    isCollectionRing?: boolean;
    isCollectionRay?: boolean;
    isCollectionFlash?: boolean;
    _emissiveOnly?: boolean;
    /** Effect-pool slot (`_pooled`) to release on expiry. */
    _poolSlot?: unknown;
    _pooled?: boolean;
}

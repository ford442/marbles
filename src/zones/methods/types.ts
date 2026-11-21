/**
 * @fileoverview Shared types and tiny helpers for the zone-building code
 * (`zones/methods/*` slices and the `zones/*.js` factories).
 *
 * The runtime object shapes live in `types/world-objects.ts`; they are
 * re-exported here under the names zone authors used before.
 */

import type { Quat, Vec3 } from '../../types/geometry.ts';

export type {
    Checkpoint, GoalEffect, GoalRing, GrappleAnchor, MovingPlatform, PowerUp,
} from '../../types/world-objects.ts';

export type Vector3 = Vec3;
export type Quaternion = Quat;
/** Full box extents (not half extents) on each axis. */
export type Size = Vec3;

/** Linear / sRGB colour triple. */
export type RGB = readonly [number, number, number];

/**
 * `items[index % items.length]` for a non-empty palette. The fallback to the
 * first item only exists to satisfy `noUncheckedIndexedAccess`: for any
 * non-negative integer index the modulo always lands inside the array.
 */
export function cyclic<T>(items: readonly [T, ...T[]], index: number): T {
    return items[index % items.length] ?? items[0];
}

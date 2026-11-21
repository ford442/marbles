/**
 * @fileoverview Zone-building slices.
 *
 * Each slice is a class holding the game as `this.game`; the game forwards
 * the listed methods to the instance (see `game/systems/slice-composition.ts`).
 * - track / interactive / themed creation: zone builders (tracks, checkpoints, themed sets)
 * - physics: kinematic movers and power-ups
 * - visuals: lighting, goal effects, particles
 */

import { defineSlice } from '../../game/systems/slice-composition.ts';
import { ZoneTrackCreation } from './track-creation.js';
import { ZoneInteractiveCreation } from './interactive-creation.js';
import { ZoneThemedCreation } from './themed-creation.js';
import { ZonePhysicsMethods } from './physics.js';
import { ZoneVisuals } from './visuals.js';

/** @param {Function} system */
const publicMethods = (system) =>
    Object.getOwnPropertyNames(system.prototype).filter((name) => name !== 'constructor');

/** Composed zone-building slices; the game forwards each `methods` list to the instance at `key`. */
export const ZONE_METHOD_SLICES = [
    defineSlice('zoneTrackCreationSlice', ZoneTrackCreation, publicMethods(ZoneTrackCreation)),
    defineSlice('zoneInteractiveCreationSlice', ZoneInteractiveCreation, publicMethods(ZoneInteractiveCreation)),
    defineSlice('zoneThemedCreationSlice', ZoneThemedCreation, publicMethods(ZoneThemedCreation)),
    defineSlice('zonePhysicsSlice', ZonePhysicsMethods, publicMethods(ZonePhysicsMethods)),
    defineSlice('zoneVisualsSlice', ZoneVisuals, publicMethods(ZoneVisuals)),
];

export { ZoneTrackCreation, ZoneInteractiveCreation, ZoneThemedCreation, ZonePhysicsMethods, ZoneVisuals };

// Re-export types (for JSDoc/documentation purposes)
export * from './types.js';

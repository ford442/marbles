/**
 * @fileoverview Zone-building slices.
 *
 * Each slice is a class holding the game as `this.game`; the game forwards
 * the listed methods to the instance (see `game/systems/slice-composition.ts`).
 * - track / interactive / themed creation: zone builders (tracks, checkpoints, themed sets)
 * - physics: kinematic movers and power-ups
 * - visuals: lighting, goal effects, particles
 */

import { defineSlice, type SliceSpec } from '../../game/systems/slice-composition.ts';
import { ZoneTrackCreation, type ZoneTrackCreationHost } from './track-creation.ts';
import { ZoneInteractiveCreation, type ZoneInteractiveCreationHost } from './interactive-creation.ts';
import { ZoneThemedCreation, type ZoneThemedCreationHost } from './themed-creation.ts';
import { ZonePhysicsMethods, type ZonePhysicsMethodsHost } from './physics.ts';
import { ZoneVisuals, type ZoneVisualsHost } from './visuals.ts';

/** Everything the zone-method slices need from the game (intersection of their hosts). */
export type ZoneMethodSlicesHost =
    & ZoneTrackCreationHost
    & ZoneInteractiveCreationHost
    & ZoneThemedCreationHost
    & ZonePhysicsMethodsHost
    & ZoneVisualsHost;

/** Composed zone-building slices; the game forwards each `methods` list to the instance at `key`. */
export const ZONE_METHOD_SLICES: SliceSpec<ZoneMethodSlicesHost>[] = [
    defineSlice('zoneTrackCreationSlice', ZoneTrackCreation, [
        'createMovingZone', 'createFloorZone', 'createTrackZone', 'createSpiralZone', 'createBlockZone',
        'createLoopZone', 'createZigZagZone', 'createLandingZone', 'createJumpZone', 'createSlalomZone',
        'createStaircaseZone', 'createSplitZone',
    ]),
    defineSlice('zoneInteractiveCreationSlice', ZoneInteractiveCreation, [
        'createCheckpointZone', 'createGoalZone', 'createPowerUpZone', 'createCollectiblePickup',
        'createGrappleAnchorZone',
    ]),
    defineSlice('zoneThemedCreationSlice', ZoneThemedCreation, [
        'createPyramidZone', 'createDominoZone', 'createNeonCityZone', 'createBowlingZone', 'createCastleZone',
        'createForestZone', 'createOrchardZone', 'createTree',
    ]),
    defineSlice('zonePhysicsSlice', ZonePhysicsMethods, ['createKinematicBox', 'createPowerUp']),
    defineSlice('zoneVisualsSlice', ZoneVisuals, [
        'createGoalEffects', 'updateGoalEffects', 'spawnGoalParticle', 'triggerGoalCompletionEffect',
        'setNightMode', 'setEnvironment',
    ]),
];

export { ZoneTrackCreation, ZoneInteractiveCreation, ZoneThemedCreation, ZonePhysicsMethods, ZoneVisuals };

// Re-export shared zone types.
export * from './types.ts';

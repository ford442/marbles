import { AbilityAirDash, type AbilityAirDashHost } from './air-dash.ts';
import { AbilityDash, type AbilityDashHost } from './dash.ts';
import { AbilityStomp, type AbilityStompHost } from './stomp.ts';
import { defineSlice, type SliceSpec } from '../game/systems/slice-composition.ts';
import { AbilityBlink, type AbilityBlinkHost } from './blink.ts';
import { AbilityEmpTremor, type AbilityEmpTremorHost } from './emp-tremor.ts';
import { AbilityTeleport, type AbilityTeleportHost } from './teleport.ts';
import { AbilityMissiles, type AbilityMissilesHost } from './missiles.ts';
import { AbilityBlackHole, type AbilityBlackHoleHost } from './black-hole.ts';
import { AbilityBomb, type AbilityBombHost } from './bomb.ts';
import { AbilityConstructs, type AbilityConstructsHost } from './constructs.ts';
import { AbilityDoubleJump, type AbilityDoubleJumpHost } from './double-jump.ts';
import { AbilityShockwaveDive, type AbilityShockwaveDiveHost } from './shockwave-dive.ts';

export {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
    getAbilityDefinition,
    isAbilityId,
    resolveAbilityMask,
} from './registry.js';

/** Everything the ability action slices use on the game. */
export type AbilitySlicesHost =
    & AbilityDoubleJumpHost
    & AbilityAirDashHost
    & AbilityDashHost
    & AbilityStompHost
    & AbilityShockwaveDiveHost
    & AbilityBlinkHost
    & AbilityEmpTremorHost
    & AbilityTeleportHost
    & AbilityMissilesHost
    & AbilityBlackHoleHost
    & AbilityBombHost
    & AbilityConstructsHost;

/** Composed ability action slices; the game forwards each `methods` list to the instance at `key`. */
export const ABILITY_SLICES: SliceSpec<AbilitySlicesHost>[] = [
    defineSlice('abilityDoubleJumpSlice', AbilityDoubleJump, ['executeDoubleJump']),
    defineSlice('abilityAirDashSlice', AbilityAirDash, ['beginAirDashCharge', 'releaseAirDash']),
    defineSlice('abilityDashSlice', AbilityDash, ['beginDashCharge', 'releaseDash']),
    defineSlice('abilityStompSlice', AbilityStomp, ['beginStompCharge', 'releaseStomp']),
    defineSlice('abilityShockwaveDiveSlice', AbilityShockwaveDive, ['beginShockwaveCharge', 'releaseShockwave']),
    defineSlice('abilityBlinkSlice', AbilityBlink, ['triggerBlink', 'spawnBlinkParticle']),
    defineSlice('abilityEmpTremorSlice', AbilityEmpTremor, [
        'fireEMP', 'fireTremor', 'spawnEMPEffect', 'spawnEMPSpark', 'triggerEMPFlash',
    ]),
    defineSlice('abilityTeleportSlice', AbilityTeleport, ['triggerTeleport']),
    defineSlice('abilityMissilesSlice', AbilityMissiles, ['spawnMissile', 'explodeMissile']),
    defineSlice('abilityBlackHoleSlice', AbilityBlackHole, ['spawnBlackHole']),
    defineSlice('abilityBombSlice', AbilityBomb, ['spawnBomb', 'explodeBomb']),
    defineSlice('abilityConstructsSlice', AbilityConstructs, [
        'spawnIceBlock', 'spawnBuildPiece', 'destroyPortal', 'firePortal', 'spawnJetpackExhaust',
        'fireGravityPulse', 'spawnHoloPlatform',
    ]),
];

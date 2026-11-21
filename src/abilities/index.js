import { AbilityAirDash } from './air-dash.js';
import { AbilityDash } from './dash.js';
import { AbilityStomp } from './stomp.js';
import { defineSlice } from '../game/systems/slice-composition.ts';
import { AbilityBlink } from './blink.js';
import { AbilityEmpTremor } from './emp-tremor.js';
import { AbilityTeleport } from './teleport.js';
import { AbilityMissiles } from './missiles.js';
import { AbilityBlackHole } from './black-hole.js';
import { AbilityBomb } from './bomb.js';
import { AbilityConstructs } from './constructs.js';
import { AbilityDoubleJump } from './double-jump.js';
import { AbilityShockwaveDive } from './shockwave-dive.js';

export {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
    getAbilityDefinition,
    isAbilityId,
    resolveAbilityMask,
} from './registry.js';

/** Composed ability action slices; the game forwards each `methods` list to the instance at `key`. */
export const ABILITY_SLICES = [
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

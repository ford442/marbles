import { installKnownMethods } from '../game/systems/method-installer.js';
import { AbilityBlink } from './blink.js';
import { AbilityEmpTremor } from './emp-tremor.js';
import { AbilityTeleport } from './teleport.js';
import { AbilityMissiles } from './missiles.js';
import { AbilityBlackHole } from './black-hole.js';
import { AbilityBomb } from './bomb.js';
import { AbilityConstructs } from './constructs.js';

export {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
    getAbilityDefinition,
    isAbilityId,
    resolveAbilityMask,
} from './registry.js';

/** Closed compatibility list for ability actions not yet registry-owned. */
export function installAbilityMethods(targetClass) {
    installKnownMethods(targetClass, AbilityBlink, ['triggerBlink', 'spawnBlinkParticle']);
    installKnownMethods(targetClass, AbilityEmpTremor, [
        'fireEMP', 'fireTremor', 'spawnEMPEffect', 'spawnEMPSpark', 'triggerEMPFlash',
    ]);
    installKnownMethods(targetClass, AbilityTeleport, ['triggerTeleport']);
    installKnownMethods(targetClass, AbilityMissiles, ['spawnMissile', 'explodeMissile']);
    installKnownMethods(targetClass, AbilityBlackHole, ['spawnBlackHole']);
    installKnownMethods(targetClass, AbilityBomb, ['spawnBomb', 'explodeBomb']);
    installKnownMethods(targetClass, AbilityConstructs, [
        'spawnIceBlock', 'spawnBuildPiece', 'destroyPortal', 'firePortal',
        'spawnJetpackExhaust', 'fireGravityPulse', 'spawnHoloPlatform',
    ]);
}

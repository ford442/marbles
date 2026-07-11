import { applyAbilityBlink } from './blink.js';
import { applyAbilityEmpTremor } from './emp-tremor.js';
import { applyAbilityTeleport } from './teleport.js';
import { applyAbilityMissiles } from './missiles.js';
import { applyAbilityBlackHole } from './black-hole.js';
import { applyAbilityBomb } from './bomb.js';
import { applyAbilityConstructs } from './constructs.js';

export { ABILITY_REGISTRY, ALL_ABILITY_IDS, getAbilityDefinition } from './registry.js';

export function applyAbilityMethods(targetClass) {
    applyAbilityBlink(targetClass);
    applyAbilityEmpTremor(targetClass);
    applyAbilityTeleport(targetClass);
    applyAbilityMissiles(targetClass);
    applyAbilityBlackHole(targetClass);
    applyAbilityBomb(targetClass);
    applyAbilityConstructs(targetClass);
}

/**
 * Ability registry as the single source of input truth (#451 Part E):
 * every entry is well-formed, no two abilities (or reserved UI keys) share a
 * binding, init/core.js and frame-input.js no longer branch on ability keys,
 * and AbilitySystem dispatch honours level masks for every trigger kind.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
    RESERVED_KEY_CODES,
} from '../src/abilities/registry.js';
import { AbilitySystem, keyLabel } from '../src/game/systems/ability-system.ts';
import { NETWORKED_ABILITIES } from '../src/game/network/input-bitfield.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRIGGERS = new Set(['press', 'hold', 'charge', 'poll']);

function testEntriesWellFormed() {
    for (const id of ALL_ABILITY_IDS) {
        const def = ABILITY_REGISTRY[id];
        assert.equal(def.id, id, `${id}: id matches its key`);
        assert.ok(def.binding?.code, `${id}: has a binding`);
        assert.ok(TRIGGERS.has(def.binding.trigger), `${id}: trigger ${def.binding.trigger}`);
        if (def.binding.trigger === 'press') assert.equal(typeof def.activate, 'function', `${id}: press needs activate()`);
        if (def.binding.trigger === 'hold' || def.binding.trigger === 'charge') {
            assert.equal(typeof def.press, 'function', `${id}: ${def.binding.trigger} needs press()`);
            assert.equal(typeof def.release, 'function', `${id}: ${def.binding.trigger} needs release()`);
        }
        assert.ok(def.netBit === null || (Number.isInteger(def.netBit) && def.netBit >= 0 && def.netBit < MAX_NETWORKED_ABILITY_IDS),
            `${id}: netBit is null or < ${MAX_NETWORKED_ABILITY_IDS}`);
        if (def.cooldownSec !== undefined) {
            assert.ok(def.cooldownSec > 0 && def.lastUseKey && def.cooldownKey, `${id}: a cooldown names its lastUseKey/cooldownKey`);
        }
    }
    const encoded = NETWORKED_ABILITIES.map((e) => e.id);
    assert.deepEqual(encoded, ALL_ABILITY_IDS.filter((id) => ABILITY_REGISTRY[id].netBit !== null),
        'the input bitfield is derived from the registry netBits');
}

function testNoBindingConflicts() {
    /** @type {Map<string, string>} */
    const owner = new Map();
    for (const id of ALL_ABILITY_IDS) {
        const def = ABILITY_REGISTRY[id];
        for (const code of [def.binding.code, ...(def.binding.alt ?? [])]) {
            assert.ok(!RESERVED_KEY_CODES[code], `${id}: ${code} is reserved for ${RESERVED_KEY_CODES[code]}`);
            const prev = owner.get(code);
            // An implied ability (double jump) rides its parent's key by design.
            const shared = prev && (def.impliedBy === prev || ABILITY_REGISTRY[prev].impliedBy === id);
            assert.ok(!prev || shared, `${code} is bound to both ${prev} and ${id}`);
            if (!prev) owner.set(code, id);
        }
    }
    assert.equal(ABILITY_REGISTRY.missile.binding.code, 'KeyV', 'missile moved off L (lock-on)');
    assert.equal(ABILITY_REGISTRY.magnet_repel.binding.code, 'Minus', 'repel moved off Q (air dash)');
    assert.equal(ABILITY_REGISTRY.chameleon.binding.code, 'Equal', 'chameleon moved off N (mute)');
}

function testHostsNoLongerBranchOnAbilityKeys() {
    const core = fs.readFileSync(path.join(ROOT, 'src/init/core.js'), 'utf8');
    const codes = [...core.matchAll(/e\.code === '(\w+)'/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(codes)].sort(), ['Escape', 'KeyC', 'Tab'], 'core.js only handles UI keys itself');
    const frame = fs.readFileSync(path.join(ROOT, 'src/game-loop/frame-input.js'), 'utf8');
    for (const [, code] of frame.matchAll(/keys\['(\w+)'\]/g)) {
        const isAbilityKey = ALL_ABILITY_IDS.some((id) => ABILITY_REGISTRY[id].binding.code === code);
        assert.ok(!isAbilityKey, `frame-input.js polls ability key ${code} directly`);
    }
}

function testMapsNameOnlyRegisteredAbilities() {
    const dir = path.join(ROOT, 'assets', 'maps');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const map = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        for (const id of [...(map.abilities?.enabled ?? []), ...(map.abilities?.disabled ?? [])]) {
            assert.ok(ABILITY_REGISTRY[id], `${file}: unknown ability "${id}"`);
        }
    }
}

function mockGame(extra = {}) {
    const calls = [];
    const game = {
        keys: {},
        playerMarble: { rigidBody: {} },
        hudManager: { markAbilityUsed: (id) => calls.push(`mark:${id}`), abilityElements: new Map() },
        isGrounded: () => false,
        beginAirDashCharge(now) { calls.push(`airdash:begin:${now}`); this.isChargingAirDash = true; },
        releaseAirDash(now) { calls.push(`airdash:release:${now}`); this.isChargingAirDash = false; },
        firePortal: (which) => calls.push(`portal:${which}`),
        spawnBuildPiece: (piece) => calls.push(`build:${piece}`),
        startGrappleRaw: () => calls.push('grapple:start'),
        stopGrappleRaw: () => calls.push('grapple:stop'),
        lastAirDashTime: 0,
        airDashCooldown: 2000,
        lastTeleportTime: 0,
        teleportCooldown: 5000,
        triggerTeleport() { this.lastTeleportTime = Date.now(); calls.push('teleport'); },
        ...extra,
    };
    const system = new AbilitySystem(game);
    system.init();
    game.abilitySystem = system;
    return { game, system, calls };
}

function testHoldDispatchAndRepeat() {
    const { game, system, calls } = mockGame();
    assert.equal(system.handleKeyDown('KeyH'), true);
    assert.equal(game.hoverActive, true);
    system.handleKeyDown('KeyH'); // key repeat
    assert.deepEqual(calls, ['mark:hover'], 'repeat does not re-press');
    system.handleKeyUp('KeyH');
    assert.equal(game.hoverActive, false);

    system.handleKeyDown('Minus');
    assert.equal(game.magnetMode, 'repel');
    system.handleKeyUp('Minus');
    assert.equal(game.magnetActive, false);
}

function testMasksBlockEveryTrigger() {
    const { game, system, calls } = mockGame();
    system.applyLevelMask({ enabled: ['jump'] }); // the tutorial
    assert.equal(system.handleKeyDown('KeyH'), true, 'still owned while disabled');
    assert.notEqual(game.hoverActive, true, 'disabled hold ability does not press');
    system.handleKeyDown('Digit4');
    game.keys.KeyQ = true;
    system.tickChargeInputs(10_000);
    game.keys.KeyF = true;
    assert.equal(system.isHeld('focus'), false, 'disabled poll ability reads as not held');
    assert.equal(system.pressAbility('grapple'), false, 'disabled mouse binding');
    assert.deepEqual(calls, []);

    system.applyLevelMask({ disabled: ['portal_a'] });
    system.handleKeyDown('Digit4');
    system.handleKeyDown('Digit5');
    assert.deepEqual(calls, ['portal:B']);
}

function testMaskChangeReleasesHeld() {
    const { game, system } = mockGame();
    system.handleKeyDown('KeyJ');
    assert.equal(game.jetpackActive, true);
    system.applyLevelMask({ disabled: ['jetpack'] });
    assert.equal(game.jetpackActive, false);
}

function testChargeEdgesAndCooldown() {
    const { game, system, calls } = mockGame();
    game.keys.KeyQ = true;
    system.tickChargeInputs(10_000);
    system.tickChargeInputs(10_016); // still held: no second press
    game.keys.KeyQ = false;
    system.tickChargeInputs(10_032);
    assert.deepEqual(calls, ['airdash:begin:10000', 'airdash:release:10032']);
    game.lastAirDashTime = 10_032;
    game.keys.KeyQ = true;
    system.tickChargeInputs(10_500);
    assert.equal(calls.length, 2, 'air dash on cooldown');
}

function testPressCooldownAndMarble() {
    const { game, system, calls } = mockGame();
    system.handleKeyDown('KeyP');
    system.handleKeyDown('KeyP');
    assert.deepEqual(calls, ['teleport'], 'teleport gated by its 5 s cooldown');
    game.playerMarble = null;
    game.lastTeleportTime = 0;
    system.handleKeyDown('KeyP');
    system.handleKeyDown('Digit1');
    assert.deepEqual(calls, ['teleport', 'build:ramp'], 'build pieces check the marble themselves');
}

function testHudIconsFollowMasks() {
    const { system } = mockGame();
    system.applyLevelMask({ disabled: ['magnet_attract'] });
    assert.equal(system.isHudIconEnabled('magnet'), true, 'repel still drives the magnet icon');
    system.applyLevelMask({ disabled: ['magnet_attract', 'magnet_repel', 'dash'] });
    assert.equal(system.isHudIconEnabled('magnet'), false);
    assert.equal(system.isHudIconEnabled('boost'), false, 'boost icon mirrors the dash');
    assert.equal(system.isHudIconEnabled('ice'), true, 'icons no ability drives are left alone');
    assert.equal(system.hudKeyLabel('magnet'), 'E/-');
    assert.equal(keyLabel('Digit0'), '0');
}

testEntriesWellFormed();
testNoBindingConflicts();
testHostsNoLongerBranchOnAbilityKeys();
testMapsNameOnlyRegisteredAbilities();
testHoldDispatchAndRepeat();
testMasksBlockEveryTrigger();
testMaskChangeReleasesHeld();
testChargeEdgesAndCooldown();
testPressCooldownAndMarble();
testHudIconsFollowMasks();
console.log(`Ability binding tests passed (${ALL_ABILITY_IDS.length} abilities)`);

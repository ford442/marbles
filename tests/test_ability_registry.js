import assert from 'node:assert/strict';
import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
} from '../src/abilities/registry.js';
import { AbilitySystem } from '../src/game/systems/ability-system.ts';
import {
    ABILITY_BIT_OFFSET,
    decodeAbilityBits,
    encodeInputSnapshot,
} from '../src/game/network/input-bitfield.js';

function createMockGame(overrides = {}) {
    const game = {
        playerMarble: { rigidBody: {} },
        lastBombTime: 0,
        bombCooldown: 5000,
        lastMissileTime: 0,
        missileCooldown: 1500,
        lastBlackHoleTime: 0,
        blackHoleCooldown: 5000,
        lastHoloTime: 0,
        holoCooldown: 5000,
        lastBlinkTime: 0,
        blinkCooldown: 2000,
        activeBlackHoles: [],
        jumpCharge: 0.5,
        bombBarEl: { style: {} },
        missileBarEl: { style: {} },
        blackHoleBarEl: { style: {}, parentElement: { style: {} } },
        blackHoleBarContainerEl: { style: {} },
        holobarEl: { style: {} },
        holobarContainerEl: { style: {} },
        jumpBarEl: { style: {} },
        settings: { controls: { keybinds: {} } },
        spawnBomb() { this.lastBombTime = Date.now(); },
        spawnMissile() { this.lastMissileTime = Date.now(); },
        spawnBlackHole() { this.lastBlackHoleTime = Date.now(); },
        spawnHoloPlatform() { this.lastHoloTime = Date.now(); },
        triggerBlink() { this.lastBlinkTime = Date.now(); },
        hudManager: {
            markAbilityUsed() {},
            updateAbilityCooldown() {},
            abilityElements: new Map(),
        },
        ...overrides,
    };
    game.abilitySystem = new AbilitySystem(game);
    game.abilitySystem.init();
    return game;
}

function testRegistryHasCoreAbilities() {
    const required = ['jump', 'bomb', 'missile', 'blackhole', 'holo', 'blink'];
    for (const id of required) {
        assert.ok(ABILITY_REGISTRY[id], `missing registry entry: ${id}`);
    }
    assert.equal(ALL_ABILITY_IDS.length >= 6, true);
    assert.ok(
        ALL_ABILITY_IDS.length <= MAX_NETWORKED_ABILITY_IDS,
        'registry abilities must fit in the reserved multiplayer bitfield',
    );
}

function testTutorialMask() {
    const game = createMockGame();
    game.abilitySystem.applyLevelMask({ enabled: ['jump'] });

    assert.equal(game.abilitySystem.isEnabled('jump'), true);
    assert.equal(game.abilitySystem.isEnabled('bomb'), false);
    assert.equal(game.abilitySystem.handleKeyDown('KeyX'), true);
    assert.equal(game.lastBombTime, 0);
}

function testMaskPrecedenceAndUnknownIds() {
    const game = createMockGame();
    game.abilitySystem.applyLevelMask({
        enabled: ['jump', 'not_registered'],
        disabled: ['jump'],
    });

    // `enabled` wins for jump itself; double jump follows it (impliedBy).
    assert.deepEqual([...game.abilitySystem.enabled], ['jump', 'doublejump']);
}

function testJumpMaskKeepsDoubleJump() {
    // Shipped maps (tutorial, neon_showcase) use `enabled: ["jump"]`; they had
    // double jump before it moved into the registry.
    const game = createMockGame();
    game.abilitySystem.applyLevelMask({ enabled: ['jump'] });
    assert.equal(game.abilitySystem.isEnabled('doublejump'), true);

    game.abilitySystem.applyLevelMask({ enabled: ['jump'], disabled: ['doublejump'] });
    assert.equal(game.abilitySystem.isEnabled('jump'), true);
    assert.equal(game.abilitySystem.isEnabled('doublejump'), false);

    game.abilitySystem.applyLevelMask({ enabled: ['bomb'] });
    assert.equal(game.abilitySystem.isEnabled('doublejump'), false);
}

function testNetworkBitsArePinned() {
    // Bits on the wire must not move when abilities are added: this is the
    // layout shipped since 2026-09-19 plus doublejump appended.
    const expected = {
        airdashing: 0, dash: 1, jump: 2, stomp: 3, bomb: 4,
        missile: 5, blackhole: 6, holo: 7, blink: 8, doublejump: 9,
    };
    for (const [id, bit] of Object.entries(expected)) {
        assert.equal(ABILITY_REGISTRY[id].netBit, bit, `netBit for ${id}`);
    }
    const bits = ALL_ABILITY_IDS.map((id) => ABILITY_REGISTRY[id].netBit);
    assert.equal(new Set(bits).size, bits.length, 'netBits must be unique');
    for (const bit of bits) {
        assert.ok(Number.isInteger(bit) && bit >= 0 && bit < MAX_NETWORKED_ABILITY_IDS);
    }
}

function testInputBitfieldUsesPinnedBits() {
    const game = createMockGame();
    game.keys = { KeyB: true }; // blink
    const { bits } = encodeInputSnapshot(game);
    assert.ok(bits & (1 << (ABILITY_BIT_OFFSET + 8)), 'blink is bit 8');
    assert.deepEqual(decodeAbilityBits(bits), ['blink']);
    assert.deepEqual(decodeAbilityBits(1 << (ABILITY_BIT_OFFSET + 9)), ['doublejump']);
}

function testActivateRespectsCooldown() {
    const game = createMockGame();
    game.lastBombTime = Date.now();
    assert.equal(game.abilitySystem.tryActivate('bomb'), false);

    game.lastBombTime = 0;
    assert.equal(game.abilitySystem.tryActivate('bomb'), true);
    assert.ok(game.lastBombTime > 0);
}

function testKeybindOverride() {
    const game = createMockGame();
    game.abilitySystem.loadKeybinds({ bomb: 'KeyZ' });
    assert.equal(game.abilitySystem.getKeyCode('bomb'), 'KeyZ');
    game.abilitySystem.tryActivate('bomb');
    assert.ok(game.lastBombTime > 0);
}

function testHudBarTick() {
    const game = createMockGame();
    game.lastBombTime = Date.now() - 2500;
    game.abilitySystem.tickHudBars(Date.now(), true);
    assert.ok(parseFloat(game.bombBarEl.style.width) > 0);
}

testRegistryHasCoreAbilities();
testTutorialMask();
testMaskPrecedenceAndUnknownIds();
testJumpMaskKeepsDoubleJump();
testNetworkBitsArePinned();
testInputBitfieldUsesPinnedBits();
testActivateRespectsCooldown();
testKeybindOverride();
testHudBarTick();
console.log('Ability registry tests passed');

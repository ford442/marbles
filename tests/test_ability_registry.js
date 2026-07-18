import assert from 'node:assert/strict';
import { ABILITY_REGISTRY, ALL_ABILITY_IDS } from '../src/abilities/registry.js';
import { AbilitySystem } from '../src/game/systems/ability-system.js';

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
}

function testTutorialMask() {
    const game = createMockGame();
    game.abilitySystem.applyLevelMask({ enabled: ['jump'] });

    assert.equal(game.abilitySystem.isEnabled('jump'), true);
    assert.equal(game.abilitySystem.isEnabled('bomb'), false);
    assert.equal(game.abilitySystem.handleKeyDown('KeyX'), true);
    assert.equal(game.lastBombTime, 0);
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
testActivateRespectsCooldown();
testKeybindOverride();
testHudBarTick();
console.log('Ability registry tests passed');

/**
 * Canonical ability definitions. New abilities are registered here first.
 *
 * @typedef {'keydown' | 'charge' | 'hold'} AbilityInputTrigger
 * @typedef {'cooldown' | 'energy' | 'charge'} AbilityHudMode
 *
 * @typedef {object} AbilityHudSlot
 * @property {string} [barKey] - `game` state key for the bar element (e.g. `bombBarEl`)
 * @property {string} [containerKey] - optional container element key
 * @property {AbilityHudMode} mode
 * @property {string} [readyGlow] - CSS filter when ready (legacy bars)
 * @property {boolean} [hideWhenReady] - hide container after cooldown (legacy bars)
 * @property {string} [activeWhen] - game state path checked for active styling (e.g. `activeBlackHoles.length`)
 *
 * @typedef {object} AbilityDefinition
 * @property {string} id
 * @property {string} name
 * @property {'movement' | 'combat' | 'utility'} category
 * @property {number} [cooldownMs]
 * @property {string} [lastUseKey] - mirrored game field (e.g. `lastBombTime`)
 * @property {string} [cooldownKey] - mirrored game field for per-level overrides
 * @property {string} [energyKey]
 * @property {string} [maxEnergyKey]
 * @property {number} [energyCost]
 * @property {{ defaultCode: string, trigger?: AbilityInputTrigger, settingsKey?: string }} [input]
 * @property {AbilityHudSlot} [hudSlot]
 * @property {string} [hudIconId] - id used by HUDManager icon overlay
 * @property {(game: object) => boolean | void} [activate]
 * @property {(game: object, now: number) => void} [update]
 */

/** @type {Record<string, AbilityDefinition>} */
export const ABILITY_REGISTRY = {
    jump: {
        id: 'jump',
        name: 'Jump',
        category: 'movement',
        input: { defaultCode: 'Space', trigger: 'charge', settingsKey: 'jump' },
        hudSlot: { barKey: 'jumpBarEl', mode: 'charge' },
    },
    bomb: {
        id: 'bomb',
        name: 'Bomb',
        category: 'combat',
        cooldownMs: 5000,
        lastUseKey: 'lastBombTime',
        cooldownKey: 'bombCooldown',
        input: { defaultCode: 'KeyX', trigger: 'keydown', settingsKey: 'bomb' },
        hudSlot: {
            barKey: 'bombBarEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ff4500)',
        },
        hudIconId: 'bomb',
        activate(game) {
            if (!game.playerMarble) return false;
            game.spawnBomb();
            return true;
        },
    },
    missile: {
        id: 'missile',
        name: 'Missile',
        category: 'combat',
        cooldownMs: 1500,
        lastUseKey: 'lastMissileTime',
        cooldownKey: 'missileCooldown',
        input: { defaultCode: 'KeyL', trigger: 'keydown', settingsKey: 'missile' },
        hudSlot: {
            barKey: 'missileBarEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ff8800)',
        },
        hudIconId: 'missile',
        activate(game) {
            if (!game.playerMarble) return false;
            game.spawnMissile();
            return true;
        },
    },
    blackhole: {
        id: 'blackhole',
        name: 'Black Hole',
        category: 'combat',
        cooldownMs: 5000,
        lastUseKey: 'lastBlackHoleTime',
        cooldownKey: 'blackHoleCooldown',
        input: { defaultCode: 'Digit9', trigger: 'keydown', settingsKey: 'blackhole' },
        hudSlot: {
            barKey: 'blackHoleBarEl',
            containerKey: 'blackHoleBarContainerEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #aa00ff)',
            activeWhen: 'activeBlackHoles.length',
        },
        hudIconId: 'blackhole',
        activate(game) {
            if (!game.playerMarble) return false;
            game.spawnBlackHole();
            return true;
        },
    },
    holo: {
        id: 'holo',
        name: 'Holo Platform',
        category: 'utility',
        cooldownMs: 5000,
        lastUseKey: 'lastHoloTime',
        cooldownKey: 'holoCooldown',
        input: { defaultCode: 'Backquote', trigger: 'keydown', settingsKey: 'holo' },
        hudSlot: {
            barKey: 'holobarEl',
            containerKey: 'holobarContainerEl',
            mode: 'cooldown',
            hideWhenReady: true,
        },
        hudIconId: 'holo',
        activate(game) {
            if (!game.playerMarble) return false;
            game.spawnHoloPlatform();
            if (game.hudManager) game.hudManager.markAbilityUsed('holo');
            return true;
        },
    },
    blink: {
        id: 'blink',
        name: 'Blink',
        category: 'movement',
        cooldownMs: 2000,
        lastUseKey: 'lastBlinkTime',
        cooldownKey: 'blinkCooldown',
        input: { defaultCode: 'KeyB', trigger: 'keydown', settingsKey: 'blink' },
        hudSlot: {
            barKey: 'blinkBarEl',
            containerKey: 'blinkBarContainerEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ffcc00)',
        },
        hudIconId: 'blink',
        activate(game) {
            if (!game.playerMarble) return false;
            game.triggerBlink();
            return true;
        },
    },
};

/** All registered ability ids (default: all enabled). */
export const ALL_ABILITY_IDS = Object.keys(ABILITY_REGISTRY);

/**
 * @param {string} id
 * @returns {AbilityDefinition | undefined}
 */
export function getAbilityDefinition(id) {
    return ABILITY_REGISTRY[id];
}

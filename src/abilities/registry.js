// @ts-check
/**
 * Canonical ability definitions — the one place an ability's key, cooldown,
 * input behaviour and network bit are declared. `AbilitySystem`
 * (game/systems/ability-system.ts) dispatches keyboard input to these
 * entries, so no ability is a hard-coded key branch any more; map
 * `abilities` masks enable/disable entries by id.
 *
 * Triggers:
 * - `press`  — `activate(game, dt)` once on keydown (after cooldown/energy gating)
 * - `hold`   — `press(game, now)` on keydown, `release(game, now)` on keyup
 * - `charge` — like `hold`, but edge-detected from the held-key map each frame
 *              (`AbilitySystem.tickChargeInputs`) so it sees the frame's `now`
 * - `poll`   — no hooks; per-frame code asks `AbilitySystem.isHeld(id)`
 *
 * @typedef {'press' | 'hold' | 'charge' | 'poll'} AbilityInputTrigger
 * @typedef {'cooldown' | 'energy' | 'charge'} AbilityHudMode
 * @typedef {import('../types/map.ts').AbilityMask} AbilityMask
 *
 * The game runtime (MarblesGame / GameMixinHost): hooks read and write its
 * ability fields directly, so it is loosely typed here.
 * @typedef {any} AbilityGameContext
 *
 * @typedef {object} AbilityBinding
 * @property {string} code - default `KeyboardEvent.code`; `Mouse0..2` for mouse buttons
 *   (those are dispatched by InputSystem, not the keyboard map)
 * @property {string[]} [alt] - extra codes that also drive the ability (e.g. ShiftRight)
 * @property {AbilityInputTrigger} trigger
 * @property {string} [settingsKey] - key under settings.controls.keybinds for overrides
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
 * @property {number | null} netBit - pinned bit index in the multiplayer input bitfield
 *   (`ABILITY_BIT_OFFSET + netBit`); unique, < `MAX_NETWORKED_ABILITY_IDS`, never
 *   reused. `null` = local-only (the entry says why).
 * @property {AbilityBinding} binding
 * @property {number} [cooldownSec] - default cooldown; the game field named by
 *   `cooldownKey` (per-level / state override) wins when set
 * @property {string} [lastUseKey] - game field holding the last use (ms); with a
 *   cooldown, AbilitySystem gates activation on it
 * @property {string} [cooldownKey] - game field holding the effective cooldown (ms)
 * @property {boolean} [requiresMarble] - default true: inert without a player marble
 * @property {boolean} [broadcast] - send a network `ability` message on use (remote FX)
 * @property {string} [impliedBy] - a level mask whose `enabled` list names this
 *   ability id also enables this one (unless the mask's `disabled` list names it);
 *   such an ability may share its parent's binding and is driven by the parent
 * @property {string} [energyKey]
 * @property {string} [maxEnergyKey]
 * @property {number} [energyCost]
 * @property {AbilityHudSlot} [hudSlot]
 * @property {string} [hudIconId] - HUDManager icon this ability drives
 * @property {string[]} [hudIconAliases] - further HUD icons hidden with this ability
 * @property {(game: AbilityGameContext, dt?: number) => boolean | void} [activate] - `press` trigger
 * @property {(game: AbilityGameContext, now: number) => void} [press] - `hold` / `charge` start
 * @property {(game: AbilityGameContext, now: number) => void} [release] - `hold` / `charge` end
 */

import { pressJump, releaseJump } from './jump.js';
import {
    cycleChameleon, cycleSizeShift, endRewind, heldFlag, toggleGravityFlip, toggleTimeStop,
} from './held-abilities.js';

/** HUD icon ids for the magnet pair (one icon, two bindings). */
const MAGNET_ICON = 'magnet';

/** @satisfies {Record<string, AbilityDefinition>} */
export const ABILITY_REGISTRY = {
    // ── Pinned since 2026-09-19 (bits 0–9): never renumber ───────────────────
    airdashing: {
        id: 'airdashing',
        name: 'Air Dash',
        category: 'movement',
        netBit: 0,
        binding: { code: 'KeyQ', trigger: 'charge', settingsKey: 'airdashing' },
        cooldownSec: 2,
        lastUseKey: 'lastAirDashTime',
        cooldownKey: 'airDashCooldown',
        hudSlot: { barKey: 'airDashBarEl', mode: 'charge' },
        press(game, now) {
            if (!game.isGrounded(game.playerMarble) && !game.isChargingAirDash) game.beginAirDashCharge?.(now)
        },
        release(game, now) {
            if (game.isChargingAirDash && game.playerMarble) game.releaseAirDash?.(now)
        },
    },
    dash: {
        id: 'dash',
        name: 'Dash',
        category: 'movement',
        netBit: 1,
        binding: { code: 'ShiftLeft', alt: ['ShiftRight'], trigger: 'charge', settingsKey: 'dash' },
        cooldownSec: 1.5,
        lastUseKey: 'lastDashTime',
        cooldownKey: 'dashCooldown',
        hudSlot: { barKey: 'dashBarEl', mode: 'charge' },
        hudIconId: 'dash',
        // The legacy boost icon mirrors the dash (Shift used to be boost).
        hudIconAliases: ['boost'],
        press(game, now) {
            if (!game.isChargingDash) game.beginDashCharge?.(now)
        },
        release(game, now) {
            if (game.isChargingDash) game.releaseDash?.(now)
        },
    },
    jump: {
        id: 'jump',
        name: 'Jump',
        category: 'movement',
        netBit: 2,
        binding: { code: 'Space', trigger: 'hold', settingsKey: 'jump' },
        hudSlot: { barKey: 'jumpBarEl', mode: 'charge' },
        press: (game) => pressJump(game),
        release: (game) => releaseJump(game),
    },
    stomp: {
        id: 'stomp',
        name: 'Stomp',
        category: 'movement',
        netBit: 3,
        binding: { code: 'KeyZ', trigger: 'charge', settingsKey: 'stomp' },
        cooldownSec: 2,
        lastUseKey: 'lastStompTime',
        cooldownKey: 'stompCooldown',
        press(game, now) {
            if (!game.isChargingStomp) game.beginStompCharge?.(now)
        },
        release(game, now) {
            if (game.isChargingStomp) game.releaseStomp?.(now)
        },
    },
    bomb: {
        id: 'bomb',
        name: 'Bomb',
        category: 'combat',
        netBit: 4,
        binding: { code: 'KeyX', trigger: 'press', settingsKey: 'bomb' },
        cooldownSec: 5,
        lastUseKey: 'lastBombTime',
        cooldownKey: 'bombCooldown',
        broadcast: true,
        hudSlot: {
            barKey: 'bombBarEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ff4500)',
        },
        hudIconId: 'bomb',
        activate(game) {
            game.spawnBomb();
            return true;
        },
    },
    missile: {
        id: 'missile',
        name: 'Missile',
        category: 'combat',
        netBit: 5,
        // Was KeyL, which is also camera lock-on (InputSystem); V was unbound
        // (and is the gamepad's B button).
        binding: { code: 'KeyV', trigger: 'press', settingsKey: 'missile' },
        cooldownSec: 1.5,
        lastUseKey: 'lastMissileTime',
        cooldownKey: 'missileCooldown',
        broadcast: true,
        hudSlot: {
            barKey: 'missileBarEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ff8800)',
        },
        hudIconId: 'missile',
        activate(game) {
            game.spawnMissile();
            return true;
        },
    },
    blackhole: {
        id: 'blackhole',
        name: 'Black Hole',
        category: 'combat',
        netBit: 6,
        binding: { code: 'Digit9', trigger: 'press', settingsKey: 'blackhole' },
        cooldownSec: 5,
        lastUseKey: 'lastBlackHoleTime',
        cooldownKey: 'blackHoleCooldown',
        broadcast: true,
        hudSlot: {
            barKey: 'blackHoleBarEl',
            containerKey: 'blackHoleBarContainerEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #aa00ff)',
            activeWhen: 'activeBlackHoles.length',
        },
        hudIconId: 'blackhole',
        activate(game) {
            game.spawnBlackHole();
            return true;
        },
    },
    holo: {
        id: 'holo',
        name: 'Holo Platform',
        category: 'utility',
        netBit: 7,
        binding: { code: 'Backquote', trigger: 'press', settingsKey: 'holo' },
        // Platforms last 3 s (constructs.js); 5 s between casts.
        cooldownSec: 5,
        lastUseKey: 'lastHoloTime',
        cooldownKey: 'holoCooldown',
        broadcast: true,
        hudSlot: {
            barKey: 'holobarEl',
            containerKey: 'holobarContainerEl',
            mode: 'cooldown',
            hideWhenReady: true,
        },
        hudIconId: 'holo',
        activate(game) {
            game.spawnHoloPlatform();
            if (game.hudManager) game.hudManager.markAbilityUsed('holo');
            return true;
        },
    },
    blink: {
        id: 'blink',
        name: 'Blink',
        category: 'movement',
        netBit: 8,
        binding: { code: 'KeyB', trigger: 'press', settingsKey: 'blink' },
        cooldownSec: 2,
        lastUseKey: 'lastBlinkTime',
        cooldownKey: 'blinkCooldown',
        broadcast: true,
        hudSlot: {
            barKey: 'blinkBarEl',
            containerKey: 'blinkBarContainerEl',
            mode: 'cooldown',
            readyGlow: 'brightness(1.2) drop-shadow(0 0 5px #ffcc00)',
        },
        hudIconId: 'blink',
        activate(game) {
            game.triggerBlink();
            return true;
        },
    },
    doublejump: {
        id: 'doublejump',
        name: 'Double Jump',
        category: 'movement',
        netBit: 9,
        impliedBy: 'jump',
        // Fired by the jump's press hook while airborne (jump.js).
        binding: { code: 'Space', trigger: 'poll', settingsKey: 'doublejump' },
    },

    // ── Held movement modifiers: the last six bits (10–15) ──────────────────
    // Continuous forces on the player marble, so prediction / host sim need
    // them held per tick. The bitfield is now full; anything newer is
    // local-only until MAX_NETWORKED_ABILITY_IDS grows (a wire change).
    magnet_attract: {
        id: 'magnet_attract',
        name: 'Magnet (Attract)',
        category: 'utility',
        netBit: 10,
        binding: { code: 'KeyE', trigger: 'hold', settingsKey: 'magnet_attract' },
        requiresMarble: false,
        hudIconId: MAGNET_ICON,
        press(game) {
            game.magnetMode = 'attract';
            game.magnetActive = true;
            if (game.hudManager) game.hudManager.markAbilityUsed(MAGNET_ICON);
        },
        release(game) {
            game.magnetActive = false;
            game.magnetMode = null;
        },
    },
    magnet_repel: {
        id: 'magnet_repel',
        name: 'Magnet (Repel)',
        category: 'utility',
        netBit: 11,
        // Was KeyQ, which is also the air dash.
        binding: { code: 'Minus', trigger: 'hold', settingsKey: 'magnet_repel' },
        requiresMarble: false,
        hudIconId: MAGNET_ICON,
        press(game) {
            game.magnetMode = 'repel';
            game.magnetActive = true;
            if (game.hudManager) game.hudManager.markAbilityUsed(MAGNET_ICON);
        },
        release(game) {
            game.magnetActive = false;
            game.magnetMode = null;
        },
    },
    hover: {
        id: 'hover',
        name: 'Hover',
        category: 'movement',
        netBit: 12,
        binding: { code: 'KeyH', trigger: 'hold', settingsKey: 'hover' },
        hudIconId: 'hover',
        ...heldFlag('hoverActive', 'hover'),
    },
    jetpack: {
        id: 'jetpack',
        name: 'Jetpack',
        category: 'movement',
        netBit: 13,
        binding: { code: 'KeyJ', trigger: 'hold', settingsKey: 'jetpack' },
        hudIconId: 'jetpack',
        ...heldFlag('jetpackActive', 'jetpack'),
    },
    glider: {
        id: 'glider',
        name: 'Glider',
        category: 'movement',
        netBit: 14,
        binding: { code: 'Digit7', trigger: 'hold', settingsKey: 'glider' },
        hudIconId: 'glider',
        ...heldFlag('gliderActive', 'glider'),
    },
    phase: {
        id: 'phase',
        name: 'Phase Shift',
        category: 'utility',
        netBit: 15,
        binding: { code: 'Digit6', trigger: 'hold', settingsKey: 'phase' },
        hudIconId: 'phase',
        ...heldFlag('phaseActive', 'phase'),
    },

    // ── Local-only (netBit: null) ───────────────────────────────────────────
    // The input bitfield is full and these have no remote-side handler yet;
    // other clients see their effects through state snapshots.
    vortex: {
        id: 'vortex',
        name: 'Vortex',
        category: 'combat',
        netBit: null,
        binding: { code: 'KeyY', trigger: 'hold', settingsKey: 'vortex' },
        hudIconId: 'vortex',
        ...heldFlag('vortexActive', 'vortex'),
    },
    violet: {
        id: 'violet',
        name: 'Violet Light',
        category: 'utility',
        netBit: null,
        binding: { code: 'KeyO', trigger: 'hold', settingsKey: 'violet' },
        hudIconId: 'violet',
        ...heldFlag('violetActive', 'violet'),
    },
    rewind: {
        id: 'rewind',
        name: 'Rewind',
        category: 'utility',
        netBit: null, // rewinds local history only
        binding: { code: 'KeyT', trigger: 'hold', settingsKey: 'rewind' },
        requiresMarble: false,
        hudIconId: 'rewind',
        press(game) {
            game.isRewinding = true;
            if (game.hudManager) game.hudManager.markAbilityUsed('rewind');
        },
        release: (game) => endRewind(game),
    },
    focus: {
        id: 'focus',
        name: 'Focus',
        category: 'utility',
        netBit: null, // slows local time only
        // Energy-metered while held: game-loop/logic.js polls isHeld('focus').
        binding: { code: 'KeyF', trigger: 'poll', settingsKey: 'focus' },
        requiresMarble: false,
        energyKey: 'focusEnergy',
        maxEnergyKey: 'maxFocusEnergy',
        hudIconId: 'focus',
    },
    gravitypulse: {
        id: 'gravitypulse',
        name: 'Gravity Pulse',
        category: 'movement',
        netBit: null,
        binding: { code: 'KeyG', trigger: 'press', settingsKey: 'gravitypulse' },
        cooldownSec: 5,
        lastUseKey: 'lastGravityPulseTime',
        cooldownKey: 'gravityPulseCooldown',
        hudIconId: 'gravitypulse',
        activate: (game) => game.fireGravityPulse?.(),
    },
    flip: {
        id: 'flip',
        name: 'Gravity Flip',
        category: 'utility',
        netBit: null,
        binding: { code: 'KeyU', trigger: 'press', settingsKey: 'flip' },
        hudIconId: 'flip',
        activate: (game) => toggleGravityFlip(game),
    },
    tremor: {
        id: 'tremor',
        name: 'Ground Slam',
        category: 'combat',
        netBit: null,
        binding: { code: 'Digit0', trigger: 'press', settingsKey: 'tremor' },
        cooldownSec: 5,
        lastUseKey: 'lastTremorTime',
        cooldownKey: 'tremorCooldown',
        hudIconId: 'groundslam',
        activate: (game) => game.fireTremor?.(),
    },
    build_ramp: buildPiece('build_ramp', 'Build Ramp', 'Digit1', 'ramp'),
    build_floor: buildPiece('build_floor', 'Build Floor', 'Digit2', 'floor'),
    build_bouncer: buildPiece('build_bouncer', 'Build Bouncer', 'Digit3', 'bouncer'),
    portal_a: portal('portal_a', 'Portal A', 'Digit4', 'A'),
    portal_b: portal('portal_b', 'Portal B', 'Digit5', 'B'),
    timestop: {
        id: 'timestop',
        name: 'Time Stop',
        category: 'combat',
        netBit: null, // freezes the local world only
        binding: { code: 'Digit8', trigger: 'press', settingsKey: 'timestop' },
        hudIconId: 'timestop',
        activate: (game) => toggleTimeStop(game),
    },
    teleport: {
        id: 'teleport',
        name: 'Teleport',
        category: 'movement',
        netBit: null,
        binding: { code: 'KeyP', trigger: 'press', settingsKey: 'teleport' },
        cooldownSec: 5,
        lastUseKey: 'lastTeleportTime',
        cooldownKey: 'teleportCooldown',
        hudIconId: 'teleport',
        activate: (game) => game.triggerTeleport(),
    },
    sizeshift: {
        id: 'sizeshift',
        name: 'Size Shift',
        category: 'utility',
        netBit: null,
        binding: { code: 'KeyI', trigger: 'press', settingsKey: 'sizeshift' },
        cooldownSec: 1,
        lastUseKey: 'lastSizeShiftTime',
        cooldownKey: 'sizeShiftCooldown',
        hudIconId: 'size',
        activate: (game) => cycleSizeShift(game),
    },
    emp: {
        id: 'emp',
        name: 'EMP',
        category: 'combat',
        netBit: null,
        binding: { code: 'KeyK', trigger: 'press', settingsKey: 'emp' },
        cooldownSec: 3,
        lastUseKey: 'lastEmpTime',
        cooldownKey: 'empCooldown',
        hudIconId: 'emp',
        activate(game) {
            game.fireEMP?.();
            if (game.hudManager) game.hudManager.markAbilityUsed('emp');
        },
    },
    chameleon: {
        id: 'chameleon',
        name: 'Chameleon',
        category: 'utility',
        netBit: null,
        // Was KeyN, which is also mute.
        binding: { code: 'Equal', trigger: 'press', settingsKey: 'chameleon' },
        cooldownSec: 1,
        lastUseKey: 'lastChameleonTime',
        cooldownKey: 'chameleonCooldown',
        hudIconId: 'chameleon',
        activate: (game) => cycleChameleon(game),
    },
    grapple: {
        id: 'grapple',
        name: 'Grapple',
        category: 'movement',
        // Carried by the input bitfield's dedicated GRAPPLE_BIT status bit.
        netBit: null,
        // Right mouse: InputSystem calls game.startGrapple / stopGrapple, which
        // init/core.js routes through AbilitySystem.pressAbility / releaseAbility.
        binding: { code: 'Mouse2', trigger: 'hold' },
        press: (game) => game.startGrappleRaw?.(),
        release: (game) => game.stopGrappleRaw?.(),
    },
};

/**
 * @param {string} id @param {string} name @param {string} code
 * @param {'ramp' | 'floor' | 'bouncer'} piece
 * @returns {AbilityDefinition}
 */
function buildPiece(id, name, code, piece) {
    return {
        id,
        name,
        category: 'utility',
        netBit: null,
        binding: { code, trigger: 'press', settingsKey: id },
        // spawnBuildPiece checks the marble and spends 25 buildEnergy itself.
        requiresMarble: false,
        hudIconId: 'build',
        activate: (game) => game.spawnBuildPiece(piece),
    };
}

/**
 * @param {string} id @param {string} name @param {string} code @param {'A' | 'B'} which
 * @returns {AbilityDefinition}
 */
function portal(id, name, code, which) {
    return {
        id,
        name,
        category: 'utility',
        netBit: null,
        binding: { code, trigger: 'press', settingsKey: id },
        activate: (game) => game.firePortal(which),
    };
}

/**
 * Keys owned by the game UI / movement, never bindable by an ability
 * (tests/test_ability_bindings.js).
 */
export const RESERVED_KEY_CODES = Object.freeze({
    Escape: 'pause',
    Tab: 'switch marble / ability overlay',
    KeyC: 'camera mode',
    KeyR: 'respawn at checkpoint',
    KeyM: 'menu',
    KeyN: 'mute',
    KeyL: 'camera lock-on',
    BracketLeft: 'volume down',
    BracketRight: 'volume up',
    F2: 'perf monitor',
    KeyW: 'move', KeyA: 'move', KeyS: 'move', KeyD: 'move',
    ArrowUp: 'move', ArrowDown: 'move', ArrowLeft: 'move', ArrowRight: 'move',
    Mouse0: 'shoot', Mouse1: 'lock-on / grapple zip',
});

/** @typedef {keyof typeof ABILITY_REGISTRY} AbilityId */

/** All registered ability ids (default: all enabled). */
export const ALL_ABILITY_IDS = /** @type {AbilityId[]} */ (Object.keys(ABILITY_REGISTRY));

/** Input bitfields reserve bits 8 .. 7+MAX for registry abilities. */
export const MAX_NETWORKED_ABILITY_IDS = 16;

/**
 * @param {string} id
 * @returns {id is AbilityId}
 */
export function isAbilityId(id) {
    return Object.hasOwn(ABILITY_REGISTRY, id);
}

/**
 * Resolve a level mask to the registered ids it enables.
 * `enabled` takes precedence when both lists are present; abilities with
 * `impliedBy` follow their parent in an `enabled` list (so `["jump"]` keeps
 * double jump) unless `disabled` names them explicitly.
 * @param {AbilityMask | null | undefined} mask
 * @returns {AbilityId[]}
 */
export function resolveAbilityMask(mask) {
    if (!mask) return [...ALL_ABILITY_IDS];
    if (Array.isArray(mask.enabled)) {
        const enabled = new Set(mask.enabled.filter(isAbilityId));
        const disabled = new Set(Array.isArray(mask.disabled) ? mask.disabled : []);
        for (const id of ALL_ABILITY_IDS) {
            /** @type {AbilityDefinition} */
            const def = ABILITY_REGISTRY[id];
            if (def.impliedBy && enabled.has(/** @type {AbilityId} */ (def.impliedBy)) && !disabled.has(id)) {
                enabled.add(id);
            }
        }
        return [...enabled];
    }
    if (Array.isArray(mask.disabled)) {
        const disabled = new Set(mask.disabled);
        return ALL_ABILITY_IDS.filter((id) => !disabled.has(id));
    }
    return [...ALL_ABILITY_IDS];
}

/**
 * @param {string} id
 * @returns {AbilityDefinition | undefined}
 */
export function getAbilityDefinition(id) {
    return isAbilityId(id) ? ABILITY_REGISTRY[id] : undefined;
}

// @ts-check
import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
} from '../../abilities/registry.js';

/**
 * What `encodeInputSnapshot` reads on the game. Every member is optional
 * because the encoder falls back to "not pressed / 0" for each.
 * @typedef {Partial<Pick<import('../../types/frame-host.ts').FrameState,
 *   'keys' | 'charging' | 'isChargingJump' | 'isGrappling' | 'aimYaw' | 'pitchAngle'>>
 *   & { abilitySystem?: Pick<import('../systems/ability-system.ts').AbilitySystem, 'getKeyCodes' | 'getKeyCode'> | null }} InputSnapshotHost
 */

/**
 * Abilities with their pinned bitfield index, derived from the registry. Bits
 * come from each entry's `netBit`, not its position, so adding an ability
 * can't shift the meaning of bits already on the wire; `netBit: null`
 * entries are local-only and never encoded.
 * @type {{ id: import('../../abilities/registry.js').AbilityId, bit: number }[]}
 */
export const NETWORKED_ABILITIES = ALL_ABILITY_IDS
    .map((id) => ({ id, bit: /** @type {number | null} */ (ABILITY_REGISTRY[id].netBit) }))
    .filter(/** @returns {e is { id: import('../../abilities/registry.js').AbilityId, bit: number }} */ (e) => e.bit !== null && e.bit >= 0 && e.bit < MAX_NETWORKED_ABILITY_IDS);

/** Movement keys in bit order [0:7]. */
export const MOVEMENT_KEY_CODES = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyS', 'KeyA', 'KeyD',
];

export const MOVEMENT_BITS = 8;
export const ABILITY_BIT_OFFSET = MOVEMENT_BITS;
export const CHARGE_BIT = ABILITY_BIT_OFFSET + MAX_NETWORKED_ABILITY_IDS;
export const GRAPPLE_BIT = CHARGE_BIT + 1;

/**
 * @param {InputSnapshotHost} game
 * @returns {{ bits: number, yaw: number, pitch: number }}
 */
export function encodeInputSnapshot(game) {
    let bits = 0;

    /** @type {Record<string, boolean>} */
    const keys = game.keys || {};
    for (const [i, code] of MOVEMENT_KEY_CODES.entries()) {
        if (keys[code]) {
            bits |= 1 << i;
        }
    }

    for (const { id, bit } of NETWORKED_ABILITIES) {
        /** @type {Array<string | undefined>} */
        const codes = game.abilitySystem?.getKeyCodes?.(id) ?? [game.abilitySystem?.getKeyCode(id)];
        if (codes.some((code) => code && keys[code])) {
            bits |= 1 << (ABILITY_BIT_OFFSET + bit);
        }
    }

    if (game.charging || game.isChargingJump) {
        bits |= 1 << CHARGE_BIT;
    }
    if (game.isGrappling) {
        bits |= 1 << GRAPPLE_BIT;
    }

    const yawDeg = ((game.aimYaw || 0) * 180) / Math.PI;
    const pitchDeg = ((game.pitchAngle || 0) * 180) / Math.PI;

    return {
        bits: bits >>> 0,
        yaw: Math.max(-32768, Math.min(32767, Math.round(yawDeg * 10))),
        pitch: Math.max(-32768, Math.min(32767, Math.round(pitchDeg * 10))),
    };
}

/**
 * @param {number} bits
 * @returns {boolean[]}
 */
export function decodeMovementBits(bits) {
    return MOVEMENT_KEY_CODES.map((_, i) => Boolean(bits & (1 << i)));
}

/**
 * @param {number} bits
 * @returns {{ charging: boolean, isGrappling: boolean }}
 */
export function decodeStatusBits(bits) {
    return {
        charging: Boolean(bits & (1 << CHARGE_BIT)),
        isGrappling: Boolean(bits & (1 << GRAPPLE_BIT)),
    };
}

/**
 * @param {number} bits
 * @returns {string[]}
 */
export function decodeAbilityBits(bits) {
    /** @type {string[]} */
    const active = [];
    for (const { id, bit } of NETWORKED_ABILITIES) {
        if (bits & (1 << (ABILITY_BIT_OFFSET + bit))) {
            active.push(id);
        }
    }
    return active;
}

/**
 * @param {number} yaw
 * @returns {number} radians
 */
export function decodeYaw(yaw) {
    return (yaw / 10) * (Math.PI / 180);
}

/**
 * @param {number} pitch
 * @returns {number} radians
 */
export function decodePitch(pitch) {
    return (pitch / 10) * (Math.PI / 180);
}

/**
 * Round-trip helper for tests.
 * @param {{ bits: number, yaw: number, pitch: number }} snapshot
 * @returns {{ bits: number, yaw: number, pitch: number }}
 */
export function normalizeInputSnapshot(snapshot) {
    return {
        bits: snapshot.bits >>> 0,
        yaw: snapshot.yaw | 0,
        pitch: snapshot.pitch | 0,
    };
}

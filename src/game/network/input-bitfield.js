import {
    ABILITY_REGISTRY,
    ALL_ABILITY_IDS,
    MAX_NETWORKED_ABILITY_IDS,
} from '../../abilities/registry.js';

/**
 * Abilities with their pinned bitfield index. Bits come from each registry
 * entry's `netBit`, not its position, so adding an ability can't shift the
 * meaning of bits already on the wire.
 * @type {{ id: string, bit: number }[]}
 */
const NETWORKED_ABILITIES = ALL_ABILITY_IDS
    .map((id) => ({ id, bit: ABILITY_REGISTRY[id].netBit }))
    .filter(({ bit }) => bit >= 0 && bit < MAX_NETWORKED_ABILITY_IDS);

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
 * @param {object} game
 * @returns {{ bits: number, yaw: number, pitch: number }}
 */
export function encodeInputSnapshot(game) {
    let bits = 0;

    const keys = game.keys || {};
    for (let i = 0; i < MOVEMENT_KEY_CODES.length; i++) {
        if (keys[MOVEMENT_KEY_CODES[i]]) {
            bits |= 1 << i;
        }
    }

    for (const { id, bit } of NETWORKED_ABILITIES) {
        const code = game.abilitySystem?.getKeyCode(id);
        if (code && keys[code]) {
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

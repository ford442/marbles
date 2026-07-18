import { ALL_ABILITY_IDS } from '../../abilities/registry.js';

/** Movement keys in bit order [0:7]. */
export const MOVEMENT_KEY_CODES = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyS', 'KeyA', 'KeyD',
];

const ABILITY_BIT_OFFSET = 8;

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

    for (let i = 0; i < ALL_ABILITY_IDS.length && i < 8; i++) {
        const id = ALL_ABILITY_IDS[i];
        const code = game.abilitySystem?.getKeyCode(id);
        if (code && keys[code]) {
            bits |= 1 << (ABILITY_BIT_OFFSET + i);
        }
    }

    if (game.charging || game.isChargingJump) {
        bits |= 1 << 16;
    }
    if (game.isGrappling) {
        bits |= 1 << 17;
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
 * @returns {string[]}
 */
export function decodeAbilityBits(bits) {
    const active = [];
    for (let i = 0; i < ALL_ABILITY_IDS.length && i < 8; i++) {
        if (bits & (1 << (ABILITY_BIT_OFFSET + i))) {
            active.push(ALL_ABILITY_IDS[i]);
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

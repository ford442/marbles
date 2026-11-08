import { buildPrimitive } from '../zone-setup/primitives.ts';
import { gamePrimitiveHost } from '../zone-setup/primitive-host.js';

const PAD = [0.05, 0.05, 0.15];
const BLOCKER = [1.0, 0.0, 1.0];

/**
 * Neon Hologram: a frictionless cyan slope with four sweeping magenta blockers,
 * a landing pad whose energy updraft launches the marble onto the raised exit.
 * Built from v2 primitives (box/ramp/mover/trigger); offsets are relative to `offset`.
 * Timing window: a straight run clears the blockers when started ~0–0.1 s or ~1.4–2.1 s in.
 * @param {any} game
 * @param {{ x: number, y: number, z: number }} offset
 */
export function createNeonHologramZone(game, offset) {
    const host = gamePrimitiveHost(game);
    /** @type {any[]} */
    const specs = [
        { type: 'box', pos: [0, 0, -5], size: [12, 1, 14], material: 'metal', color: PAD },
        { type: 'ramp', from: [0, 0.5, 2], to: [0, -7.5, 42], width: 12, thickness: 1, material: 'neon_ice', color: [0.0, 1.0, 0.8] },
        { type: 'mover', size: [8, 2, 2], path: [[-8, 0, 12], [8, 0, 12]], period: 3.0, material: 'metal', color: BLOCKER },
        { type: 'mover', size: [8, 2, 2], path: [[8, -1.6, 20], [-8, -1.6, 20]], period: 3.5, material: 'metal', color: BLOCKER },
        { type: 'mover', size: [8, 2, 2], path: [[-8, -3.2, 28], [8, -3.2, 28]], period: 4.0, material: 'metal', color: BLOCKER },
        { type: 'mover', size: [8, 2, 2], path: [[8, -4.8, 36], [-8, -4.8, 36]], period: 4.5, material: 'metal', color: BLOCKER },
        { type: 'box', pos: [0, -8, 52], size: [16, 1, 20], material: 'metal', color: PAD },
        { type: 'trigger', pos: [0, -7.2, 58], size: [8, 0.6, 4], do: { boost: [0, 14, 6] }, color: [0.0, 1.0, 0.0] },
        { type: 'box', pos: [0, 0, 82], size: [16, 1, 16], material: 'metal', color: PAD },
    ];
    for (const spec of specs) buildPrimitive(host, spec, offset);
}

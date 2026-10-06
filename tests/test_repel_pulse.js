/**
 * test_repel_pulse.js
 *
 * Shield / Violet Light repel pulse: the batched path (computeForceFieldsBatch
 * with falloffExp = 0) must produce the same impulses as the original
 * per-body formula `(body − player) / dist · force · mass (+ yPop on y)`.
 *
 * Run with:
 *   node tests/test_repel_pulse.js
 */

import { applyRepelPulse } from '../src/game-loop/repel-pulse.js';
import { FORCE_BATCH_THRESHOLD } from '../src/wasm-bridge.js';

let pass = 0;
let fail = 0;

function test(name, got, expected) {
    if (got === expected) {
        console.log(`  ✅  ${name}`);
        pass++;
    } else {
        console.error(`  ❌  ${name}\n       got:      ${got}\n       expected: ${expected}`);
        fail++;
    }
}

function makeBody(x, y, z, mass) {
    return {
        impulse: null,
        translation: () => ({ x, y, z }),
        mass: () => mass,
        applyImpulse(imp) { this.impulse = imp; },
    };
}

/** The pre-batching Shield/Violet loop, kept verbatim as the reference. */
function referenceImpulse(body, playerPos, radius, force, yPop) {
    const p = body.translation();
    const dx = p.x - playerPos.x;
    const dy = p.y - playerPos.y;
    const dz = p.z - playerPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (!(distSq < radius * radius && distSq > 0.001)) return null;
    const dist = Math.sqrt(distSq);
    return {
        x: (dx / dist) * force * body.mass(),
        y: (dy / dist) * force * body.mass() + yPop,
        z: (dz / dist) * force * body.mass(),
    };
}

function runCase(label, inRangeCount, radius, force, yPop) {
    const playerPos = { x: 2, y: 1, z: -3 };
    const playerRb = makeBody(playerPos.x, playerPos.y, playerPos.z, 1);
    const bodies = [];
    for (let i = 0; i < inRangeCount; i++) {
        const angle = i * 2.399;
        // spread from 0.2·r up to just inside the edge (0.99·r)
        const r = radius * (0.2 + 0.79 * (i / Math.max(1, inRangeCount - 1)));
        bodies.push(makeBody(
            playerPos.x + Math.cos(angle) * r * 0.8,
            playerPos.y + (i % 2 ? 0.6 : -0.6) * r * 0.6 * Math.abs(Math.sin(angle)),
            playerPos.z + Math.sin(angle) * r * 0.6,
            0.5 + (i % 4)
        ));
    }
    // Out of range, coincident with the player, and the player itself: untouched.
    bodies.push(makeBody(playerPos.x + radius * 1.5, playerPos.y, playerPos.z, 1));
    bodies.push(makeBody(playerPos.x, playerPos.y, playerPos.z, 1));

    const game = { playerMarble: { rigidBody: playerRb }, dynamicBodies: new Set([playerRb, ...bodies]) };
    applyRepelPulse(game, radius, force, yPop);

    let ok = true;
    let hit = 0;
    for (const body of bodies) {
        const expected = referenceImpulse(body, playerPos, radius, force, yPop);
        if (expected === null) {
            if (body.impulse !== null) ok = false;
            continue;
        }
        if (!body.impulse) { ok = false; continue; }
        hit++;
        for (const k of ['x', 'y', 'z']) {
            if (!(Math.abs(body.impulse[k] - expected[k]) < 1e-4)) ok = false;
        }
    }
    test(`${label}: impulses match per-body reference`, ok, true);
    test(`${label}: ${inRangeCount} bodies pushed`, hit, inRangeCount);
    test(`${label}: player not pushed`, playerRb.impulse, null);
}

console.log('applyRepelPulse');
runCase('Shield, scalar path', FORCE_BATCH_THRESHOLD, 5.0, 3.0, 1.0);
runCase('Shield, batch path', FORCE_BATCH_THRESHOLD + 5, 5.0, 3.0, 1.0);
runCase('Violet, scalar path', 3, 15.0, 0.5, 0);
runCase('Violet, batch path', 40, 15.0, 0.5, 0);

console.log(`\n${pass + fail} tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

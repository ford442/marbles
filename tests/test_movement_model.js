/**
 * movementModel 2: held-key impulse scales with mass, so every marble class
 * accelerates like the reference marble; model 1 (legacy) keeps the flat
 * impulse. For the reference marble both models are identical, which is what
 * keeps recorded level solutions valid.
 */
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { BASE_MOVE_IMPULSE, REFERENCE_MASS, moveImpulsePerStep } from '../src/game/movement-model.js';
import { REFERENCE_MARBLE } from '../src/game/headless/headless-level.js';

console.log('test_movement_model.js');

assert.equal(moveImpulsePerStep(undefined, 3), BASE_MOVE_IMPULSE);
assert.equal(moveImpulsePerStep(1, 3), BASE_MOVE_IMPULSE);
assert.equal(moveImpulsePerStep(2, NaN), BASE_MOVE_IMPULSE, 'falls back when mass is unknown');
assert.ok(Math.abs(moveImpulsePerStep(2, REFERENCE_MASS) - BASE_MOVE_IMPULSE) < 1e-12, 'reference marble unchanged');

await RAPIER.init();

/** Speed after 60 held-forward steps on a flat floor. */
function speedAfterOneSecond(model, density) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0).setFriction(0.5));
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, REFERENCE_MARBLE.radius, 0)
        .setLinearDamping(REFERENCE_MARBLE.linearDamping).setAngularDamping(REFERENCE_MARBLE.angularDamping).setCanSleep(false));
    world.createCollider(RAPIER.ColliderDesc.ball(REFERENCE_MARBLE.radius).setFriction(REFERENCE_MARBLE.friction)
        .setRestitution(REFERENCE_MARBLE.restitution).setDensity(density), rb);
    for (let i = 0; i < 10; i++) world.step(); // settle
    for (let i = 0; i < 60; i++) {
        rb.applyImpulse({ x: 0, y: 0, z: moveImpulsePerStep(model, rb.mass()) }, true);
        world.step();
    }
    const v = rb.linvel();
    const s = Math.hypot(v.x, v.z);
    world.free();
    return s;
}

// Per-marble-class tolerance: relative speed deviation from the reference
// marble allowed under model 2 (rolling contact adds a little mass-dependent noise).
const CLASSES = [
    { name: 'light', density: 0.5, tolerance: 0.02 },
    { name: 'reference', density: REFERENCE_MARBLE.density, tolerance: 1e-9 },
    { name: 'heavy', density: 4, tolerance: 0.02 },
];
const ref = speedAfterOneSecond(2, REFERENCE_MARBLE.density);
assert.ok(Math.abs(speedAfterOneSecond(1, REFERENCE_MARBLE.density) - ref) < 1e-9, 'models agree for the reference marble');
for (const c of CLASSES) {
    const v2 = speedAfterOneSecond(2, c.density);
    assert.ok(Math.abs(v2 - ref) / ref <= c.tolerance, `${c.name}: model 2 speed ${v2.toFixed(3)} vs reference ${ref.toFixed(3)}`);
}
// Model 1 really is mass-dependent (the gap model 2 closes).
assert.ok(speedAfterOneSecond(1, 0.5) > ref * 2, 'legacy model: light marble accelerates much harder');
console.log(`✓ movementModel 2 gives every marble class the reference acceleration (${ref.toFixed(2)} m/s after 1 s)`);

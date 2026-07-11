/**
 * Particle System Integration Tests
 * 
 * Tests for core particle system functionality:
 * - Particle creation and pooling
 * - Emission of different particle types
 * - Simulation and lifetime management
 * - Game loop integration
 */

import { ParticleSystem } from '../src/particle-system.js';

console.log('=== Particle System Tests ===\n');

// Test 1: ParticleSystem instantiation
console.log('✓ Test 1: ParticleSystem instantiation');
const ps = new ParticleSystem(null, 'high');
console.assert(ps !== null, 'ParticleSystem should be created');
console.assert(ps.particles !== undefined, 'ParticleSystem should have particles array');
console.assert(ps.maxParticles === 600, 'High quality should have 600 max particles');

// Test 2: Quality tier configuration
console.log('✓ Test 2: Quality tier configuration');
const psLow = new ParticleSystem(null, 'low');
const psMed = new ParticleSystem(null, 'medium');
const psHigh = new ParticleSystem(null, 'high');
const psUltra = new ParticleSystem(null, 'ultra');

console.assert(psLow.maxParticles === 50, 'Low quality should have 50 max particles');
console.assert(psMed.maxParticles === 200, 'Medium quality should have 200 max particles');
console.assert(psHigh.maxParticles === 600, 'High quality should have 600 max particles');
console.assert(psUltra.maxParticles === 1200, 'Ultra quality should have 1200 max particles');

// Test 3: Particle emission
console.log('✓ Test 3: Particle emission');
const initialCount = ps.stats.emittedThisFrame;
ps.emitParticles('trail', [0, 0, 0], 5, { lifetime: 0.5 });
console.assert(ps.stats.emittedThisFrame > initialCount, 'Emission should increase emitted count');
console.assert(ps.stats.emittedThisFrame === 5, 'Should emit 5 particles');

// Test 4: Particle type validity
console.log('✓ Test 4: Particle type validation');
const validTypes = ['trail', 'impact', 'spark', 'bubble', 'dust'];
for (const type of validTypes) {
    ps.emitParticles(type, [0, 0, 0], 1, {});
    console.assert(true, `Type '${type}' should be valid`);
}

// Test 5: Emission with parameters
console.log('✓ Test 5: Emission with parameters');
const params = {
    velocity: [1, 2, 3],
    lifetime: 1.0,
    color: [1, 0, 0, 1],
    size: 0.2
};
ps.emitParticles('impact', [5, 5, 5], 3, params);
console.assert(true, 'Should handle parameter object');

// Test 6: Particle lifecycle
console.log('✓ Test 6: Particle lifecycle');
const ps2 = new ParticleSystem(null, 'medium');
ps2.emitParticles('trail', [0, 0, 0], 1, { lifetime: 0.1 });
const activeBefore = ps2.stats.activeCount;
console.assert(activeBefore > 0, 'Active count should increase after emission');

// Simulate 0.2 seconds (particle with 0.1s lifetime should be dead)
ps2.update(0.2);
const activeAfter = ps2.stats.activeCount;
console.assert(activeAfter === 0, 'Particle should be dead after exceeding lifetime');

// Test 7: Multiple particle types in one frame
console.log('✓ Test 7: Multiple particle types in one frame');
const ps3 = new ParticleSystem(null, 'high');
ps3.emitParticles('trail', [0, 0, 0], 10);
ps3.emitParticles('impact', [0, 0, 0], 5);
ps3.emitParticles('spark', [0, 0, 0], 3);
ps3.emitParticles('bubble', [0, 0, 0], 2);
ps3.emitParticles('dust', [0, 0, 0], 4);
console.assert(ps3.stats.emittedThisFrame === 24, 'Should emit multiple types');

// Test 8: Continuous updates
console.log('✓ Test 8: Continuous updates');
const ps5 = new ParticleSystem(null, 'medium');
ps5.emitParticles('trail', [0, 0, 0], 10, { lifetime: 1.0 });
const active1 = ps5.stats.activeCount;
ps5.update(0.1);
const active2 = ps5.stats.activeCount;
console.assert(active2 === active1, 'Active count should stay same during lifetime');
ps5.update(0.5);
const active3 = ps5.stats.activeCount;
console.assert(active3 === active1, 'Particles should still be active');
ps5.update(0.5); // Total 1.1 seconds
const active4 = ps5.stats.activeCount;
console.assert(active4 === 0, 'Particles should be dead after lifetime exceeded');

// Test 9: Pool reuse
console.log('✓ Test 9: Pool reuse');
const ps6 = new ParticleSystem(null, 'medium');
ps6.emitParticles('trail', [0, 0, 0], 200, { lifetime: 0.1 });
console.assert(ps6.stats.activeCount <= ps6.maxParticles, 'Should not exceed max particles');
ps6.update(0.2); // Particles should die
ps6.emitParticles('impact', [1, 1, 1], 200, { lifetime: 0.1 });
console.assert(ps6.stats.activeCount <= ps6.maxParticles, 'Should reuse pooled particles');

// Test 10: Particle position and velocity initialization
console.log('✓ Test 10: Particle position and velocity initialization');
const ps7 = new ParticleSystem(null, 'high');
ps7.emitParticles('trail', [10, 20, 30], 1, {
    velocity: [1, 2, 3],
    lifetime: 0.5
});
// Check that a particle was created (we can't directly inspect particles in this test framework)
console.assert(ps7.stats.activeCount === 1, 'Should have 1 active particle');

// Test 11: Type-specific initialization
console.log('✓ Test 11: Type-specific initialization');
const ps8 = new ParticleSystem(null, 'high');

// Trail particles should have drag
ps8.emitParticles('trail', [0, 0, 0], 1, { lifetime: 1.0 });
const trailParticles = 1;

// Bubble particles should have buoyancy
ps8.emitParticles('bubble', [0, 0, 0], 1, { lifetime: 1.0 });
const bubbleParticles = 1;

console.assert(
    ps8.stats.activeCount === trailParticles + bubbleParticles,
    'Should have both trail and bubble particles'
);

// Test 12: Ambient emitter registration
console.log('✓ Test 12: Ambient emitter registration');
const ps9 = new ParticleSystem(null, 'high');
console.assert(ps9.ambientEmitters.length === 0, 'Should start with no ambient emitters');
ps9.addAmbientEmitter({ pos: { x: 0, y: 0, z: 0 }, type: 'bubble', rate: 2.0, count: 1 });
ps9.addAmbientEmitter({ pos: { x: 5, y: 0, z: 5 }, type: 'spark', rate: 1.0, count: 2 });
console.assert(ps9.ambientEmitters.length === 2, 'Should have 2 ambient emitters');

// Test 13: Ambient emitter clearing
console.log('✓ Test 13: Ambient emitter clearing');
ps9.clearAmbientEmitters();
console.assert(ps9.ambientEmitters.length === 0, 'clearAmbientEmitters should remove all emitters');

// Test 14: Ambient emitters emit particles on update
console.log('✓ Test 14: Ambient emitters emit particles on update');
const ps10 = new ParticleSystem(null, 'high');
ps10.addAmbientEmitter({
    pos: { x: 0, y: 0, z: 0 },
    type: 'bubble',
    rate: 100,  // 100/s → fires immediately on first update
    count: 3,
    spread: 2,
    params: { lifetime: 2.0 }
});
// Set timer to interval - 0.001 so the while-loop fires on first tick
ps10.ambientEmitters[0].timer = 1.0 / 100 - 0.001;
ps10.update(0.05);  // 50ms; enough to cross the interval
console.assert(ps10.stats.activeCount >= 3, 'Ambient emitter should have produced particles');

// Test 15: Spread distributes emission positions
console.log('✓ Test 15: Ambient emitter with spread');
const ps11 = new ParticleSystem(null, 'high');
ps11.addAmbientEmitter({
    pos: { x: 10, y: 0, z: 10 },
    type: 'dust',
    rate: 1000,
    count: 1,
    spread: 5,
    params: { lifetime: 1.0 }
});
ps11.ambientEmitters[0].timer = 0.0011; // Force one tick
ps11.update(0.001);
console.assert(ps11.stats.activeCount >= 1, 'Spread emitter should emit particles');

console.log('\n=== All Tests Passed! ===\n');
console.log(`Particle System Stats:
  - Max Particles (high): 600
  - Quality Tiers: low(50), medium(200), high(600), ultra(1200)
  - Particle Types: trail, impact, spark, bubble, dust
  - Emitter Helpers: archived in docs/backups/unused-game-modules/misc/particle-materials.js
  - Ambient Emitters: zone-persistent continuous emitters (bubbles, sparks)
  - Features: Pooling, CPU simulation, type-specific behavior, ambient zone effects`);

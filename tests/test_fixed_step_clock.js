import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {
    DEFAULT_FIXED_STEP,
    FixedStepClock,
    MAX_FRAME_DT,
} from '../src/game/systems/fixed-step-clock.ts';

await RAPIER.init();

function testStepsAccumulate() {
    const clock = new FixedStepClock({ step: 1 / 60 });
    assert.equal(clock.advance(1 / 120), 0);
    assert.ok(Math.abs(clock.alpha - 0.5) < 1e-6);
    assert.equal(clock.advance(1 / 120), 1, 'two half-steps make exactly one step');
    assert.ok(clock.alpha < 1e-6);
    assert.equal(clock.advance(1 / 30), 2);
    assert.ok(Math.abs(clock.lastSimDt - 2 / 60) < 1e-12);
}

function testSubstepCapDropsBacklog() {
    const clock = new FixedStepClock({ step: 1 / 60, maxSubsteps: 5 });
    assert.equal(clock.advance(MAX_FRAME_DT), 5);
    assert.equal(clock.accumulator, 0, 'excess time is dropped, not carried');
    assert.equal(clock.advance(10), 5, 'huge frames are clamped too');
}

function testTimeScaleScalesAccumulatedTime() {
    const clock = new FixedStepClock({ step: 1 / 60 });
    clock.timeScale = 0.25;
    let steps = 0;
    for (let i = 0; i < 240; i++) steps += clock.advance(1 / 60);
    assert.equal(steps, 60, '4 s of wall time at 0.25× is 1 s simulated');

    clock.timeScale = 0;
    assert.equal(clock.advance(1), 0);
}

function testBadInputIsIgnored() {
    const clock = new FixedStepClock();
    assert.equal(clock.advance(-1), 0);
    assert.equal(clock.advance(Number.NaN), 0);
    assert.equal(clock.step, DEFAULT_FIXED_STEP);
    assert.throws(() => new FixedStepClock({ step: 0 }));
}

/**
 * Drive a headless Rapier world from the clock at a given display rate for
 * `seconds` of wall time; return the ball's simulated displacement.
 */
function simulateAtRefreshRate(hz, seconds) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 100, 0).setLinvel(5, 0, 0),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.5), body);

    const clock = new FixedStepClock();
    world.timestep = clock.step;
    const frames = Math.round(seconds * hz);
    for (let f = 0; f < frames; f++) {
        const steps = clock.advance(1 / hz);
        for (let i = 0; i < steps; i++) world.step();
    }
    const t = body.translation();
    return Math.hypot(t.x, t.y - 100, t.z);
}

function testSameDistanceAcrossRefreshRates() {
    const seconds = 2;
    const reference = simulateAtRefreshRate(60, seconds);
    assert.ok(reference > 10, `ball should have moved (got ${reference})`);
    for (const hz of [30, 60, 144, 240]) {
        const d = simulateAtRefreshRate(hz, seconds);
        const err = Math.abs(d - reference) / reference;
        assert.ok(err <= 0.01, `${hz} Hz: ${d.toFixed(3)} vs ${reference.toFixed(3)} (${(err * 100).toFixed(2)}%)`);
    }
}

testStepsAccumulate();
testSubstepCapDropsBacklog();
testTimeScaleScalesAccumulatedTime();
testBadInputIsIgnored();
testSameDistanceAcrossRefreshRates();
console.log('Fixed-step clock tests passed');

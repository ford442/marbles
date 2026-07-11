import assert from 'node:assert/strict';
import {
    isCooldownReady,
    cooldownRemainingMs,
    cooldownFillRatio,
} from '../src/game/systems/ability-cooldown.js';
import {
    computeLandingTrickScore,
    applyComboMultiplier,
} from '../src/game/systems/trick-scoring.js';

function testCooldownReady() {
    assert.equal(isCooldownReady(1000, 500, 1600), true);
    assert.equal(isCooldownReady(1000, 500, 1400), false);
    assert.equal(cooldownRemainingMs(1000, 500, 1200), 300);
    assert.equal(cooldownFillRatio(0, 1000, 250), 0.25);
}

function testLandingTrickScore() {
    const { points, messages } = computeLandingTrickScore({
        airTime: 80,
        flips: Math.PI * 2.5,
        rolls: 0,
        spin: 0,
        wallRides: 0,
        wallBounces: 0,
        maxAltitude: 30,
        startAltitude: 10,
    });
    assert.ok(points >= 360, 'flip + air + sky high should score');
    assert.ok(messages.includes('x2 Flip') || messages.includes('Front Flip'));
    assert.ok(messages.includes('Sky High!'));
}

function testComboMultiplier() {
    assert.equal(applyComboMultiplier(50, 3), 150);
    assert.equal(applyComboMultiplier(50, 0), 50);
    assert.equal(applyComboMultiplier(50, 99), 500);
}

testCooldownReady();
testLandingTrickScore();
testComboMultiplier();
console.log('All game subsystem tests passed');

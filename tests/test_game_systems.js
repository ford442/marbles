import assert from 'node:assert/strict';
import {
    isCooldownReady,
    cooldownRemainingMs,
    cooldownFillRatio,
} from '../src/game/systems/ability-cooldown.ts';
import {
    computeLandingTrickScore,
    applyComboMultiplier,
} from '../src/game/systems/trick-scoring.ts';
import { creationMethods } from '../src/zones/methods/creation.js';
import { installZoneMethods } from '../src/zones/methods/index.js';

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

function testZoneCreationMethods() {
    const expectedMethods = [
        'createCheckpointZone',
        'createMovingZone',
        'createPowerUpZone',
        'createPyramidZone',
        'createDominoZone',
        'createFloorZone',
        'createTrackZone',
        'createSpiralZone',
        'createBlockZone',
        'createLoopZone',
        'createZigZagZone',
        'createNeonCityZone',
        'createLandingZone',
        'createBowlingZone',
        'createCastleZone',
        'createJumpZone',
        'createSlalomZone',
        'createStaircaseZone',
        'createSplitZone',
        'createForestZone',
        'createGoalZone',
        'createOrchardZone',
        'createTree',
        'createCollectiblePickup',
        'createGrappleAnchorZone',
    ];

    for (const methodName of expectedMethods) {
        assert.equal(typeof creationMethods[methodName], 'function', `Missing method: ${methodName}`);
    }

    class DummyGame {}
    installZoneMethods(DummyGame);
    for (const methodName of expectedMethods) {
        assert.equal(typeof DummyGame.prototype[methodName], 'function', `Method not installed: ${methodName}`);
    }
}

testCooldownReady();
testLandingTrickScore();
testComboMultiplier();
testZoneCreationMethods();
console.log('All game subsystem tests passed');

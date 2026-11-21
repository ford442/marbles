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
import { ZONE_METHOD_SLICES } from '../src/zones/methods/index.js';
import { composeSlices, forwardSliceMethods } from '../src/game/systems/slice-composition.ts';

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

    const forwarded = new Set(ZONE_METHOD_SLICES.flatMap((spec) => spec.methods));
    for (const methodName of expectedMethods) {
        assert.ok(forwarded.has(methodName), `Missing zone method: ${methodName}`);
    }

    class DummyGame {
        constructor() { composeSlices(this, ZONE_METHOD_SLICES); }
    }
    forwardSliceMethods(DummyGame, ZONE_METHOD_SLICES);
    const game = new DummyGame();
    for (const methodName of expectedMethods) {
        assert.equal(typeof DummyGame.prototype[methodName], 'function', `Method not forwarded: ${methodName}`);
    }
    for (const spec of ZONE_METHOD_SLICES) {
        assert.equal(game[spec.key].game, game, `${spec.key} is composed against the game`);
    }
}

testCooldownReady();
testLandingTrickScore();
testComboMultiplier();
testZoneCreationMethods();
console.log('All game subsystem tests passed');

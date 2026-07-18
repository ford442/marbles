import assert from 'node:assert/strict';
import {
    resolveLodWithHysteresis,
    selectMarbleLodLevel,
    projectScreenRadiusPx,
    LOD_DISTANCE,
    LOD_HYSTERESIS_M,
} from '../src/marble-lod.js';

function testResolveLodWithHysteresis() {
    assert.equal(resolveLodWithHysteresis(1, 5), 0);
    assert.equal(resolveLodWithHysteresis(1, LOD_DISTANCE.lod1 - LOD_HYSTERESIS_M - 0.1), 0);
    assert.equal(resolveLodWithHysteresis(0, LOD_DISTANCE.lod1 + LOD_HYSTERESIS_M + 0.1), 1);
    assert.equal(resolveLodWithHysteresis(1, LOD_DISTANCE.lod2 + LOD_HYSTERESIS_M + 0.1), 2);
    assert.equal(resolveLodWithHysteresis(2, LOD_DISTANCE.lod2 - LOD_HYSTERESIS_M - 0.1), 1);
}

function testPlayerAlwaysLod0ExceptLowQuality() {
    assert.equal(selectMarbleLodLevel({ isPlayer: true, distance: 100, quality: 'high' }), 0);
    assert.equal(selectMarbleLodLevel({ isPlayer: true, distance: 100, quality: 'low' }), 1);
}

function testMediumQualityCapsLod0() {
    const capped = selectMarbleLodLevel({
        currentLod: 0,
        distance: 5,
        isPlayer: false,
        allowLod0: false,
        quality: 'medium',
    });
    assert.equal(capped, 1);

    const nearWithoutAllow = selectMarbleLodLevel({
        currentLod: 1,
        distance: 5,
        isPlayer: false,
        allowLod0: false,
        quality: 'medium',
    });
    assert.equal(nearWithoutAllow, 1);
}

function testLowQualityGlobalCap() {
    assert.equal(selectMarbleLodLevel({
        currentLod: 0,
        distance: 5,
        quality: 'low',
    }), 1);
    assert.equal(selectMarbleLodLevel({
        currentLod: 2,
        distance: 80,
        quality: 'low',
    }), 2);
}

function testForceMaxLodHook() {
    assert.equal(selectMarbleLodLevel({
        isPlayer: true,
        distance: 1,
        quality: 'ultra',
        forceMaxLod: 2,
    }), 2);
}

function testScreenRadiusProjection() {
    const px = projectScreenRadiusPx(0.5, 10, 1080, 45);
    assert.ok(px > 20 && px < 80, `expected reasonable screen radius, got ${px}`);
}

function testAllowLod0PromotionByScreenSize() {
    const lod = selectMarbleLodLevel({
        currentLod: 1,
        distance: LOD_DISTANCE.lod1 - 1,
        screenRadiusPx: 40,
        allowLod0: true,
        quality: 'high',
    });
    assert.equal(lod, 0);
}

testResolveLodWithHysteresis();
testPlayerAlwaysLod0ExceptLowQuality();
testMediumQualityCapsLod0();
testLowQualityGlobalCap();
testForceMaxLodHook();
testScreenRadiusProjection();
testAllowLod0PromotionByScreenSize();

console.log('marble LOD tests passed');

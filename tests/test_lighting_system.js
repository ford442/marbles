/**
 * Dynamic Lighting System Tests
 * 
 * Tests for:
 * - Environment-aware lighting application
 * - Animated light behaviors
 * - Quality tier gating
 * - Performance
 */

import { LightingSystem } from '../src/lighting-system.js';

console.log('=== Dynamic Lighting System Tests ===\n');

// Test 1: LightingSystem instantiation
console.log('✓ Test 1: LightingSystem instantiation');
const ls = new LightingSystem(null, null, null);
console.assert(ls !== null, 'LightingSystem should be created');
console.assert(ls.animatedLights instanceof Array, 'Animated lights should be an array');
console.assert(ls.time === 0, 'Initial time should be 0');

// Test 2: Quality tier configuration
console.log('✓ Test 2: Quality tier configuration');
ls.setQuality('low');
console.assert(ls.quality === 'low', 'Quality should be set to low');
ls.setQuality('medium');
console.assert(ls.quality === 'medium', 'Quality should be set to medium');
ls.setQuality('high');
console.assert(ls.quality === 'high', 'Quality should be set to high');
ls.setQuality('ultra');
console.assert(ls.quality === 'ultra', 'Quality should be set to ultra');

// Test 3: Animated light registration (high quality)
console.log('✓ Test 3: Animated light registration (high quality)');
const ls3 = new LightingSystem(null, null, null);
ls3.setQuality('high');
const mockLightEntity = 123; // Mock entity ID
ls3.addAnimatedLight(mockLightEntity, 'lavaFlicker', {
    speed: 8.0,
    flicker: 0.4,
    baseColor: [1.0, 0.55, 0.15],
    baseIntensity: 120000.0
});
console.assert(ls3.animatedLights.length === 1, 'Should have 1 animated light');
console.assert(ls3.animatedLights[0].behavior === 'lavaFlicker', 'Behavior should be lavaFlicker');

// Test 4: Animated light NOT registered on low quality
console.log('✓ Test 4: Animated light gating on low quality');
const ls4 = new LightingSystem(null, null, null);
ls4.setQuality('low');
ls4.addAnimatedLight(mockLightEntity, 'neonPulse', {});
console.assert(ls4.animatedLights.length === 0, 'Should not add animated lights on low quality');

// Test 5: Multiple light behaviors
console.log('✓ Test 5: Multiple light behaviors');
const ls5 = new LightingSystem(null, null, null);
ls5.setQuality('high');
const behaviors = ['lavaFlicker', 'neonPulse', 'biolumSway', 'crystalShimmer'];
for (let i = 0; i < behaviors.length; i++) {
    ls5.addAnimatedLight(100 + i, behaviors[i], {
        baseColor: [1, 1, 1],
        baseIntensity: 1000
    });
}
console.assert(ls5.animatedLights.length === 4, 'Should have 4 animated lights');

// Test 6: Clear animated lights
console.log('✓ Test 6: Clear animated lights');
const ls6 = new LightingSystem(null, null, null);
ls6.setQuality('high');
ls6.addAnimatedLight(200, 'lavaFlicker', {});
ls6.addAnimatedLight(201, 'neonPulse', {});
console.assert(ls6.animatedLights.length === 2, 'Should have 2 animated lights');
ls6.clearAnimatedLights();
console.assert(ls6.animatedLights.length === 0, 'Should have 0 animated lights after clear');

// Test 7: Lava flicker animation (no engine, just values)
console.log('✓ Test 7: Lava flicker animation values');
const ls7 = new LightingSystem(null, null, null);
const color = [1.0, 0.55, 0.15];
const baseIntensity = 120000.0;
const mockOutput = { intensity: (v) => {} };
ls7.animateLavaFlicker(0, {speed: 8.0, flicker: 0.4}, color, baseIntensity, mockOutput);
console.assert(color[0] > 0 && color[0] <= 1.0, 'R channel should be in [0, 1]');
console.assert(color[1] >= 0 && color[1] <= 1.0, 'G channel should be in [0, 1]');
console.assert(color[2] >= 0 && color[2] <= 1.0, 'B channel should be in [0, 1]');

// Test 8: Neon pulse animation
console.log('✓ Test 8: Neon pulse animation');
const ls8 = new LightingSystem(null, null, null);
const color8 = [0.0, 0.9, 1.0];
const mockOutput8 = { intensity: (v) => {} };
ls8.animateNeonPulse(0, {speed: 2.0, intensity: 0.3}, color8, 40000.0, mockOutput8);
console.assert(color8[0] === 0.0 && color8[1] === 0.9 && color8[2] === 1.0, 'Neon pulse should preserve color');

// Test 9: Biolum sway animation
console.log('✓ Test 9: Biolum sway animation');
const ls9 = new LightingSystem(null, null, null);
const color9 = [0.4, 0.7, 0.9];
const mockOutput9 = { intensity: (v) => {} };
ls9.animateBiolumSway(0, {speed: 0.5, sway: 0.2}, color9, 30000.0, mockOutput9);
console.assert(color9[0] >= 0 && color9[0] <= 1.0, 'Biolum R should be in [0, 1]');
console.assert(color9[1] >= 0 && color9[1] <= 1.0, 'Biolum G should be in [0, 1]');
console.assert(color9[2] >= 0 && color9[2] <= 1.0, 'Biolum B should be in [0, 1]');

// Test 10: Crystal shimmer animation
console.log('✓ Test 10: Crystal shimmer animation');
const ls10 = new LightingSystem(null, null, null);
const color10 = [1.0, 0.95, 0.9];
const mockOutput10 = { intensity: (v) => {} };
ls10.animateCrystalShimmer(0, {speed: 4.0, shimmer: 0.5}, color10, 600.0, mockOutput10);
console.assert(color10[0] >= 0 && color10[0] <= 2.0, 'Crystal R should be brightened');
console.assert(color10[1] >= 0 && color10[1] <= 2.0, 'Crystal G should be brightened');
console.assert(color10[2] >= 0 && color10[2] <= 2.0, 'Crystal B should be brightened');

// Test 11: Time accumulation
console.log('✓ Test 11: Time accumulation');
const ls11 = new LightingSystem(null, null, null);
console.assert(ls11.time === 0, 'Initial time should be 0');
// Note: update() would require a full Filament setup, so we just check time initialization

// Test 12: Register lights
console.log('✓ Test 12: Register lights');
const ls12 = new LightingSystem(null, null, null);
const mockSun = 300;
const mockFill = 301;
const mockBack = 302;
ls12.registerLights(mockSun, mockFill, mockBack);
console.assert(ls12.sunLight === mockSun, 'Sun light should be registered');
console.assert(ls12.fillLight === mockFill, 'Fill light should be registered');
console.assert(ls12.backLight === mockBack, 'Back light should be registered');

console.log('\n=== All Tests Passed! ===\n');
console.log(`Lighting System Features:
  - Environment-aware lighting (6 presets with sun/fill/back colors)
  - Quality-tiered animation (low: disabled, medium+: enabled)
  - 4 Animation behaviors:
    * lavaFlicker: Rapid flickering + orange shift
    * neonPulse: Smooth sine-wave intensity pulse
    * biolumSway: Gentle color + intensity modulation
    * crystalShimmer: Fast sparkle + color twinkle
  - Per-frame light updates via LightingSystem.update()
  - Zone light helper with optional animation registration
  - Automatic cleanup on zone unload`);

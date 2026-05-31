/**
 * Tests for per-environment color grading system
 * 
 * Run with: node tests/test_color_grading.js
 */

import { getColorGradingConfig, getEnvironmentColorGradingPreset } from '../src/rendering/post-fx-presets.js';

console.log('=== Testing Per-Environment Color Grading ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

// Test 1: Quality tier base configs
console.log('Test 1: Quality tier base configs');
['low', 'medium', 'high', 'ultra'].forEach(q => {
    const cfg = getColorGradingConfig(q);
    assert(cfg.contrast >= 1.0 && cfg.contrast <= 1.5, `${q}: contrast in valid range (${cfg.contrast})`);
    assert(cfg.saturation >= 0.8 && cfg.saturation <= 1.5, `${q}: saturation in valid range (${cfg.saturation})`);
});

// Test 2: Default environment returns empty object (quality base used as-is)
console.log('\nTest 2: Default environment uses quality baseline');
const defaultPreset = getEnvironmentColorGradingPreset('default');
assert(Object.keys(defaultPreset).length === 0, 'default preset returns empty object');

// Test 3: Volcanic environment — punchy, warm
console.log('\nTest 3: Volcanic environment grading');
const volcanic = getEnvironmentColorGradingPreset('volcanic');
const baseHigh = getColorGradingConfig('high');
assert(volcanic.contrast > baseHigh.contrast, `volcanic contrast (${volcanic.contrast}) exceeds quality base (${baseHigh.contrast})`);
assert(volcanic.saturation > 1.0, `volcanic saturation (${volcanic.saturation}) is above neutral`);
assert(volcanic.contrast >= 1.18, 'volcanic contrast is punchy (≥1.18)');

// Test 4: Ice environment — flat, desaturated
console.log('\nTest 4: Ice environment grading');
const ice = getEnvironmentColorGradingPreset('ice');
assert(ice.contrast < baseHigh.contrast, `ice contrast (${ice.contrast}) is flatter than quality base`);
assert(ice.saturation < 1.0, `ice saturation (${ice.saturation}) is desaturated`);
assert(ice.saturation <= 0.90, 'ice is noticeably cool and desaturated (≤0.90)');

// Test 5: Underwater — heavy desaturation
console.log('\nTest 5: Underwater environment grading');
const underwater = getEnvironmentColorGradingPreset('underwater');
assert(underwater.saturation < ice.saturation, `underwater (${underwater.saturation}) is more desaturated than ice (${ice.saturation})`);
assert(underwater.saturation <= 0.75, 'underwater is heavily desaturated (≤0.75)');

// Test 6: Space nebula — high contrast, vivid
console.log('\nTest 6: Space nebula environment grading');
const nebula = getEnvironmentColorGradingPreset('space_nebula');
assert(nebula.saturation > 1.2, `nebula saturation (${nebula.saturation}) is vivid (>1.2)`);
assert(nebula.contrast >= 1.15, `nebula contrast (${nebula.contrast}) is dramatic (≥1.15)`);

// Test 7: Neon city — most vivid
console.log('\nTest 7: Neon city environment grading');
const neon = getEnvironmentColorGradingPreset('neon_city');
assert(neon.saturation >= nebula.saturation, `neon (${neon.saturation}) is at least as vivid as nebula (${nebula.saturation})`);
assert(neon.saturation >= 1.35, 'neon is hyper-vivid (≥1.35)');

// Test 8: Unknown env returns empty object (graceful fallback)
console.log('\nTest 8: Unknown environment falls back gracefully');
const unknown = getEnvironmentColorGradingPreset('nonexistent_env');
assert(Object.keys(unknown).length === 0, 'unknown env returns empty object (quality base used)');

// Test 9: Merge semantics — env overrides replace quality base
console.log('\nTest 9: Merge semantics with quality base');
const baseMed = getColorGradingConfig('medium');
const volcanicMerged = { ...baseMed, ...volcanic };
assert(volcanicMerged.contrast === volcanic.contrast, 'env contrast overrides quality base');
assert(volcanicMerged.saturation === volcanic.saturation, 'env saturation overrides quality base');

// Test 10: All named environments have valid numeric values
console.log('\nTest 10: All environments produce valid numeric values');
const envNames = ['volcanic', 'ice', 'underwater', 'space_nebula', 'neon_city', 'default'];
const baseMedium = getColorGradingConfig('medium');
for (const env of envNames) {
    const preset = getEnvironmentColorGradingPreset(env);
    const merged = { ...baseMedium, ...preset };
    assert(
        typeof merged.contrast === 'number' && isFinite(merged.contrast),
        `${env}: merged contrast is a finite number (${merged.contrast})`
    );
    assert(
        typeof merged.saturation === 'number' && isFinite(merged.saturation),
        `${env}: merged saturation is a finite number (${merged.saturation})`
    );
}

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
console.log(`
Color Grading Presets:
  volcanic    → contrast=${getEnvironmentColorGradingPreset('volcanic').contrast}, sat=${getEnvironmentColorGradingPreset('volcanic').saturation}
  ice         → contrast=${getEnvironmentColorGradingPreset('ice').contrast}, sat=${getEnvironmentColorGradingPreset('ice').saturation}
  underwater  → contrast=${getEnvironmentColorGradingPreset('underwater').contrast}, sat=${getEnvironmentColorGradingPreset('underwater').saturation}
  space_nebula→ contrast=${getEnvironmentColorGradingPreset('space_nebula').contrast}, sat=${getEnvironmentColorGradingPreset('space_nebula').saturation}
  neon_city   → contrast=${getEnvironmentColorGradingPreset('neon_city').contrast}, sat=${getEnvironmentColorGradingPreset('neon_city').saturation}
  default     → (quality-tier baseline, no override)`);

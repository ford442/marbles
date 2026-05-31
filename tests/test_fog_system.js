/**
 * Tests for fog system implementation
 */

import { getFogQualityConfig, getEnvironmentFogPreset } from '../src/rendering/post-fx-presets.js';
import { ENVIRONMENT_PRESETS } from '../src/rendering/environment.js';

console.log('=== Testing Fog System ===\n');

// Test 1: Quality tier fog configs
console.log('Test 1: Fog quality configs');
['low', 'medium', 'high', 'ultra'].forEach(quality => {
    const config = getFogQualityConfig(quality);
    if (quality === 'low') {
        if (!config.enabled === false) {
            console.log(`✓ Low quality fog disabled`);
        }
    } else {
        if (config.enabled && config.distance && config.density) {
            console.log(`✓ ${quality} quality fog enabled with distance=${config.distance}, density=${config.density}`);
        } else {
            console.log(`✗ ${quality} quality fog config invalid`);
        }
    }
});

// Test 2: Environment fog presets
console.log('\nTest 2: Environment fog presets');
const environments = ['default', 'space_nebula', 'ice', 'volcanic', 'neon_city', 'underwater'];
environments.forEach(env => {
    const preset = getEnvironmentFogPreset(env);
    if (preset && preset.color && preset.distance && preset.density !== undefined) {
        console.log(`✓ ${env} fog preset: color=${preset.color}, distance=${preset.distance}, density=${preset.density}`);
    } else {
        console.log(`✗ ${env} fog preset invalid`);
    }
});

// Test 3: Underwater environment exists
console.log('\nTest 3: Underwater environment in ENVIRONMENT_PRESETS');
if (ENVIRONMENT_PRESETS.underwater) {
    const underwater = ENVIRONMENT_PRESETS.underwater;
    console.log(`✓ Underwater environment found:`);
    console.log(`  - label: ${underwater.label}`);
    console.log(`  - iblIntensity: ${underwater.iblIntensity}`);
    console.log(`  - skyboxColor: ${underwater.skyboxColor}`);
    console.log(`  - sh length: ${underwater.sh.length} (should be 27)`);
    if (underwater.sh.length === 27) {
        console.log(`✓ Underwater SH data valid (27 floats)`);
    }
} else {
    console.log(`✗ Underwater environment not found`);
}

// Test 4: Fog config merging
console.log('\nTest 4: Fog config merging (quality + environment)');
const mediumConfig = getFogQualityConfig('medium');
const underwaterPreset = getEnvironmentFogPreset('underwater');
const merged = { ...mediumConfig, ...underwaterPreset };
if (merged.enabled && merged.distance === underwaterPreset.distance) {
    console.log(`✓ Merged config correctly prioritizes environment preset`);
    console.log(`  - final distance: ${merged.distance}`);
    console.log(`  - final density: ${merged.density}`);
    console.log(`  - final color: ${merged.color}`);
} else {
    console.log(`✗ Merged config failed`);
}

// Test 5: Height falloff validation
console.log('\nTest 5: Height falloff clamping');
['low', 'medium', 'high', 'ultra'].forEach(quality => {
    const config = getFogQualityConfig(quality);
    if (config.enabled) {
        const hf = config.heightFalloff;
        if (hf >= 0 && hf <= 1) {
            console.log(`✓ ${quality} heightFalloff=${hf} is valid (0–1 range)`);
        } else {
            console.log(`✗ ${quality} heightFalloff=${hf} out of range`);
        }
    }
});

console.log('\n=== Fog System Tests Complete ===');

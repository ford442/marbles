/**
 * Tests for emissive material system
 */

import { materialPresets, createThemedMaterialInstance, applyFullPreset } from '../src/material-system.js';

console.log('=== Testing Emissive Material System ===\n');

// Test 1: Material presets have emissive data
console.log('Test 1: Marble material presets with emissive data');
const emissiveMarbles = ['neonGlow', 'volcanicMagma', 'shadowNinja', 'galacticCore', 'quantumCrystal'];
emissiveMarbles.forEach(name => {
    const preset = materialPresets[name];
    if (preset && preset.emissive && preset.emissiveIntensity !== undefined) {
        console.log(`✓ ${name} has emissive=${JSON.stringify(preset.emissive)}, intensity=${preset.emissiveIntensity}`);
    } else {
        console.log(`✗ ${name} missing emissive data`);
    }
});

// Test 2: Non-emissive marbles have zero emissive
console.log('\nTest 2: Non-emissive marbles');
const nonEmissiveMarbles = ['classicGlass', 'obsidianMetal', 'stoneVein'];
nonEmissiveMarbles.forEach(name => {
    const preset = materialPresets[name];
    if (preset && preset.emissiveIntensity === 0) {
        console.log(`✓ ${name} has emissiveIntensity=0`);
    } else {
        console.log(`✗ ${name} emissiveIntensity should be 0`);
    }
});

// Test 3: Emissive color validation
console.log('\nTest 3: Emissive color validation');
const marblesToTest = [
    { name: 'neonGlow', expectedColor: [0.95, 0.0, 0.6] },
    { name: 'volcanicMagma', expectedColor: [1.0, 0.3, 0.0] },
    { name: 'galacticCore', expectedColor: [0.1, 0.4, 1.0] }
];
marblesToTest.forEach(({ name, expectedColor }) => {
    const preset = materialPresets[name];
    if (preset && preset.emissive) {
        const match = JSON.stringify(preset.emissive) === JSON.stringify(expectedColor);
        if (match) {
            console.log(`✓ ${name} color matches: ${JSON.stringify(preset.emissive)}`);
        } else {
            console.log(`✗ ${name} color mismatch: expected ${JSON.stringify(expectedColor)}, got ${JSON.stringify(preset.emissive)}`);
        }
    }
});

// Test 4: Emissive intensity range
console.log('\nTest 4: Emissive intensity ranges');
emissiveMarbles.forEach(name => {
    const preset = materialPresets[name];
    if (preset && preset.emissiveIntensity > 0 && preset.emissiveIntensity <= 2.5) {
        console.log(`✓ ${name} intensity=${preset.emissiveIntensity} is in valid range (0-2.5)`);
    } else {
        console.log(`⚠ ${name} intensity=${preset.emissiveIntensity} (check if expected)`);
    }
});

console.log('\n=== Emissive Material Tests Complete ===');

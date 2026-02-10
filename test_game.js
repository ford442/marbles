/**
 * Marbles Game Test Suite
 * Tests game initialization, physics, and level loading
 */

import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results
const tests = {
    passed: 0,
    failed: 0,
    errors: []
};

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        tests.passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${e.message}`);
        tests.failed++;
        tests.errors.push({ name, error: e.message });
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

console.log('🎱 Marbles 3D Game Test Suite\n');
console.log('=' .repeat(50));

// Test 1: Check if required files exist
test('Required files exist', () => {
    const requiredFiles = [
        'index.html',
        'src/main.js',
        'src/sphere.js',
        'package.json',
        'vite.config.js'
    ];
    
    for (const file of requiredFiles) {
        const exists = fs.existsSync(join(__dirname, file));
        assert(exists, `${file} should exist`);
    }
});

// Test 2: Check level definitions
test('Level definitions are valid', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    // Check for LEVELS object
    assert(mainJs.includes('const LEVELS ='), 'LEVELS object should be defined');
    
    // Check for specific levels
    const expectedLevels = [
        'tutorial',
        'landing', 
        'jump',
        'slalom',
        'staircase',
        'full_course',
        'sandbox',
        'extreme'
    ];
    
    for (const level of expectedLevels) {
        assert(mainJs.includes(`${level}:`), `Level "${level}" should be defined`);
    }
});

// Test 3: Check HTML structure
test('HTML structure is valid', () => {
    const html = fs.readFileSync(join(__dirname, 'index.html'), 'utf-8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Check required elements
    assert(document.getElementById('canvas'), 'Canvas element should exist');
    assert(document.getElementById('level-menu'), 'Level menu should exist');
    assert(document.getElementById('level-grid'), 'Level grid should exist');
    assert(document.getElementById('ui'), 'Game UI should exist');
    assert(document.getElementById('score'), 'Score element should exist');
    
    // Check script tag
    const scripts = document.querySelectorAll('script[type="module"]');
    assert(scripts.length > 0, 'Module script should exist');
});

// Test 4: Check game class structure
test('Game class has required methods', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    const requiredMethods = [
        'constructor()',
        'async init()',
        'showLevelSelection()',
        'async loadLevel(',
        'clearLevel()',
        'createMarbles(',
        'resetMarbles()',
        'returnToMenu()',
        'checkGameLogic()',
        'loop()'
    ];
    
    for (const method of requiredMethods) {
        assert(mainJs.includes(method), `Method "${method}" should exist`);
    }
});

// Test 5: Check physics integration
test('Physics engine (Rapier3D) is integrated', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes("import RAPIER from '@dimforge/rapier3d-compat'"), 
           'Rapier3D should be imported');
    assert(mainJs.includes('RAPIER.init()'), 'Rapier should be initialized');
    assert(mainJs.includes('new RAPIER.World('), 'Physics world should be created');
    assert(mainJs.includes('world.step()'), 'Physics step should be called');
});

// Test 6: Check Filament rendering integration
test('Filament rendering engine is integrated', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    const html = fs.readFileSync(join(__dirname, 'index.html'), 'utf-8');
    
    // Filament is loaded via script tag
    assert(html.includes('filament.js'), 'Filament should be loaded via script tag');
    assert(mainJs.includes('Filament.Engine.create'), 'Filament engine should be created');
    assert(mainJs.includes('createScene()'), 'Scene should be created');
    assert(mainJs.includes('createCamera('), 'Camera should be created');
    assert(mainJs.includes('renderer.render'), 'Render should be called');
});

// Test 7: Check marble creation
test('Marble creation logic exists', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes('createMarbles('), 'createMarbles method should exist');
    assert(mainJs.includes('RigidBodyDesc.dynamic()'), 'Dynamic rigid bodies should be used');
    assert(mainJs.includes('ColliderDesc.ball('), 'Ball colliders should be used');
    assert(mainJs.includes('this.marbles = []'), 'Marbles array should be initialized');
});

// Test 8: Check input handling
test('Input handling is implemented', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes('keydown'), 'Keydown listener should exist');
    assert(mainJs.includes('keyup'), 'Keyup listener should exist');
    assert(mainJs.includes("'KeyR'"), 'Reset key (R) should be handled');
    assert(mainJs.includes("'KeyM'"), 'Menu key (M) should be handled');
    assert(mainJs.includes("'KeyC'"), 'Camera key (C) should be handled');
});

// Test 9: Check zone types
test('All zone types are implemented', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    const zoneTypes = [
        'createFloorZone',
        'createTrackZone',
        'createLandingZone',
        'createJumpZone',
        'createSlalomZone',
        'createStaircaseZone',
        'createSplitZone',
        'createForestZone',
        'createGoalZone'
    ];
    
    for (const zone of zoneTypes) {
        assert(mainJs.includes(zone), `Zone "${zone}" should be implemented`);
    }
});

// Test 10: Check collision detection
test('Collision detection and scoring logic exists', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes('checkGameLogic()'), 'Game logic check should exist');
    assert(mainJs.includes('rigidBody.translation()'), 'Position tracking should exist');
    assert(mainJs.includes('setTranslation('), 'Position reset should be implemented');
    assert(mainJs.includes('applyImpulse('), 'Impulse application should exist');
});

// Test 11: Check level switching
test('Level switching is implemented', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes('loadLevel('), 'loadLevel method should exist');
    assert(mainJs.includes('clearLevel()'), 'clearLevel method should exist');
    assert(mainJs.includes('showLevelSelection()'), 'Menu display should exist');
    assert(mainJs.includes('currentLevel'), 'Current level tracking should exist');
});

// Test 12: Check camera modes
test('Camera modes are implemented', () => {
    const mainJs = fs.readFileSync(join(__dirname, 'src/main.js'), 'utf-8');
    
    assert(mainJs.includes('cameraMode'), 'Camera mode tracking should exist');
    assert(mainJs.includes("'orbit'"), 'Orbit camera should exist');
    assert(mainJs.includes("'follow'"), 'Follow camera should exist');
    assert(mainJs.includes('lookAt('), 'Camera lookAt should be used');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\nTest Results:`);
console.log(`  Passed: ${tests.passed}`);
console.log(`  Failed: ${tests.failed}`);
console.log(`  Total:  ${tests.passed + tests.failed}`);

if (tests.failed > 0) {
    console.log('\nFailed Tests:');
    tests.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
}

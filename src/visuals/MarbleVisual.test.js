/**
 * MarbleVisual.test.js
 * 
 * Test suite for the MarbleVisual module.
 * Run these tests after integration to verify functionality.
 */

import { 
    MarbleVisual, 
    MarbleTheme, 
    MarbleVisualFactory,
    LODLevel 
} from './MarbleVisual.js';

// Mock Filament for testing
const mockFilament = {
    RgbType: { sRGB: 0 },
    'LightManager$Type': { POINT: 0 },
    Texture: {
        Builder: () => ({
            width: () => ({ height: () => ({ levels: () => ({ format: () => ({ sampler: () => ({ build: () => ({}) }) }) }) }) })
        }),
        'InternalFormat': { RGBA8: 0 },
        'Sampler': { SAMPLER_2D: 0 }
    },
    LightManager: {
        Builder: () => ({
            color: () => ({ intensity: () => ({ falloff: () => ({ build: () => ({}) }) }) })
        })
    },
    EntityManager: {
        get: () => ({
            create: () => ({ id: Math.random() })
        })
    }
};

const mockEngine = {
    destroy: () => {},
    createMaterial: () => ({
        createInstance: () => ({
            setColor3Parameter: () => {},
            setFloatParameter: () => {},
            setTextureParameter: () => {}
        })
    })
};

const mockBaseMaterial = {
    createInstance: () => ({
        setColor3Parameter: () => {},
        setFloatParameter: () => {},
        setTextureParameter: () => {}
    })
};

// Set global Filament mock
window.Filament = mockFilament;

console.log('=== MarbleVisual Test Suite ===\n');

// Test 1: Theme Enumeration
console.log('Test 1: MarbleTheme Enumeration');
console.assert(MarbleTheme.CLASSIC_GLASS === 'classic_glass', 'Classic Glass theme missing');
console.assert(MarbleTheme.OBSIDIAN_METAL === 'obsidian_metal', 'Obsidian Metal theme missing');
console.assert(MarbleTheme.NEON_GLOW === 'neon_glow', 'Neon Glow theme missing');
console.assert(MarbleTheme.STONE_VEIN === 'stone_vein', 'Stone Vein theme missing');
console.log('✓ All themes defined\n');

// Test 2: LOD Level Enumeration
console.log('Test 2: LODLevel Enumeration');
console.assert(LODLevel.HIGH === 0, 'HIGH should be 0');
console.assert(LODLevel.MEDIUM === 1, 'MEDIUM should be 1');
console.assert(LODLevel.LOW === 2, 'LOW should be 2');
console.assert(LODLevel.CULLED === 3, 'CULLED should be 3');
console.log('✓ LOD levels correct\n');

// Test 3: MarbleVisual Creation
console.log('Test 3: MarbleVisual Creation');
try {
    const visual = new MarbleVisual(
        MarbleTheme.NEON_GLOW,
        mockEngine,
        mockBaseMaterial,
        { enableParticles: true }
    );
    console.assert(visual !== null, 'Visual should be created');
    console.assert(visual.getMaterialInstance() !== null, 'Material instance should exist');
    console.assert(visual.getLOD() === LODLevel.HIGH, 'Default LOD should be HIGH');
    console.log('✓ MarbleVisual created successfully\n');
    
    // Cleanup
    visual.destroy();
} catch (e) {
    console.error('✗ Failed to create MarbleVisual:', e);
}

// Test 4: Factory Pattern
console.log('Test 4: MarbleVisualFactory');
MarbleVisualFactory.destroyAll();

try {
    const visual1 = MarbleVisualFactory.create(
        'test_marble_1',
        MarbleTheme.CLASSIC_GLASS,
        mockEngine,
        mockBaseMaterial
    );
    
    const visual2 = MarbleVisualFactory.create(
        'test_marble_2',
        MarbleTheme.OBSIDIAN_METAL,
        mockEngine,
        mockBaseMaterial
    );
    
    console.assert(MarbleVisualFactory.get('test_marble_1') === visual1, 'Factory should store visual1');
    console.assert(MarbleVisualFactory.get('test_marble_2') === visual2, 'Factory should store visual2');
    console.assert(MarbleVisualFactory.get('nonexistent') === undefined, 'Nonexistent should return undefined');
    
    const stats = MarbleVisualFactory.getAllStats();
    console.assert(stats.size === 2, 'Should have 2 stats entries');
    
    console.log('✓ Factory pattern working\n');
    
    // Cleanup
    MarbleVisualFactory.destroyAll();
} catch (e) {
    console.error('✗ Factory test failed:', e);
}

// Test 5: LOD System
console.log('Test 5: LOD System');
try {
    const visual = new MarbleVisual(
        MarbleTheme.CLASSIC_GLASS,
        mockEngine,
        mockBaseMaterial,
        { lodDistance: [10, 30, 60] }
    );
    
    // Test LOD transitions
    visual.setLOD(5);  // Within HIGH distance
    console.assert(visual.getLOD() === LODLevel.HIGH, 'Should be HIGH at distance 5');
    
    visual.setLOD(20); // Within MEDIUM distance
    console.assert(visual.getLOD() === LODLevel.MEDIUM, 'Should be MEDIUM at distance 20');
    
    visual.setLOD(45); // Within LOW distance
    console.assert(visual.getLOD() === LODLevel.LOW, 'Should be LOW at distance 45');
    
    visual.setLOD(100); // Beyond all distances
    console.assert(visual.getLOD() === LODLevel.CULLED, 'Should be CULLED at distance 100');
    
    console.log('✓ LOD transitions working\n');
    
    visual.destroy();
} catch (e) {
    console.error('✗ LOD test failed:', e);
}

// Test 6: Update Loop
console.log('Test 6: Update Loop');
try {
    const visual = new MarbleVisual(
        MarbleTheme.NEON_GLOW,
        mockEngine,
        mockBaseMaterial
    );
    
    const velocity = { x: 10, y: 0, z: 5 };
    const angularVelocity = { x: 0, y: 2, z: 0 };
    
    // Run multiple updates
    for (let i = 0; i < 60; i++) {
        visual.update(1/60, velocity, angularVelocity);
    }
    
    const stats = visual.getPerformanceStats();
    console.assert(stats.avgUpdateTime >= 0, 'Should have average update time');
    console.assert(stats.particleCount !== undefined, 'Should have particle count');
    
    console.log(`  Average update time: ${stats.avgUpdateTime.toFixed(3)}ms`);
    console.log(`  Particle count: ${stats.particleCount}`);
    console.log('✓ Update loop working\n');
    
    visual.destroy();
} catch (e) {
    console.error('✗ Update test failed:', e);
}

// Test 7: Contact Effects
console.log('Test 7: Contact Effects');
try {
    const visual = new MarbleVisual(
        MarbleTheme.NEON_GLOW,
        mockEngine,
        mockBaseMaterial,
        { enableParticles: true }
    );
    
    // Simulate contact
    visual.onContact(10);
    
    const particlesBefore = visual.getParticles().length;
    console.assert(particlesBefore > 0, 'Should have particles after contact');
    
    // Update to process particles
    visual.update(0.1, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    
    console.log(`  Particles emitted: ${particlesBefore}`);
    console.log('✓ Contact effects working\n');
    
    visual.destroy();
} catch (e) {
    console.error('✗ Contact test failed:', e);
}

// Test 8: Boost Effects
console.log('Test 8: Boost Effects');
try {
    const visual = new MarbleVisual(
        MarbleTheme.NEON_GLOW,
        mockEngine,
        mockBaseMaterial
    );
    
    // Start boost
    visual.onBoostStart();
    
    // Update during boost
    for (let i = 0; i < 30; i++) {
        visual.update(1/60, { x: 20, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    }
    
    // End boost
    visual.onBoostEnd();
    
    console.log('✓ Boost effects working\n');
    
    visual.destroy();
} catch (e) {
    console.error('✗ Boost test failed:', e);
}

// Test 9: All Themes Creation
console.log('Test 9: All Theme Materials');
const themes = [
    MarbleTheme.CLASSIC_GLASS,
    MarbleTheme.OBSIDIAN_METAL,
    MarbleTheme.NEON_GLOW,
    MarbleTheme.STONE_VEIN
];

for (const theme of themes) {
    try {
        const visual = new MarbleVisual(theme, mockEngine, mockBaseMaterial);
        console.assert(visual.getMaterialInstance() !== null, `${theme} should create material`);
        visual.destroy();
        console.log(`  ✓ ${theme}`);
    } catch (e) {
        console.error(`  ✗ ${theme} failed:`, e);
    }
}
console.log('');

// Test 10: Memory Cleanup
console.log('Test 10: Memory Cleanup');
try {
    const visuals = [];
    for (let i = 0; i < 10; i++) {
        visuals.push(new MarbleVisual(
            MarbleTheme.CLASSIC_GLASS,
            mockEngine,
            mockBaseMaterial
        ));
    }
    
    // Destroy all
    visuals.forEach(v => v.destroy());
    
    console.log('  Created and destroyed 10 visuals');
    console.log('✓ Cleanup working\n');
} catch (e) {
    console.error('✗ Cleanup test failed:', e);
}

console.log('=== Test Suite Complete ===');

// Performance benchmark
console.log('\n=== Performance Benchmark ===');
console.log('Running 1000 update iterations...');

const benchmarkVisual = new MarbleVisual(
    MarbleTheme.NEON_GLOW,
    mockEngine,
    mockBaseMaterial,
    { enableParticles: true }
);

const startTime = performance.now();

for (let i = 0; i < 1000; i++) {
    benchmarkVisual.update(
        1/60,
        { x: Math.sin(i * 0.1) * 10, y: 0, z: Math.cos(i * 0.1) * 10 },
        { x: 0, y: i * 0.01, z: 0 }
    );
}

const endTime = performance.now();
const totalTime = endTime - startTime;
const avgTime = totalTime / 1000;

console.log(`Total time: ${totalTime.toFixed(2)}ms`);
console.log(`Average per update: ${avgTime.toFixed(3)}ms`);
console.log(`Target: < 0.5ms per update`);
console.log(avgTime < 0.5 ? '✓ PASS' : '✗ FAIL');

benchmarkVisual.destroy();

// Export test results for CI
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MarbleTheme,
        LODLevel,
        MarbleVisual,
        MarbleVisualFactory
    };
}

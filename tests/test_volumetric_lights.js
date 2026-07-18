/**
 * tests/test_volumetric_lights.js
 *
 * Unit tests for VolumetricLightsSystem and getVolumetricConfig.
 * Run with: node tests/test_volumetric_lights.js
 */

// Minimal DOM stub
global.document = {
    getElementById: () => null,
    createElement: () => ({
        style: { cssText: '' },
        getContext: () => ({
            clearRect: () => {},
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            createRadialGradient: () => ({
                addColorStop: () => {}
            }),
            globalCompositeOperation: 'source-over',
            fillStyle: ''
        }),
        parentNode: null
    }),
    body: { appendChild: () => {} }
}
global.window = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: () => {}
}

import('/app/src/rendering/volumetric-lights.js').then(mod => {
    const { VolumetricLightsSystem, getVolumetricConfig } = mod

    let passed = 0
    let failed = 0
    const results = []

    function test(name, fn) {
        try {
            fn()
            passed++
            results.push(`  ✓ ${name}`)
        } catch (e) {
            failed++
            results.push(`  ✗ ${name}: ${e.message}`)
        }
    }

    function assert(cond, msg) {
        if (!cond) throw new Error(msg || 'Assertion failed')
    }
    function assertClose(a, b, eps = 1e-6, msg) {
        if (Math.abs(a - b) > eps) throw new Error(msg || `Expected ${a} ≈ ${b}`)
    }

    // --- getVolumetricConfig ---
    test('low quality: maxShafts=0, caustics=false', () => {
        const cfg = getVolumetricConfig('low')
        assert(cfg.maxShafts === 0, 'maxShafts')
        assert(cfg.caustics === false, 'caustics')
    })
    test('medium quality: maxShafts=2, caustics=false', () => {
        const cfg = getVolumetricConfig('medium')
        assert(cfg.maxShafts === 2, 'maxShafts')
        assert(cfg.caustics === false, 'caustics')
        assert(cfg.shaftOpacity > 0, 'opacity > 0')
    })
    test('high quality: maxShafts=4, caustics=true', () => {
        const cfg = getVolumetricConfig('high')
        assert(cfg.maxShafts === 4, 'maxShafts')
        assert(cfg.caustics === true, 'caustics')
    })
    test('ultra quality: maxShafts=6, caustics=true', () => {
        const cfg = getVolumetricConfig('ultra')
        assert(cfg.maxShafts === 6, 'maxShafts')
        assert(cfg.caustics === true, 'caustics')
    })
    test('unknown quality falls back to medium', () => {
        const cfg = getVolumetricConfig('extreme')
        assert(cfg.maxShafts === 2, 'falls back to medium')
    })

    // --- VolumetricLightsSystem construction ---
    test('constructor sets quality correctly', () => {
        const vl = new VolumetricLightsSystem('high')
        assert(vl.maxShafts === 4, 'maxShafts')
        assert(vl.causticEnabled === true, 'causticEnabled')
    })

    test('addShaftSource stores source', () => {
        const vl = new VolumetricLightsSystem('high')
        vl.addShaftSource({ pos: { x: 0, y: 5, z: 0 }, color: [1, 0, 0], intensity: 1000, behavior: 'lavaFlicker' })
        assert(vl.shaftSources.length === 1, 'source stored')
        assert(vl.shaftSources[0].color[0] === 1, 'color preserved')
    })

    test('addCausticSource stores source (high)', () => {
        const vl = new VolumetricLightsSystem('high')
        vl.addCausticSource({ pos: { x: 5, y: 0, z: 5 }, color: [0.2, 0.9, 0.7], radius: 60 })
        assert(vl.causticSources.length === 1, 'caustic stored')
    })

    test('addCausticSource is no-op when caustics disabled (medium)', () => {
        const vl = new VolumetricLightsSystem('medium')
        vl.addCausticSource({ pos: { x: 5, y: 0, z: 5 }, color: [0.2, 0.9, 0.7], radius: 60 })
        assert(vl.causticSources.length === 0, 'caustic not stored when disabled')
    })

    test('clearSources resets both arrays', () => {
        const vl = new VolumetricLightsSystem('high')
        vl.addShaftSource({ pos: { x: 0, y: 0, z: 0 }, color: [1, 1, 1] })
        vl.addCausticSource({ pos: { x: 0, y: 0, z: 0 }, color: [1, 1, 1], radius: 50 })
        vl.clearSources()
        assert(vl.shaftSources.length === 0, 'shaftSources cleared')
        assert(vl.causticSources.length === 0, 'causticSources cleared')
    })

    test('setQuality updates maxShafts and causticEnabled', () => {
        const vl = new VolumetricLightsSystem('medium')
        assert(vl.maxShafts === 2, 'initial medium')
        vl.setQuality('ultra')
        assert(vl.maxShafts === 6, 'after ultra')
        assert(vl.causticEnabled === true, 'caustic enabled after ultra')
    })

    // --- Projection math ---
    test('_projectToScreen: point in front of camera returns valid screen coords', () => {
        const vl = new VolumetricLightsSystem('high')
        const camState = { eye: [0, 0, 10], target: [0, 0, 0] }
        const result = vl._projectToScreen(0, 0, 0, camState, 60, 4/3, 800, 600)
        assert(result !== null, 'should project')
        assertClose(result.x, 400, 1, 'center x') // Dead center should be ~400
        assertClose(result.y, 300, 1, 'center y') // Dead center should be ~300
    })

    test('_projectToScreen: point behind camera returns null', () => {
        const vl = new VolumetricLightsSystem('high')
        // Camera at [0,0,10] looking toward [0,0,0] → forward = [0,0,-1]
        // A point at z=+20 is behind the camera (depth = dot([0,0,10],[0,0,-1]) = -10)
        const camState = { eye: [0, 0, 10], target: [0, 0, 0] }
        const result = vl._projectToScreen(0, 0, 20, camState, 60, 4/3, 800, 600)
        assert(result === null, 'behind camera returns null')
    })

    test('_projectToScreen: topdown camera degenerate fwd=[0,-1,0] does not NaN', () => {
        const vl = new VolumetricLightsSystem('high')
        // Topdown: eye directly above target, fwd = [0,-1,0]
        const camState = { eye: [0, 40, 0], target: [0, 0, 0] }
        const result = vl._projectToScreen(5, 0, 5, camState, 60, 4/3, 800, 600)
        // May return null (if the fallback pushes the point behind) but must not be NaN
        if (result !== null) {
            assert(!isNaN(result.x) && !isNaN(result.y), 'no NaN in result')
        }
    })

    test('_projectToScreen: point far off-screen returns null', () => {
        const vl = new VolumetricLightsSystem('high')
        const camState = { eye: [0, 0, 10], target: [0, 0, 0] }
        // Way off to the right
        const result = vl._projectToScreen(1000, 0, 0, camState, 60, 4/3, 800, 600)
        assert(result === null, 'far off-screen returns null')
    })

    test('_projectToScreen: depth value is positive for visible points', () => {
        const vl = new VolumetricLightsSystem('high')
        const camState = { eye: [0, 0, 10], target: [0, 0, 0] }
        const result = vl._projectToScreen(0, 0, 0, camState, 60, 4/3, 800, 600)
        assert(result !== null && result.depth > 0, 'depth is positive')
    })

    // --- update() guards ---
    test('update() is a no-op when maxShafts=0 and no caustics', () => {
        const vl = new VolumetricLightsSystem('low')
        // Should not throw
        vl.update(0.016, { eye: [0, 10, 10], target: [0, 0, 0] }, 45, 4/3)
        assert(true, 'no throw')
    })

    test('update() is a no-op when cameraState is null', () => {
        const vl = new VolumetricLightsSystem('high')
        vl.addShaftSource({ pos: { x: 0, y: 5, z: 0 }, color: [1, 0, 0] })
        vl.update(0.016, null, 45, 4/3)
        assert(true, 'no throw with null cameraState')
    })

    test('time accumulates across update calls', () => {
        const vl = new VolumetricLightsSystem('high')
        assert(vl.time === 0, 'starts at 0')
        vl.update(0.5, null, 45, 1)  // null state bails early, but time should still add
        // time increments before the cameraState guard
        assert(vl.time === 0.5, 'time updated even with null state')
    })

    // --- Phase randomization ---
    test('addShaftSource randomizes phase for staggered animation', () => {
        const vl = new VolumetricLightsSystem('high')
        const phases = new Set()
        for (let i = 0; i < 20; i++) {
            vl.addShaftSource({ pos: { x: i, y: 0, z: 0 }, color: [1, 1, 1] })
            phases.add(vl.shaftSources[i].phase)
        }
        // Very unlikely to have all same phase with random assignment
        assert(phases.size > 1, 'phases are varied')
    })

    // Summary
    console.log('\n=== Volumetric Lights Tests ===')
    for (const r of results) console.log(r)
    console.log(`\n${passed} passed, ${failed} failed`)
    if (failed > 0) process.exit(1)
}).catch(e => {
    console.error('Import failed:', e.message)
    process.exit(1)
})

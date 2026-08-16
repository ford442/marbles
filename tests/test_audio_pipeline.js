import assert from 'node:assert/strict';
import { resolveCollisionSound } from '../src/audio/collision-matrix.js';
import { soundProperties } from '../src/audio/sound-bank.js';
import { VoicePool } from '../src/audio/voice-pool.js';
import { MarbleAudio, audio } from '../src/audio.js';
import { RollingSoundManager, ROLLING_MATERIAL_PARAMS } from '../src/audio/rolling-sound.js';
import { SURFACE_MATERIAL_SYNTH_PARAMS } from '../src/audio/surface-synth.js';

function testCollisionMatrixSurfaces() {
    const matrix = {
        entries: [
            { marble: '*', surface: 'wood', sound: 'collision_wood', pitchMin: 0.9, pitchMax: 1.1 },
            { marble: '*', surface: 'metal', sound: 'collision_metal', pitchMin: 0.88, pitchMax: 1.12 },
            { marble: '*', surface: 'glass', sound: 'collision_glass', pitchMin: 0.95, pitchMax: 1.2 },
        ],
    };

    const wood = resolveCollisionSound(matrix, 'glass', 'wood');
    const metal = resolveCollisionSound(matrix, 'volcanic_magma', 'metal');
    const glass = resolveCollisionSound(matrix, 'classic_blue', 'glass');

    assert.equal(wood.soundId, 'collision_wood');
    assert.equal(metal.soundId, 'collision_metal');
    assert.equal(glass.soundId, 'collision_glass');
    assert.notEqual(wood.soundId, metal.soundId);
    assert.notEqual(metal.soundId, glass.soundId);
}

function testSoundPropertiesDefaults() {
    const props = soundProperties(null);
    assert.ok(props.cooldown > 0);
    assert.ok(props.volume > 0);
}

function testCollisionMatrixSpecificity() {
    const matrix = {
        entries: [
            { marble: '*', surface: 'metal', sound: 'collision_metal', pitchMin: 0.88, pitchMax: 1.12 },
            { marble: 'metal', surface: 'metal', sound: 'collision_metal', pitchMin: 0.82, pitchMax: 1.05 },
        ],
    };

    const specific = resolveCollisionSound(matrix, 'metal', 'metal');
    assert.equal(specific.pitchMin, 0.82);
    assert.equal(specific.pitchMax, 1.05);
}

function testVoicePoolBounds() {
    const pool = new VoicePool(3);
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const d = { id: 'd' };
    const e = { id: 'e' };

    assert.equal(pool.tryAcquire(a), true);
    assert.equal(pool.tryAcquire(b), true);
    assert.equal(pool.tryAcquire(c), true);
    assert.equal(pool.tryAcquire(d), false);
    assert.equal(pool.dropped, 1);
    pool.release(a);
    assert.equal(pool.tryAcquire(e), true);
    assert.equal(pool.activeCount, 3);
}

function testMarbleAudioAPI() {
    const testAudio = new MarbleAudio();
    assert.equal(testAudio.enabled, false);
    assert.equal(testAudio.muted, false);
    assert.ok(testAudio.rollingSounds instanceof Map);

    // Body material registration
    const mockBody = { handle: 42 };
    testAudio.registerBodyMaterial(mockBody, 'metal');
    assert.equal(testAudio.getMaterial(42), 'metal');
    assert.equal(testAudio.getMaterial(999), 'wood');

    // Volume management
    testAudio.setVolume(0.5);
    testAudio.setMasterVolume(0.9);
    testAudio.setSFXVolume(0.8);
    testAudio.setMusicVolume(0.6);

    const mutedState = testAudio.toggleMute();
    assert.equal(mutedState, true);
    assert.equal(testAudio.muted, true);
    const unmutedState = testAudio.toggleMute();
    assert.equal(unmutedState, false);
    assert.equal(testAudio.muted, false);

    // Singleton check
    assert.ok(audio instanceof MarbleAudio);
}

function testRollingSoundManager() {
    const manager = new RollingSoundManager();
    assert.ok(manager.sounds instanceof Map);
    assert.equal(manager.sounds.size, 0);

    // Check material params exist
    for (const mat of ['wood', 'metal', 'concrete', 'glass', 'rubber']) {
        assert.ok(ROLLING_MATERIAL_PARAMS[mat], `Missing rolling params for ${mat}`);
        assert.ok(ROLLING_MATERIAL_PARAMS[mat].baseFreq > 0);
    }

    // Stop on empty shouldn't throw
    manager.stopRolling(null, 'non-existent');
    manager.stopAllRolling(null);
}

function testSurfaceMaterialSynthParams() {
    for (const mat of ['wood', 'metal', 'concrete', 'glass', 'rubber']) {
        assert.ok(SURFACE_MATERIAL_SYNTH_PARAMS[mat], `Missing synth params for ${mat}`);
        assert.ok(SURFACE_MATERIAL_SYNTH_PARAMS[mat].baseFreq > 0);
        assert.ok(SURFACE_MATERIAL_SYNTH_PARAMS[mat].harmonics.length > 0);
    }
}

testCollisionMatrixSurfaces();
testSoundPropertiesDefaults();
testCollisionMatrixSpecificity();
testVoicePoolBounds();
testMarbleAudioAPI();
testRollingSoundManager();
testSurfaceMaterialSynthParams();
console.log('Audio pipeline tests passed');

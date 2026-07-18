import assert from 'node:assert/strict';
import { resolveCollisionSound } from '../src/audio/collision-matrix.js';
import { soundProperties } from '../src/audio/sound-bank.js';
import { VoicePool } from '../src/audio/voice-pool.js';

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

testCollisionMatrixSurfaces();
testSoundPropertiesDefaults();
testCollisionMatrixSpecificity();
testVoicePoolBounds();
console.log('Audio pipeline tests passed');

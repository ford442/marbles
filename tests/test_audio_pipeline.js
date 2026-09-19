import assert from 'node:assert/strict';
import { resolveCollisionSound } from '../src/audio/collision-matrix.js';
import { soundProperties } from '../src/audio/sound-bank.js';
import { VoicePool } from '../src/audio/voice-pool.js';
import { MarbleAudio, audio } from '../src/audio.js';
import { RollingSoundManager, ROLLING_MATERIAL_PARAMS } from '../src/audio/rolling-sound.js';
import { SURFACE_MATERIAL_SYNTH_PARAMS, synthesizeSurfaceHit } from '../src/audio/surface-synth.js';
import { synthesizeClink } from '../src/audio/procedural-sfx.js';
import { generateSyntheticImpulseResponse } from '../src/audio/impulse-response.js';
import { ReverbZoneManager } from '../src/audio/reverb-zones.js';

/** Minimal fake AudioContext for exercising oscillator/filter-based synthesis and recording what pitch they were given. */
function makeSynthMockContext() {
    const oscillators = [];
    const filters = [];
    return {
        sampleRate: 44100,
        currentTime: 0,
        createBuffer(channels, length, sampleRate) {
            const data = Array.from({ length: channels }, () => new Float32Array(length));
            return { numberOfChannels: channels, length, sampleRate, getChannelData: (i) => data[i] };
        },
        createBufferSource() {
            return { buffer: null, loop: false, connect() {}, start() {}, stop() {} };
        },
        createChannelMerger() {
            return { connect() {} };
        },
        createGain() {
            return {
                gain: {
                    value: 0,
                    setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {},
                },
                connect() {},
            };
        },
        createBiquadFilter() {
            const f = { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} };
            filters.push(f);
            return f;
        },
        createOscillator() {
            const o = { type: '', frequency: { value: 0 }, detune: { value: 0 }, connect() {}, start() {}, stop() {} };
            oscillators.push(o);
            return o;
        },
        _oscillators: oscillators,
        _filters: filters,
    };
}

/** Minimal fake AudioContext covering only what ReverbZoneManager/IR generation touch. */
function makeMockAudioContext() {
    return {
        sampleRate: 44100,
        currentTime: 0,
        createGain() {
            // setTargetAtTime is asymptotic on a real AudioParam; the mock just
            // records the intended target so tests can assert on it directly.
            return { gain: { value: 0, setTargetAtTime(v) { this.value = v; } }, connect() {} };
        },
        createConvolver() {
            return { buffer: null, connect() {} };
        },
        createBuffer(channels, length, sampleRate) {
            const data = Array.from({ length: channels }, () => new Float32Array(length));
            return {
                numberOfChannels: channels,
                length,
                sampleRate,
                getChannelData: (i) => data[i],
            };
        },
    };
}

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

function testGenerateSyntheticImpulseResponse() {
    const ctx = makeMockAudioContext();

    const ir = generateSyntheticImpulseResponse(ctx, 2, 0);
    assert.equal(ir.numberOfChannels, 2);
    assert.equal(ir.length, Math.floor(2 * ctx.sampleRate));

    // preDelay shifts the tail start but doesn't shrink it.
    const withPreDelay = generateSyntheticImpulseResponse(ctx, 2, 0.1);
    assert.equal(withPreDelay.length, Math.floor(0.1 * ctx.sampleRate) + Math.floor(2 * ctx.sampleRate));
    const preDelaySamples = Math.floor(0.1 * ctx.sampleRate);
    const data = withPreDelay.getChannelData(0);
    assert.equal(data[0], 0, 'pre-delay region should be silent');
    assert.ok(data[preDelaySamples] !== undefined);

    // Out-of-range decay/preDelay are clamped rather than throwing.
    const clamped = generateSyntheticImpulseResponse(ctx, 999, 999);
    assert.ok(clamped.length > 0);
    assert.ok(clamped.length < ctx.sampleRate * 10);
}

function testReverbZoneManager() {
    const ctx = makeMockAudioContext();
    const manager = new ReverbZoneManager();
    const source = { connect() {} };
    const destination = { connect() {} };
    manager.attach(ctx, source, destination);

    manager.registerZone({ x: 0, y: 0, z: 25 }, 10, { decay: 2.5, wetMix: 0.6 });

    // Outside the zone: dry.
    manager.update(0, 0, 100);
    assert.equal(manager.reverbSend.gain.value, 0);

    // Inside the zone: wet gain opens and the convolver gets an impulse buffer.
    manager.update(0, 0, 25);
    assert.equal(manager.reverbSend.gain.value, 0.6);
    assert.ok(manager.convolver.buffer);

    // Leaving the zone closes the send again.
    manager.update(0, 0, 100);
    assert.equal(manager.reverbSend.gain.value, 0);

    // Re-entering reuses the cached impulse buffer for identical params.
    manager.update(0, 0, 25);
    const cachedBuffer = manager.convolver.buffer;
    manager.update(0, 0, 100);
    manager.update(0, 0, 25);
    assert.equal(manager.convolver.buffer, cachedBuffer);

    manager.unregisterAll();
    assert.equal(manager.zones.length, 0);
    assert.equal(manager.reverbSend.gain.value, 0);
}

function testSurfaceHitPitchTracksSpeed() {
    const outputNode = { connect() {} };

    const slowCtx = makeSynthMockContext();
    synthesizeSurfaceHit(slowCtx, outputNode, 1.01, 0.5, 'metal', 1);
    const slowFundamental = slowCtx._oscillators[0].frequency.value;

    const fastCtx = makeSynthMockContext();
    synthesizeSurfaceHit(fastCtx, outputNode, 25, 0.5, 'metal', 1);
    const fastFundamental = fastCtx._oscillators[0].frequency.value;

    assert.ok(
        fastFundamental > slowFundamental,
        `a high-speed impact should ring higher than a tiny bounce, not just louder (got ${slowFundamental} vs ${fastFundamental})`
    );

    // Doppler rate is an additional multiplier on top of the speed-pitch effect.
    const dopplerCtx = makeSynthMockContext();
    synthesizeSurfaceHit(dopplerCtx, outputNode, 1.01, 0.5, 'metal', 1, 1.3);
    const dopplerFundamental = dopplerCtx._oscillators[0].frequency.value;
    assert.ok(Math.abs(dopplerFundamental - slowFundamental * 1.3) < 1e-6);
}

function testClinkPitchTracksSpeed() {
    const outputNode = { connect() {} };

    const slowCtx = makeSynthMockContext();
    synthesizeClink(slowCtx, outputNode, new Map(), 1.01, 0.5, 'slow');
    const slowFundamental = slowCtx._oscillators[0].frequency.value;

    const fastCtx = makeSynthMockContext();
    synthesizeClink(fastCtx, outputNode, new Map(), 20, 0.5, 'fast');
    const fastFundamental = fastCtx._oscillators[0].frequency.value;

    assert.ok(
        fastFundamental > slowFundamental,
        `a fast marble-to-marble clink should ring higher than a slow one (got ${slowFundamental} vs ${fastFundamental})`
    );
}

testCollisionMatrixSurfaces();
testSoundPropertiesDefaults();
testCollisionMatrixSpecificity();
testVoicePoolBounds();
testMarbleAudioAPI();
testRollingSoundManager();
testSurfaceMaterialSynthParams();
testGenerateSyntheticImpulseResponse();
testReverbZoneManager();
testSurfaceHitPitchTracksSpeed();
testClinkPitchTracksSpeed();
console.log('Audio pipeline tests passed');

/**
 * Procedural Web Audio synthesizers for marble game sound effects.
 */

/** Reference impact speed (units/sec) at which the speed-pitch multiplier is 1.0. */
const NORMAL_CLINK_SPEED = 10;

/**
 * Generate a marble clink sound (impact noise + inharmonic ringing).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 * @param {Map<string, number>} cooldowns
 * @param {number} velocity Impact velocity (0-20)
 * @param {number} [radius=0.5] Marble radius (0.3-0.8) - affects pitch
 * @param {string} [id='default'] Marble identifier for cooldown tracking
 * @param {number} [dopplerRate=1] Playback-rate multiplier from relative marble/camera motion.
 */
export function synthesizeClink(ctx, outputNode, cooldowns, velocity, radius = 0.5, id = 'default', dopplerRate = 1) {
    if (!ctx || !outputNode) return;

    // Cooldown to prevent audio spam (max 1 clink per 100ms per marble)
    const now = performance.now();
    const lastPlayed = cooldowns.get(id) || 0;
    if (now - lastPlayed < 100) return;
    cooldowns.set(id, now);

    // Normalize inputs
    const normalizedVel = Math.min(Math.max(velocity, 0), 20) / 20;
    if (normalizedVel < 0.05) return; // Too quiet

    // Pitch based on marble size (smaller = higher pitch)
    // Map radius 0.3-0.8 to frequency multiplier 1.5-0.7
    const sizePitchMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);
    // Harder impacts ring higher, not just louder.
    const speedPitchMult = Math.min(Math.max(Math.sqrt(velocity / NORMAL_CLINK_SPEED), 0.7), 1.6) * dopplerRate;

    const t = ctx.currentTime;
    const duration = 0.3 + normalizedVel * 0.4;

    // Create nodes
    const impactGain = ctx.createGain();
    const ringGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    impactGain.connect(merger, 0, 0);
    ringGain.connect(merger, 0, 1);
    merger.connect(outputNode);

    // === IMPACT SOUND (filtered noise burst) ===
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        // Shorter, sharper decay for crisper impact
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Higher frequency bandpass for more "glassy/metallic" impact character
    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'bandpass';
    impactFilter.frequency.value = 4500 * sizePitchMult * speedPitchMult; // Higher center freq
    impactFilter.Q.value = 3 * (1 + normalizedVel * 0.5); // Sharper resonance on harder impacts

    noise.connect(impactFilter);
    impactFilter.connect(impactGain);

    // Impact envelope - shorter, punchier
    impactGain.gain.setValueAtTime(0, t);
    impactGain.gain.linearRampToValueAtTime(normalizedVel * 0.9, t + 0.003);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + normalizedVel * 0.03);

    noise.start(t);
    noise.stop(t + 0.08);

    // === RINGING SOUND (oscillators) ===
    // Glass marbles - higher fundamental with more metallic overtones
    const fundamental = 1200 * sizePitchMult * speedPitchMult; // Higher pitch for glassy sound
    const overtones = [1, 2.6, 4.2, 6.1, 8.0]; // More inharmonic ratios for "ping"

    overtones.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        // Sine for fundamental, triangle for overtones (more metallic)
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = fundamental * ratio;

        // More detune for richer, less synthetic sound
        osc.detune.value = (Math.random() - 0.5) * 20;

        osc.connect(oscGain);
        oscGain.connect(ringGain);

        // Ringing envelope - faster decay for higher overtones
        const overtoneAmp = Math.pow(0.7, i); // Gentler rolloff
        const attack = 0.003; // Faster attack
        const decay = duration * (0.6 - i * 0.08); // Shorter decay for high overtones

        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(normalizedVel * overtoneAmp * 0.6, t + attack);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + attack + Math.max(decay, 0.05));

        osc.start(t);
        osc.stop(t + attack + decay + 0.05);
    });

    // Ring gain envelope
    ringGain.gain.setValueAtTime(0, t);
    ringGain.gain.linearRampToValueAtTime(normalizedVel * 0.6, t + 0.01);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
}

/**
 * Play a boost sound (synth sweep + sub-bass kick).
 * @param {AudioContext} ctx
 * @param {AudioNode} sfxBus
 * @param {AudioNode} masterGain
 */
export function synthesizeBoost(ctx, sfxBus, masterGain) {
    if (!ctx || !sfxBus) return;

    const t = ctx.currentTime;

    // 1. Oscillator for the "whoosh/zoom" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
    filter.Q.value = 5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.start(t);
    osc.stop(t + 0.4);

    // 2. Sub-bass kick for impact
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();

    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(150, t);
    kickOsc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

    kickOsc.connect(kickGain);
    kickGain.connect(masterGain || sfxBus);

    kickGain.gain.setValueAtTime(0.5, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    kickOsc.start(t);
    kickOsc.stop(t + 0.2);
}

/**
 * Play a wall/floor hit sound (deeper, thuddier).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 * @param {number} velocity Impact velocity
 * @param {string} [material='wood'] 'wood', 'metal', 'concrete'
 */
export function synthesizeThud(ctx, outputNode, velocity, material = 'wood') {
    if (!ctx || !outputNode) return;

    const normalizedVel = Math.min(Math.max(velocity, 0), 20) / 20;
    if (normalizedVel < 0.1) return;

    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(outputNode);

    // Material characteristics
    const materialParams = {
        wood: { freq: 400, decay: 0.15, q: 1 },
        metal: { freq: 600, decay: 0.3, q: 5 },
        concrete: { freq: 200, decay: 0.08, q: 0.5 },
    };
    const params = materialParams[material] || materialParams.wood;

    // Filtered noise for thud
    const bufferSize = ctx.sampleRate * params.decay;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = params.freq;
    filter.Q.value = params.q;

    noise.connect(filter);
    filter.connect(gain);

    // Envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(normalizedVel * 0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + params.decay);

    noise.start(t);
    noise.stop(t + params.decay);
}

/**
 * Play goal completion sound (pleasant chime).
 * @param {AudioContext} ctx
 * @param {AudioNode} sfxBus
 * @param {{ x: number, y: number, z: number } | null} [position=null]
 */
export function synthesizeGoal(ctx, sfxBus, position = null) {
    if (!ctx || !sfxBus) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C major chord
    let output = sfxBus;

    if (position && ctx.createPanner) {
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 2;
        panner.maxDistance = 80;
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
        panner.connect(sfxBus);
        output = panner;
    }

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(output);

        const startTime = t + i * 0.05;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

        osc.start(startTime);
        osc.stop(startTime + 0.6);
    });
}

/**
 * Play collect sound (short high chime).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 */
export function synthesizeCollect(ctx, outputNode) {
    if (!ctx || !outputNode) return;

    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(outputNode);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);

    osc.connect(gain);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.start(t);
    osc.stop(t + 0.25);
}

/**
 * Play a jump sound (sawtooth boing sweep).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 */
export function synthesizeJump(ctx, outputNode) {
    if (!ctx || !outputNode) return;

    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(outputNode);

    // "Boing" effect using filtered saw wave
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + 0.1);
    filter.Q.value = 5;

    osc.connect(filter);
    filter.connect(gain);

    // Envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.start(t);
    osc.stop(t + 0.35);
}

/**
 * Play a trick sound (sine chirp).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 * @param {number} [sfxVolume=1]
 */
export function synthesizeTrick(ctx, outputNode, sfxVolume = 1) {
    if (!ctx || !outputNode) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    osc.connect(gain);
    gain.connect(outputNode);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2 * sfxVolume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.3);
}

/**
 * Play a heavy stomp impact sound (low noise + sine shockwave sweep).
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 */
export function synthesizeStomp(ctx, outputNode) {
    if (!ctx || !outputNode) return;

    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(outputNode);

    // 1. Heavy thud (low freq noise)
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(150, t);
    noiseFilter.Q.value = 1;

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    noise.start(t);

    // 2. Shockwave sweep (sine drop)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

    const oscGain = ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(gain);

    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(1.0, t + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.start(t);
    osc.stop(t + 0.5);

    // Master envelope
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
}

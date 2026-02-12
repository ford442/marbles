/**
 * Marble Audio System - Procedural Clink Synthesis
 * Uses Web Audio API for zero-dependency, high-performance sound generation
 */

export class MarbleAudio {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.cooldowns = new Map(); // Prevent audio spam
        this.masterGain = null;
        this.muted = false;
        this._volume = 0.4; // Default volume

        // Material type mappings for different surface sounds
        this.materialTypes = new Map();
    }

    /**
     * Register a physics body with a material type for collision sounds
     * @param {RAPIER.RigidBody} body - The physics body
     * @param {string} material - 'wood', 'metal', 'concrete', 'glass'
     */
    registerBodyMaterial(body, material = 'wood') {
        if (body && body.handle !== undefined) {
            this.materialTypes.set(body.handle, material);
        }
    }

    /**
     * Get material type for a body
     * @param {number} handle - Body handle from Rapier
     * @returns {string} Material type
     */
    getMaterial(handle) {
        return this.materialTypes.get(handle) || 'wood';
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    init() {
        if (this.ctx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('[Audio] Web Audio API not supported');
            return;
        }

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume; // Master volume
        this.masterGain.connect(this.ctx.destination);
        this.enabled = true;

        console.log('[Audio] Audio context initialized');
    }

    /**
     * Resume audio context (needed for browsers that suspend it)
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Generate a marble clink sound
     * @param {number} velocity - Impact velocity (0-20)
     * @param {number} radius - Marble radius (0.3-0.8) - affects pitch
     * @param {string} id - Marble identifier for cooldown tracking
     */
    playClink(velocity, radius = 0.5, id = 'default') {
        if (!this.enabled || !this.ctx) return;

        // Cooldown to prevent audio spam (max 1 clink per 100ms per marble)
        const now = performance.now();
        const lastPlayed = this.cooldowns.get(id) || 0;
        if (now - lastPlayed < 100) return;
        this.cooldowns.set(id, now);

        // Normalize inputs
        const normalizedVel = Math.min(Math.max(velocity, 0), 20) / 20;
        if (normalizedVel < 0.05) return; // Too quiet

        // Pitch based on marble size (smaller = higher pitch)
        // Map radius 0.3-0.8 to frequency multiplier 1.5-0.7
        const sizePitchMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);

        const t = this.ctx.currentTime;
        const duration = 0.3 + normalizedVel * 0.4;

        // Create nodes
        const impactGain = this.ctx.createGain();
        const ringGain = this.ctx.createGain();
        const merger = this.ctx.createChannelMerger(2);

        impactGain.connect(merger, 0, 0);
        ringGain.connect(merger, 0, 1);
        merger.connect(this.masterGain);

        // === IMPACT SOUND (filtered noise burst) ===
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Shorter, sharper decay for crisper impact
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.003));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Higher frequency bandpass for more "glassy/metallic" impact character
        const impactFilter = this.ctx.createBiquadFilter();
        impactFilter.type = 'bandpass';
        impactFilter.frequency.value = 4500 * sizePitchMult; // Higher center freq
        impactFilter.Q.value = 3; // Sharper resonance

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
        const fundamental = 1200 * sizePitchMult; // Higher pitch for glassy sound
        const overtones = [1, 2.6, 4.2, 6.1, 8.0]; // More inharmonic ratios for "ping"

        overtones.forEach((ratio, i) => {
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();

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
     * Play a boost sound (synth sweep)
     */
    playBoost() {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;

        // 1. Oscillator for the "whoosh/zoom" sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
        filter.Q.value = 5;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.start(t);
        osc.stop(t + 0.4);

        // 2. Sub-bass kick for impact
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();

        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, t);
        kickOsc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

        kickOsc.connect(kickGain);
        kickGain.connect(this.masterGain);

        kickGain.gain.setValueAtTime(0.5, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        kickOsc.start(t);
        kickOsc.stop(t + 0.2);
    }

    /**
     * Play a wall/floor hit sound (deeper, thuddier)
     * @param {number} velocity - Impact velocity
     * @param {string} material - 'wood', 'metal', 'concrete'
     */
    playThud(velocity, material = 'wood') {
        if (!this.enabled || !this.ctx) return;

        const normalizedVel = Math.min(Math.max(velocity, 0), 20) / 20;
        if (normalizedVel < 0.1) return;

        const t = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);

        // Material characteristics
        const materialParams = {
            wood: { freq: 400, decay: 0.15, q: 1 },
            metal: { freq: 600, decay: 0.3, q: 5 },
            concrete: { freq: 200, decay: 0.08, q: 0.5 }
        };
        const params = materialParams[material] || materialParams.wood;

        // Filtered noise for thud
        const bufferSize = this.ctx.sampleRate * params.decay;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
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
     * Play goal completion sound (pleasant chime)
     */
    playGoal() {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C major chord

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            osc.connect(gain);
            gain.connect(this.masterGain);

            const startTime = t + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });
    }

    /**
     * Set master volume
     * @param {number} vol - 0.0 to 1.0
     */
    setVolume(vol) {
        this._volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.value = this._volume;
        }
    }

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : (this._volume || 0.4);
        }
        return this.muted;
    }

    /**
     * Play marble-to-surface collision sound
     * @param {number} velocity - Impact velocity (0-30)
     * @param {number} radius - Marble radius (affects pitch)
     * @param {string} surfaceMaterial - 'wood', 'metal', 'concrete', 'glass'
     * @param {string} id - Collision ID for cooldown
     */
    playSurfaceHit(velocity, radius = 0.5, surfaceMaterial = 'wood', id = 'surface') {
        if (!this.enabled || !this.ctx || this.muted) return;

        // Cooldown - more lenient for surface hits (can be more frequent)
        const now = performance.now();
        const lastPlayed = this.cooldowns.get(id) || 0;
        if (now - lastPlayed < 80) return;
        this.cooldowns.set(id, now);

        const normalizedVel = Math.min(Math.max(velocity, 0), 30) / 30;
        if (normalizedVel < 0.03) return; // Very quiet threshold

        // Size affects pitch
        const sizePitchMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);

        const t = this.ctx.currentTime;

        // Material-specific parameters - tuned for distinct character
        const materialParams = {
            wood: {
                baseFreq: 450,
                decay: 0.15,
                noiseFreq: 600,
                noiseQ: 0.8,
                harmonics: [1, 1.9, 2.8],
                harmonicGains: [0.55, 0.25, 0.1],
                waveform: 'triangle'
            },
            metal: {
                baseFreq: 900,
                decay: 0.5,
                noiseFreq: 1800,
                noiseQ: 4,
                harmonics: [1, 2.1, 3.1, 4.3, 5.5],
                harmonicGains: [0.45, 0.35, 0.25, 0.15, 0.08],
                waveform: 'sawtooth'
            },
            concrete: {
                baseFreq: 250,
                decay: 0.06,
                noiseFreq: 350,
                noiseQ: 0.4,
                harmonics: [1, 1.4, 1.9],
                harmonicGains: [0.35, 0.15, 0.05],
                waveform: 'triangle'
            },
            glass: {
                baseFreq: 2000,
                decay: 0.35,
                noiseFreq: 3000,
                noiseQ: 5,
                harmonics: [1, 2.4, 4.0, 5.8],
                harmonicGains: [0.55, 0.35, 0.2, 0.1],
                waveform: 'sine'
            }
        };

        const params = materialParams[surfaceMaterial] || materialParams.wood;
        const pitch = params.baseFreq * sizePitchMult;

        const gain = this.ctx.createGain();
        gain.connect(this.masterGain);

        // Impact noise (shorter and sharper than marble-to-marble)
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.003));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = params.noiseFreq * sizePitchMult;
        noiseFilter.Q.value = params.noiseQ;

        const noiseGain = this.ctx.createGain();
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(gain);

        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(normalizedVel * 0.5, t + 0.002);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        noise.start(t);
        noise.stop(t + 0.05);

        // Ringing tones (material-specific)
        params.harmonics.forEach((ratio, i) => {
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();

            // Use material-specific waveform, but keep fundamental pure
            if (i === 0) {
                osc.type = 'sine'; // Fundamental always sine for clarity
            } else {
                osc.type = params.waveform || 'triangle';
            }

            osc.frequency.value = pitch * ratio;
            osc.detune.value = (Math.random() - 0.5) * 12; // Slightly less detune for cleaner sound

            osc.connect(oscGain);
            oscGain.connect(gain);

            const attack = 0.003;
            const decay = params.decay * (1 + i * 0.2);

            oscGain.gain.setValueAtTime(0, t);
            oscGain.gain.linearRampToValueAtTime(
                normalizedVel * params.harmonicGains[i],
                t + attack
            );
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);

            osc.start(t);
            osc.stop(t + attack + decay + 0.05);
        });

        // Overall envelope
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(normalizedVel * 0.7, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + params.decay + 0.1);
    }

    /**
     * Start rolling sound for a marble
     * @param {string} id - Marble identifier
     * @param {number} radius - Marble radius (affects pitch)
     * @param {string} surfaceMaterial - 'wood', 'metal', 'concrete'
     */
    startRolling(id, radius = 0.5, surfaceMaterial = 'wood') {
        if (!this.enabled || !this.ctx || this.muted) return;

        // Stop any existing rolling sound for this marble
        this.stopRolling(id);

        const t = this.ctx.currentTime;

        // Create nodes
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Material-specific rolling characteristics
        const materialParams = {
            wood: { baseFreq: 200, freqRange: 150, q: 0.5 },
            metal: { baseFreq: 400, freqRange: 300, q: 1 },
            concrete: { baseFreq: 100, freqRange: 80, q: 0.3 },
            glass: { baseFreq: 300, freqRange: 200, q: 0.8 }
        };
        const params = materialParams[surfaceMaterial] || materialParams.wood;

        // Size affects rolling pitch (smaller = higher)
        const sizeMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);

        // Create noise buffer for rolling texture
        const bufferSize = this.ctx.sampleRate * 2; // 2 second loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Brownian noise (deeper rumble) for rolling
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3; // Boost gain
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Filter setup
        filter.type = 'bandpass';
        filter.frequency.value = params.baseFreq * sizeMult;
        filter.Q.value = params.q;

        // Connect graph
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        // Start silent - will be modulated by velocity
        gain.gain.setValueAtTime(0, t);

        noise.start(t);

        // Store reference
        this.rollingSounds = this.rollingSounds || new Map();
        this.rollingSounds.set(id, {
            noise,
            gain,
            filter,
            params,
            sizeMult
        });
    }

    /**
     * Update rolling sound based on marble velocity
     * @param {string} id - Marble identifier
     * @param {number} velocity - Current velocity
     * @param {number} angularVel - Angular velocity (for texture variation)
     */
    updateRolling(id, velocity, angularVel = 0) {
        if (!this.rollingSounds || !this.ctx) return;

        const sound = this.rollingSounds.get(id);
        if (!sound) return;

        const t = this.ctx.currentTime;
        const normalizedVel = Math.min(velocity / 15, 1); // Cap at 15 units/sec

        if (normalizedVel < 0.05) {
            // Too slow - silence
            sound.gain.gain.setTargetAtTime(0, t, 0.05);
            return;
        }

        // Volume based on velocity (non-linear for more dynamic feel)
        const targetGain = Math.pow(normalizedVel, 1.5) * 0.25;
        sound.gain.gain.setTargetAtTime(targetGain, t, 0.1);

        // Modulate filter frequency based on velocity (faster = brighter)
        const baseFreq = sound.params.baseFreq * sound.sizeMult;
        const freqMod = 1 + normalizedVel * 0.5 + (angularVel * 0.1);
        sound.filter.frequency.setTargetAtTime(baseFreq * freqMod, t, 0.1);
    }

    /**
     * Stop rolling sound for a marble
     * @param {string} id - Marble identifier
     */
    stopRolling(id) {
        if (!this.rollingSounds) return;

        const sound = this.rollingSounds.get(id);
        if (!sound) return;

        const t = this.ctx.currentTime;

        // Fade out quickly
        sound.gain.gain.setTargetAtTime(0, t, 0.05);

        // Stop after fade
        setTimeout(() => {
            try {
                sound.noise.stop();
                sound.noise.disconnect();
                sound.gain.disconnect();
                sound.filter.disconnect();
            } catch (e) {
                // Already stopped
            }
        }, 100);

        this.rollingSounds.delete(id);
    }

    /**
     * Stop all rolling sounds
     */
    stopAllRolling() {
        if (!this.rollingSounds) return;
        for (const id of this.rollingSounds.keys()) {
            this.stopRolling(id);
        }
    }
}

// Singleton instance for easy importing
export const audio = new MarbleAudio();

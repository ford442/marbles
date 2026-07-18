/**
 * Marble Audio System - Procedural Clink Synthesis
 * Uses Web Audio API for zero-dependency, high-performance sound generation
 */

import { VoicePool, scheduleVoiceStop } from './audio/voice-pool.js';
import { loadSoundBank, getSoundDef, resolveSynthesisProfile, soundProperties } from './audio/sound-bank.js';
import { resolveCollisionSound } from './audio/collision-matrix.js';
import { MusicManager } from './audio/music-manager.js';

const ABILITY_SOUND_IDS = {
    bomb: 'ability_bomb',
    missile: 'ability_missile',
    blink: 'ability_blink',
    teleport: 'ability_blink',
    emp: 'ability_bomb',
    jump: 'ability_blink',
    goal: 'goal_chime',
};

export class MarbleAudio {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.cooldowns = new Map(); // Prevent audio spam
        this.masterGain = null;
        this.muted = false;
        this._volume = 0.4; // Default volume
        
        // Volume controls for different audio categories
        this._masterVolume = 0.8;
        this._sfxVolume = 0.7;
        this._musicVolume = 0.5;

        // Material type mappings for different surface sounds
        this.materialTypes = new Map();

        this.voicePool = new VoicePool(28);
        /** @type {Map<string, object> | null} */
        this.soundDefs = null;
        /** @type {Map<string, AudioBuffer> | null} */
        this.soundBuffers = null;
        this.collisionMatrix = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.musicManager = null;
        this._paused = false;
        this._focusActive = false;
        this._savedMasterVolume = null;
    }

    /** @returns {GainNode | null} SFX output bus */
    get sfxBus() {
        return this.sfxGain || this.masterGain;
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
        this.masterGain.gain.value = this._volume * this._masterVolume; // Master volume

        // Master filter for focus effect
        this.masterFilter = this.ctx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.value = 20000; // Default open
        this.masterFilter.Q.value = 1;

        this.masterGain.connect(this.masterFilter);
        this.masterFilter.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.gain.value = this._sfxVolume;
        this.musicGain.gain.value = this._musicVolume;
        this.sfxGain.connect(this.masterFilter);
        this.musicGain.connect(this.masterFilter);

        this.musicManager = new MusicManager(this.ctx, this.musicGain);
        this.enabled = true;

        console.log('[Audio] Audio context initialized');
    }

    /**
     * Set focus mode audio effect (muffled sound)
     * @param {boolean} active
     */
    setFocus(active) {
        if (!this.masterFilter || !this.ctx) return;
        this._focusActive = !!active;

        const t = this.ctx.currentTime;
        const targetFreq = active ? 400 : 20000;
        try {
            this.masterFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
        } catch {
            this.masterFilter.frequency.value = targetFreq;
        }

        this._applySfxDuck();
    }

    /**
     * Pause duck — lowers SFX without destroying saved master volume.
     * @param {boolean} paused
     */
    setPaused(paused) {
        this._paused = !!paused;
        this._applySfxDuck();
        if (this.musicManager) {
            this.musicManager.setEnabled(!this._paused);
        }
    }

    _applySfxDuck() {
        if (!this.sfxGain || !this.ctx) return;
        let mult = this._sfxVolume;
        if (this._paused) mult *= 0.2;
        if (this._focusActive) mult *= 0.65;
        this.sfxGain.gain.setTargetAtTime(mult, this.ctx.currentTime, 0.08);
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
        merger.connect(this.sfxBus);

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
        gain.connect(this.sfxBus);

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
        gain.connect(this.sfxBus);

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
     * @param {{ x: number, y: number, z: number } | null} [position]
     */
    playGoal(position = null) {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C major chord
        let output = this.sfxBus;

        if (position && this.ctx.createPanner) {
            const panner = this.ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 2;
            panner.maxDistance = 80;
            panner.positionX.value = position.x;
            panner.positionY.value = position.y;
            panner.positionZ.value = position.z;
            panner.connect(this.sfxBus);
            output = panner;
        }

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

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
     * Play collect sound (short high chime)
     */
    playCollect() {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.connect(this.sfxBus);

        const osc = this.ctx.createOscillator();
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
     * Play a jump sound
     */
    playJump() {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.connect(this.sfxBus);

        // "Boing" effect using filtered saw wave
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

        const filter = this.ctx.createBiquadFilter();
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
     * Set master volume
     * @param {number} vol - 0.0 to 1.0
     */
    setVolume(vol) {
        this._volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.value = this._volume * this._masterVolume;
        }
    }

    /**
     * Set master volume (0.0 to 1.0)
     * @param {number} vol 
     */
    setMasterVolume(vol) {
        this._masterVolume = Math.max(0, Math.min(1, vol));
        this.updateGain();
    }

    /**
     * Set SFX volume (0.0 to 1.0)
     * @param {number} vol 
     */
    setSFXVolume(vol) {
        this._sfxVolume = Math.max(0, Math.min(1, vol));
        this._applySfxDuck();
    }

    /**
     * Set music volume (0.0 to 1.0)
     * @param {number} vol 
     */
    setMusicVolume(vol) {
        this._musicVolume = Math.max(0, Math.min(1, vol));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this._musicVolume, this.ctx.currentTime, 0.05);
        }
        this.musicManager?.setVolume(this._musicVolume);
    }

    /**
     * Update master gain based on current volumes
     */
    updateGain() {
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.value = this._volume * this._masterVolume;
        }
    }

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : (this._volume || 0.4) * this._masterVolume;
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
    /**
     * Load sound bank + collision matrix from AssetRegistry (call after registry boot).
     * @param {import('./assets/AssetRegistry.js').AssetRegistry} registry
     */
    async loadFromRegistry(registry) {
        if (!registry) return;
        try {
            const bank = await loadSoundBank(registry);
            this.soundDefs = bank.sounds;
            this.soundBuffers = bank.buffers;
            this.collisionMatrix = bank.matrix;
            console.log(`[Audio] Sound bank loaded (${bank.sounds.size} defs, ${bank.buffers.size} buffers)`);
        } catch (error) {
            console.warn('[Audio] Sound bank load failed:', error);
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setListenerPosition(x, y, z) {
        if (!this.ctx?.listener?.positionX) return;
        const t = this.ctx.currentTime;
        this.ctx.listener.positionX.setTargetAtTime(x, t, 0.05);
        this.ctx.listener.positionY.setTargetAtTime(y, t, 0.05);
        this.ctx.listener.positionZ.setTargetAtTime(z, t, 0.05);
    }

    /**
     * Material-aware collision with pitch variance from sound bank / matrix.
     */
    playCollision({
        velocity,
        radius = 0.5,
        marbleMaterial = 'glass',
        surfaceMaterial = 'wood',
        id = 'collision',
        position = null,
    }) {
        if (!this.enabled || !this.ctx || this.muted) return;

        const resolved = resolveCollisionSound(this.collisionMatrix, marbleMaterial, surfaceMaterial);
        const def = this.soundDefs ? getSoundDef(this.soundDefs, resolved.soundId) : null;
        const props = soundProperties(def);
        const profile = resolveSynthesisProfile(def, resolved.soundId);

        const now = performance.now();
        const lastPlayed = this.cooldowns.get(id) || 0;
        if (now - lastPlayed < props.cooldown * 1000) return;
        if (velocity < props.threshold) return;

        const pitch = resolved.pitchMin + Math.random() * (resolved.pitchMax - resolved.pitchMin);
        const buffer = this.soundBuffers?.get(resolved.soundId);

        if (buffer) {
            this._playBuffer(buffer, {
                volume: props.volume * this._sfxVolume,
                pitch,
                spatial: props.spatial && position,
                position,
                maxDistance: props.maxDistance,
                id,
            });
        } else {
            this._playSurfaceHitInternal(velocity, radius, profile, id, pitch * props.volume);
        }

        this.cooldowns.set(id, now);
    }

    /**
     * Centralized ability one-shots.
     * @param {'bomb'|'missile'|'blink'|'teleport'|'emp'|'jump'} abilityId
     * @param {{ x: number, y: number, z: number } | null} [position]
     */
    playAbility(abilityId, position = null) {
        const soundId = ABILITY_SOUND_IDS[abilityId];
        if (!soundId) return this._playAbilityProcedural(abilityId);

        const def = this.soundDefs ? getSoundDef(this.soundDefs, soundId) : null;
        const props = soundProperties(def);
        const profile = def?.synthesis?.profile;
        const buffer = this.soundBuffers?.get(soundId);

        if (buffer) {
            this._playBuffer(buffer, {
                volume: props.volume,
                pitch: 1,
                spatial: props.spatial && position,
                position,
                maxDistance: props.maxDistance,
                id: `ability-${abilityId}`,
            });
            return;
        }

        this._playAbilityProcedural(profile || abilityId, position);
    }

    _playAbilityProcedural(kind, position) {
        switch (kind) {
            case 'stomp':
            case 'bomb':
            case 'emp':
                this.playStomp();
                break;
            case 'boost':
            case 'missile':
                this.playBoost();
                break;
            case 'goal':
                this.playGoal(position);
                break;
            case 'trick':
            case 'blink':
            case 'teleport':
                this.playTrick();
                break;
            case 'jump':
                this.playJump();
                break;
            default:
                this.playBoost();
        }
    }

    playTrick() {
        if (!this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxBus);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2 * this._sfxVolume, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    /**
     * @param {{ x: number, y: number, z: number }} position
     */
    playSpatialGoal(position) {
        this.playGoal(position);
    }

    /**
     * @param {string | undefined} chapter
     */
    setChapterMusic(chapter) {
        if (!this.musicManager || this.muted) return;
        this.musicManager.setVolume(this._musicVolume);
        this.musicManager.crossfadeToChapter(chapter);
    }

    stopMusic() {
        this.musicManager?.stop();
    }

    /**
     * @param {AudioBuffer} buffer
     * @param {object} opts
     */
    _playBuffer(buffer, opts) {
        if (!this.voicePool.tryAcquire(opts)) return;

        const t = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = opts.pitch ?? 1;

        const gain = this.ctx.createGain();
        gain.gain.value = opts.volume ?? 0.7;

        const nodes = [source, gain];
        let output = gain;

        if (opts.spatial && opts.position && this.ctx.createPanner) {
            const panner = this.ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = opts.maxDistance ?? 40;
            panner.rolloffFactor = 1;
            panner.positionX.value = opts.position.x;
            panner.positionY.value = opts.position.y;
            panner.positionZ.value = opts.position.z;
            gain.connect(panner);
            output = panner;
            nodes.push(panner);
        }

        output.connect(this.sfxBus);
        source.start(t);
        const stopAt = t + buffer.duration / (opts.pitch || 1);
        source.stop(stopAt);
        scheduleVoiceStop(this.ctx, nodes, stopAt, () => this.voicePool.release(opts));
    }

    /**
     * @param {number} velocity
     * @param {number} radius
     * @param {string} surfaceMaterial
     * @param {string} id
     * @param {number} [volumeScale]
     */
    _playSurfaceHitInternal(velocity, radius, surfaceMaterial, id, volumeScale = 1) {
        const token = { id };
        if (!this.voicePool.tryAcquire(token)) return;
        try {
            this._synthesizeSurfaceHit(velocity, radius, surfaceMaterial, volumeScale);
        } finally {
            setTimeout(() => this.voicePool.release(token), 350);
        }
    }

    playSurfaceHit(velocity, radius = 0.5, surfaceMaterial = 'wood', id = 'surface') {
        if (this.soundDefs) {
            this.playCollision({
                velocity,
                radius,
                marbleMaterial: 'glass',
                surfaceMaterial,
                id,
            });
            return;
        }
        this._playSurfaceHitInternal(velocity, radius, surfaceMaterial, id);
    }

    _synthesizeSurfaceHit(velocity, radius, surfaceMaterial, volumeScale = 1) {
        if (!this.enabled || !this.ctx || this.muted) return;

        const normalizedVel = Math.min(Math.max(velocity, 0), 30) / 30;
        if (normalizedVel < 0.03) return;

        const sizePitchMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);
        const t = this.ctx.currentTime;

        const materialParams = {
            wood: {
                baseFreq: 450,
                decay: 0.15,
                noiseFreq: 600,
                noiseQ: 0.8,
                harmonics: [1, 1.9, 2.8],
                harmonicGains: [0.55, 0.25, 0.1],
                waveform: 'triangle',
            },
            metal: {
                baseFreq: 900,
                decay: 0.5,
                noiseFreq: 1800,
                noiseQ: 4,
                harmonics: [1, 2.1, 3.1, 4.3, 5.5],
                harmonicGains: [0.45, 0.35, 0.25, 0.15, 0.08],
                waveform: 'sawtooth',
            },
            concrete: {
                baseFreq: 250,
                decay: 0.06,
                noiseFreq: 350,
                noiseQ: 0.4,
                harmonics: [1, 1.4, 1.9],
                harmonicGains: [0.35, 0.15, 0.05],
                waveform: 'triangle',
            },
            glass: {
                baseFreq: 2000,
                decay: 0.35,
                noiseFreq: 3000,
                noiseQ: 5,
                harmonics: [1, 2.4, 4.0, 5.8],
                harmonicGains: [0.55, 0.35, 0.2, 0.1],
                waveform: 'sine',
            },
            rubber: {
                baseFreq: 180,
                decay: 0.12,
                noiseFreq: 280,
                noiseQ: 0.6,
                harmonics: [1, 1.3],
                harmonicGains: [0.4, 0.15],
                waveform: 'triangle',
            },
        };

        const params = materialParams[surfaceMaterial] || materialParams.wood;
        const pitch = params.baseFreq * sizePitchMult;

        const gain = this.ctx.createGain();
        gain.connect(this.sfxBus);

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
        noiseGain.gain.linearRampToValueAtTime(normalizedVel * 0.5 * volumeScale, t + 0.002);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        noise.start(t);
        noise.stop(t + 0.05);

        params.harmonics.forEach((ratio, i) => {
            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();

            osc.type = i === 0 ? 'sine' : (params.waveform || 'triangle');
            osc.frequency.value = pitch * ratio;
            osc.detune.value = (Math.random() - 0.5) * 12;

            osc.connect(oscGain);
            oscGain.connect(gain);

            const attack = 0.003;
            const decay = params.decay * (1 + i * 0.2);

            oscGain.gain.setValueAtTime(0, t);
            oscGain.gain.linearRampToValueAtTime(
                normalizedVel * params.harmonicGains[i] * volumeScale,
                t + attack
            );
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);

            osc.start(t);
            osc.stop(t + attack + decay + 0.05);
        });

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(normalizedVel * 0.7 * volumeScale, t + 0.005);
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
            glass: { baseFreq: 300, freqRange: 200, q: 0.8 },
            rubber: { baseFreq: 140, freqRange: 90, q: 0.4 },
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
        gain.connect(this.sfxBus);

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

    /**
     * Play a heavy stomp impact sound
     */
    playStomp() {
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.connect(this.sfxBus);

        // 1. Heavy thud (low freq noise)
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(150, t);
        noiseFilter.Q.value = 1;

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        noise.start(t);

        // 2. Shockwave sweep (sine drop)
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);

        const oscGain = this.ctx.createGain();
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
}

// Singleton instance for easy importing
export const audio = new MarbleAudio();
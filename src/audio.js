// @ts-check
/**
 * Marble Audio System - Procedural Clink Synthesis & Audio Pipeline Orchestrator
 * Uses Web Audio API for zero-dependency, high-performance sound generation.
 */

import { VoicePool } from './audio/voice-pool.ts';
import { loadSoundBank, getSoundDef, getSynthesisProfile, resolveSynthesisProfile, soundProperties } from './audio/sound-bank.ts';
import { resolveCollisionSound } from './audio/collision-matrix.ts';
import { MusicManager } from './audio/music-manager.ts';
import { synthesizeSurfaceHit } from './audio/surface-synth.ts';
import {
    synthesizeClink,
    synthesizeBoost,
    synthesizeThud,
    synthesizeGoal,
    synthesizeCollect,
    synthesizeJump,
    synthesizeTrick,
    synthesizeStomp,
} from './audio/procedural-sfx.ts';
import { RollingSoundManager } from './audio/rolling-sound.ts';
import { playSpatialBuffer } from './audio/spatial-audio.ts';
import { ReverbZoneManager } from './audio/reverb-zones.ts';

/** @typedef {import('@dimforge/rapier3d-compat').RigidBody} RigidBody */
/** @typedef {import('./audio/sound-bank.ts').SoundDef} SoundDef */
/** @typedef {import('./audio/sound-bank.ts').SoundBankSource} SoundBankSource */
/** @typedef {import('./audio/collision-matrix.ts').CollisionMatrix} CollisionMatrix */
/** @typedef {import('./audio/rolling-sound.ts').RollingSound} RollingSound */
/** @typedef {import('./audio/reverb-zones.ts').ReverbConfig} ReverbConfig */
/** @typedef {import('./audio/spatial-audio.ts').SpatialPlayOptions} SpatialPlayOptions */
/** @typedef {{ x: number, y: number, z: number }} AudioPosition */
/** @typedef {'bomb'|'missile'|'blink'|'teleport'|'emp'|'jump'|'goal'} AbilitySoundId */

/**
 * Options for `MarbleAudio.playCollision`.
 * @typedef {object} CollisionSoundOptions
 * @property {number} velocity
 * @property {number} [radius]
 * @property {string} [marbleMaterial]
 * @property {string} [surfaceMaterial]
 * @property {string} [id]
 * @property {AudioPosition | null} [position]
 * @property {number} [dopplerRate]
 */

/**
 * `AudioContext` constructor, falling back to the prefixed one on old Safari.
 * @returns {typeof AudioContext | undefined}
 */
function getAudioContextCtor() {
    /** @type {typeof globalThis & { webkitAudioContext?: typeof AudioContext }} */
    const w = window;
    return w.AudioContext || w.webkitAudioContext;
}

/** @type {Readonly<Record<AbilitySoundId, string>>} */
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
        /** @type {AudioContext | null} */
        this.ctx = null;
        this.enabled = false;
        /** @type {Map<string, number>} */
        this.cooldowns = new Map(); // Prevent audio spam
        /** @type {GainNode | null} */
        this.masterGain = null;
        /** @type {BiquadFilterNode | null} Created by `init()`. */
        this.masterFilter = null;
        this.muted = false;
        this._volume = 0.4; // Default volume

        // Volume controls for different audio categories
        this._masterVolume = 0.8;
        this._sfxVolume = 0.7;
        this._musicVolume = 0.5;

        // Material type mappings for different surface sounds
        /** @type {Map<number, string>} Rapier body handle → surface material. */
        this.materialTypes = new Map();

        this.voicePool = new VoicePool(28);
        /** @type {Map<string, SoundDef> | null} */
        this.soundDefs = null;
        /** @type {Map<string, AudioBuffer> | null} */
        this.soundBuffers = null;
        /** @type {CollisionMatrix | null} */
        this.collisionMatrix = null;
        /** @type {GainNode | null} */
        this.sfxGain = null;
        /** @type {GainNode | null} */
        this.musicGain = null;
        /** @type {MusicManager | null} */
        this.musicManager = null;
        this.rollingManager = new RollingSoundManager();
        this._paused = false;
        this._focusActive = false;
        /** @type {number | null} */
        this._savedMasterVolume = null;
        this.reverbZones = new ReverbZoneManager();
    }

    /** @returns {GainNode | null} SFX output bus */
    get sfxBus() {
        return this.sfxGain || this.masterGain;
    }

    /** @returns {Map<string, RollingSound>} */
    get rollingSounds() {
        return this.rollingManager.sounds;
    }

    /** @param {Map<string, RollingSound>} val */
    set rollingSounds(val) {
        if (this.rollingManager) {
            this.rollingManager.sounds = val;
        }
    }

    /**
     * Register a physics body with a material type for collision sounds
     * @param {RigidBody} body - The physics body
     * @param {string} [material='wood'] - 'wood', 'metal', 'concrete', 'glass'
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

        const AudioContextCtor = getAudioContextCtor();
        if (!AudioContextCtor) {
            console.warn('[Audio] Web Audio API not supported');
            return;
        }

        const ctx = new AudioContextCtor();
        this.ctx = ctx;
        const masterGain = ctx.createGain();
        this.masterGain = masterGain;
        masterGain.gain.value = this._volume * this._masterVolume;

        // Master filter for focus effect
        const masterFilter = ctx.createBiquadFilter();
        this.masterFilter = masterFilter;
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 20000; // Default open
        masterFilter.Q.value = 1;

        masterGain.connect(masterFilter);
        masterFilter.connect(ctx.destination);

        const sfxGain = ctx.createGain();
        const musicGain = ctx.createGain();
        this.sfxGain = sfxGain;
        this.musicGain = musicGain;
        sfxGain.gain.value = this._sfxVolume;
        musicGain.gain.value = this._musicVolume;
        sfxGain.connect(masterFilter);
        musicGain.connect(masterFilter);

        // Parallel wet send for per-zone convolution reverb. The dry path
        // above (sfxGain -> masterFilter) is untouched; this send starts
        // silent and is only opened while the listener is inside a zone
        // with a `reverb` config (see ReverbZoneManager).
        this.reverbZones.attach(ctx, sfxGain, masterFilter);

        this.musicManager = new MusicManager(ctx, musicGain);
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
     * @param {number} [radius=0.5] - Marble radius (0.3-0.8) - affects pitch
     * @param {string} [id='default'] - Marble identifier for cooldown tracking
     * @param {number} [dopplerRate=1] - Playback-rate multiplier from relative marble/camera motion
     */
    playClink(velocity, radius = 0.5, id = 'default', dopplerRate = 1) {
        if (!this.enabled || !this.ctx) return;
        synthesizeClink(this.ctx, this.sfxBus, this.cooldowns, velocity, radius, id, dopplerRate);
    }

    /**
     * Play a boost sound (synth sweep)
     */
    playBoost() {
        if (!this.enabled || !this.ctx) return;
        synthesizeBoost(this.ctx, this.sfxBus, this.masterGain);
    }

    /**
     * Play a wall/floor hit sound (deeper, thuddier)
     * @param {number} velocity - Impact velocity
     * @param {string} [material='wood'] - 'wood', 'metal', 'concrete'
     */
    playThud(velocity, material = 'wood') {
        if (!this.enabled || !this.ctx) return;
        synthesizeThud(this.ctx, this.sfxBus, velocity, material);
    }

    /**
     * Play goal completion sound (pleasant chime)
     * @param {{ x: number, y: number, z: number } | null} [position=null]
     */
    playGoal(position = null) {
        if (!this.enabled || !this.ctx) return;
        synthesizeGoal(this.ctx, this.sfxBus, position);
    }

    /**
     * Play collect sound (short high chime)
     */
    playCollect() {
        if (!this.enabled || !this.ctx) return;
        synthesizeCollect(this.ctx, this.sfxBus);
    }

    /**
     * Play a jump sound
     */
    playJump() {
        if (!this.enabled || !this.ctx) return;
        synthesizeJump(this.ctx, this.sfxBus);
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
     * Load sound bank + collision matrix from AssetRegistry (call after registry boot).
     * @param {SoundBankSource | null | undefined} registry
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
        // setTargetAtTime throws on NaN/Infinity, which would kill the frame loop.
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
        const t = this.ctx.currentTime;
        this.ctx.listener.positionX.setTargetAtTime(x, t, 0.05);
        this.ctx.listener.positionY.setTargetAtTime(y, t, 0.05);
        this.ctx.listener.positionZ.setTargetAtTime(z, t, 0.05);
    }

    /**
     * Register a spherical convolution-reverb trigger volume. The listener
     * must be within `radius` of `center` for `config` (decay/wetMix/preDelay)
     * to apply.
     * @param {{ x: number, y: number, z: number }} center
     * @param {number} radius
     * @param {ReverbConfig} config
     */
    registerReverbZone(center, radius, config) {
        this.reverbZones.registerZone(center, radius, config);
    }

    /**
     * Re-evaluate which reverb zone (if any) the listener is inside and
     * crossfade the wet send accordingly. Call once per frame with the
     * camera/listener position.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    updateReverbZone(x, y, z) {
        this.reverbZones.update(x, y, z);
    }

    /** Drop all registered reverb zones (call on level unload). */
    clearReverbZones() {
        this.reverbZones.unregisterAll();
    }

    /**
     * Material-aware collision with pitch variance from sound bank / matrix.
     * @param {CollisionSoundOptions} options
     */
    playCollision({
        velocity,
        radius = 0.5,
        marbleMaterial = 'glass',
        surfaceMaterial = 'wood',
        id = 'collision',
        position = null,
        dopplerRate = 1,
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
                spatial: !!(props.spatial && position),
                position,
                maxDistance: props.maxDistance,
                id,
                dopplerRate,
            });
        } else {
            this._playSurfaceHitInternal(velocity, radius, profile, id, pitch * props.volume, dopplerRate);
        }

        this.cooldowns.set(id, now);
    }

    /**
     * Centralized ability one-shots.
     * @param {AbilitySoundId} abilityId
     * @param {AudioPosition | null} [position]
     */
    playAbility(abilityId, position = null) {
        const soundId = ABILITY_SOUND_IDS[abilityId];
        if (!soundId) return this._playAbilityProcedural(abilityId, position);

        const def = this.soundDefs ? getSoundDef(this.soundDefs, soundId) : null;
        const props = soundProperties(def);
        const profile = getSynthesisProfile(def);
        const buffer = this.soundBuffers?.get(soundId);

        if (buffer) {
            this._playBuffer(buffer, {
                volume: props.volume,
                pitch: 1,
                spatial: !!(props.spatial && position),
                position,
                maxDistance: props.maxDistance,
                id: `ability-${abilityId}`,
            });
            return;
        }

        this._playAbilityProcedural(profile || abilityId, position);
    }

    /**
     * @param {string} kind Ability id or the sound def's `synthesis.profile`.
     * @param {AudioPosition | null} position
     */
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
        synthesizeTrick(this.ctx, this.sfxBus, this._sfxVolume);
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
     * @param {SpatialPlayOptions} opts
     */
    _playBuffer(buffer, opts) {
        playSpatialBuffer(this.ctx, this.sfxBus, this.voicePool, buffer, opts);
    }

    /**
     * @param {number} velocity
     * @param {number} radius
     * @param {string} surfaceMaterial
     * @param {string} id
     * @param {number} [volumeScale=1]
     * @param {number} [dopplerRate=1]
     */
    _playSurfaceHitInternal(velocity, radius, surfaceMaterial, id, volumeScale = 1, dopplerRate = 1) {
        const token = { id };
        if (!this.voicePool.tryAcquire(token)) return;
        try {
            this._synthesizeSurfaceHit(velocity, radius, surfaceMaterial, volumeScale, dopplerRate);
        } finally {
            setTimeout(() => this.voicePool.release(token), 350);
        }
    }

    /**
     * Play marble-to-surface collision sound
     * @param {number} velocity - Impact velocity (0-30)
     * @param {number} [radius=0.5] - Marble radius (affects pitch)
     * @param {string} [surfaceMaterial='wood'] - 'wood', 'metal', 'concrete', 'glass'
     * @param {string} [id='surface'] - Collision ID for cooldown
     * @param {number} [dopplerRate=1] - Playback-rate multiplier from relative marble/camera motion
     */
    playSurfaceHit(velocity, radius = 0.5, surfaceMaterial = 'wood', id = 'surface', dopplerRate = 1) {
        if (this.soundDefs) {
            this.playCollision({
                velocity,
                radius,
                marbleMaterial: 'glass',
                surfaceMaterial,
                id,
                dopplerRate,
            });
            return;
        }
        this._playSurfaceHitInternal(velocity, radius, surfaceMaterial, id, 1, dopplerRate);
    }

    /**
     * @param {number} velocity
     * @param {number} radius
     * @param {string} surfaceMaterial
     * @param {number} [volumeScale=1]
     * @param {number} [dopplerRate=1]
     */
    _synthesizeSurfaceHit(velocity, radius, surfaceMaterial, volumeScale = 1, dopplerRate = 1) {
        if (!this.enabled || !this.ctx || this.muted) return;
        synthesizeSurfaceHit(this.ctx, this.sfxBus, velocity, radius, surfaceMaterial, volumeScale, dopplerRate);
    }

    /**
     * Start rolling sound for a marble
     * @param {string} id - Marble identifier
     * @param {number} [radius=0.5] - Marble radius (affects pitch)
     * @param {string} [surfaceMaterial='wood'] - 'wood', 'metal', 'concrete'
     */
    startRolling(id, radius = 0.5, surfaceMaterial = 'wood') {
        if (!this.enabled || !this.ctx || this.muted) return;
        this.rollingManager.startRolling(this.ctx, this.sfxBus, id, radius, surfaceMaterial);
    }

    /**
     * Update rolling sound based on marble velocity
     * @param {string} id - Marble identifier
     * @param {number} velocity - Current velocity
     * @param {number} [angularVel=0] - Angular velocity (for texture variation)
     * @param {number} [dopplerRate=1] - Playback-rate multiplier from relative marble/camera motion
     */
    updateRolling(id, velocity, angularVel = 0, dopplerRate = 1) {
        this.rollingManager.updateRolling(this.ctx, id, velocity, angularVel, dopplerRate);
    }

    /**
     * Stop rolling sound for a marble
     * @param {string} id - Marble identifier
     */
    stopRolling(id) {
        this.rollingManager.stopRolling(this.ctx, id);
    }

    /**
     * Stop all rolling sounds
     */
    stopAllRolling() {
        this.rollingManager.stopAllRolling(this.ctx);
    }

    /**
     * Play a heavy stomp impact sound
     */
    playStomp() {
        if (!this.enabled || !this.ctx) return;
        synthesizeStomp(this.ctx, this.sfxBus);
    }
}

// Singleton instance for easy importing
export const audio = new MarbleAudio();
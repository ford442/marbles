/**
 * Marble Audio System - Procedural Clink Synthesis & Audio Pipeline Orchestrator
 * Uses Web Audio API for zero-dependency, high-performance sound generation.
 */

import { VoicePool } from './audio/voice-pool.js';
import { loadSoundBank, getSoundDef, resolveSynthesisProfile, soundProperties } from './audio/sound-bank.js';
import { resolveCollisionSound } from './audio/collision-matrix.js';
import { MusicManager } from './audio/music-manager.js';
import { synthesizeSurfaceHit } from './audio/surface-synth.js';
import {
    synthesizeClink,
    synthesizeBoost,
    synthesizeThud,
    synthesizeGoal,
    synthesizeCollect,
    synthesizeJump,
    synthesizeTrick,
    synthesizeStomp,
} from './audio/procedural-sfx.js';
import { RollingSoundManager } from './audio/rolling-sound.js';
import { playSpatialBuffer } from './audio/spatial-audio.js';
import { ReverbZoneManager } from './audio/reverb-zones.js';

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
        this.rollingManager = new RollingSoundManager();
        this._paused = false;
        this._focusActive = false;
        this._savedMasterVolume = null;
        this.reverbZones = new ReverbZoneManager();
    }

    /** @returns {GainNode | null} SFX output bus */
    get sfxBus() {
        return this.sfxGain || this.masterGain;
    }

    /** @returns {Map<string, object>} */
    get rollingSounds() {
        return this.rollingManager.sounds;
    }

    set rollingSounds(val) {
        if (this.rollingManager) {
            this.rollingManager.sounds = val;
        }
    }

    /**
     * Register a physics body with a material type for collision sounds
     * @param {RAPIER.RigidBody} body - The physics body
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

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn('[Audio] Web Audio API not supported');
            return;
        }

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._volume * this._masterVolume;

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

        // Parallel wet send for per-zone convolution reverb. The dry path
        // above (sfxGain -> masterFilter) is untouched; this send starts
        // silent and is only opened while the listener is inside a zone
        // with a `reverb` config (see ReverbZoneManager).
        this.reverbZones.attach(this.ctx, this.sfxGain, this.masterFilter);

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
     * Register a spherical convolution-reverb trigger volume. The listener
     * must be within `radius` of `center` for `config` (decay/wetMix/preDelay)
     * to apply.
     * @param {{ x: number, y: number, z: number }} center
     * @param {number} radius
     * @param {{ decay: number, wetMix: number, preDelay?: number }} config
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
     * @param {{ velocity: number, radius?: number, marbleMaterial?: string, surfaceMaterial?: string, id?: string, position?: { x: number, y: number, z: number } | null, dopplerRate?: number }} options
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
                spatial: props.spatial && position,
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
     * @param {'bomb'|'missile'|'blink'|'teleport'|'emp'|'jump'|'goal'} abilityId
     * @param {{ x: number, y: number, z: number } | null} [position]
     */
    playAbility(abilityId, position = null) {
        const soundId = ABILITY_SOUND_IDS[abilityId];
        if (!soundId) return this._playAbilityProcedural(abilityId, position);

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
     * @param {object} opts
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
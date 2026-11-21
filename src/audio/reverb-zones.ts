/**
 * Per-zone convolution reverb: a small set of spherical trigger volumes,
 * each carrying its own procedurally-generated impulse response. The
 * listener position is checked once per frame; entering/leaving a zone
 * crossfades a shared wet send into a shared ConvolverNode.
 */

import { generateSyntheticImpulseResponse } from './impulse-response.ts';

const CROSSFADE_TIME = 0.15;

/** A zone's reverb character (`reverb` on a level zone). */
export interface ReverbConfig {
    decay: number;
    wetMix: number;
    preDelay?: number;
}

export interface ReverbZone {
    center: { x: number; y: number; z: number };
    radiusSq: number;
    config: ReverbConfig;
}

export class ReverbZoneManager {
    declare ctx: BaseAudioContext | null;
    declare reverbSend: GainNode | null;
    declare convolver: ConvolverNode | null;
    declare zones: ReverbZone[];
    declare _irCache: Map<string, AudioBuffer>;
    declare _activeZone: ReverbZone | null;

    constructor() {
        this.ctx = null;
        this.reverbSend = null;
        this.convolver = null;
        this.zones = [];
        this._irCache = new Map();
        this._activeZone = null;
    }

    /**
     * Wire the wet send in parallel with an existing dry connection.
     * The dry path (sourceNode -> destinationNode, set up elsewhere) is
     * untouched; this only adds sourceNode -> reverbSend -> convolver -> destinationNode.
     * @param sourceNode Dry bus to tap (e.g. sfxGain).
     * @param destinationNode Where the wet signal rejoins (e.g. masterFilter).
     */
    attach(ctx: BaseAudioContext, sourceNode: AudioNode, destinationNode: AudioNode): void {
        this.ctx = ctx;
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0;
        this.convolver = ctx.createConvolver();
        sourceNode.connect(this.reverbSend);
        this.reverbSend.connect(this.convolver);
        this.convolver.connect(destinationNode);
    }

    /** Register a spherical reverb trigger volume. */
    registerZone(center: { x: number; y: number; z: number }, radius: number, config: ReverbConfig): void {
        this.zones.push({ center, radiusSq: radius * radius, config });
    }

    /** Drop all registered zones and silence the wet send (call on level unload). */
    unregisterAll(): void {
        this.zones = [];
        this._activeZone = null;
        if (this.reverbSend && this.ctx) {
            this.reverbSend.gain.setTargetAtTime(0, this.ctx.currentTime, CROSSFADE_TIME);
        }
    }

    /**
     * Re-evaluate which zone (if any) contains (x, y, z) and crossfade to it.
     * Call once per frame with the listener/camera position.
     */
    update(x: number, y: number, z: number): void {
        // attach() sets ctx, reverbSend and convolver together.
        const ctx = this.ctx;
        const convolver = this.convolver;
        if (!ctx || !this.reverbSend || !convolver) return;

        let found: ReverbZone | null = null;
        for (const zone of this.zones) {
            const dx = x - zone.center.x, dy = y - zone.center.y, dz = z - zone.center.z;
            if (dx * dx + dy * dy + dz * dz <= zone.radiusSq) {
                found = zone;
                break;
            }
        }

        if (found === this._activeZone) return;
        this._activeZone = found;
        const t = ctx.currentTime;

        if (!found) {
            this.reverbSend.gain.setTargetAtTime(0, t, CROSSFADE_TIME);
            return;
        }

        convolver.buffer = this._getOrCreateImpulse(ctx, found.config.decay, found.config.preDelay ?? 0);
        this.reverbSend.gain.setTargetAtTime(found.config.wetMix, t, CROSSFADE_TIME);
    }

    _getOrCreateImpulse(ctx: BaseAudioContext, decay: number, preDelay: number): AudioBuffer {
        const key = `${decay.toFixed(2)}:${preDelay.toFixed(2)}`;
        let buffer = this._irCache.get(key);
        if (!buffer) {
            buffer = generateSyntheticImpulseResponse(ctx, decay, preDelay);
            this._irCache.set(key, buffer);
        }
        return buffer;
    }
}

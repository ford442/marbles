/**
 * Per-zone convolution reverb: a small set of spherical trigger volumes,
 * each carrying its own procedurally-generated impulse response. The
 * listener position is checked once per frame; entering/leaving a zone
 * crossfades a shared wet send into a shared ConvolverNode.
 */

import { generateSyntheticImpulseResponse } from './impulse-response.js';

const CROSSFADE_TIME = 0.15;

export class ReverbZoneManager {
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
     * @param {AudioContext} ctx
     * @param {AudioNode} sourceNode Dry bus to tap (e.g. sfxGain).
     * @param {AudioNode} destinationNode Where the wet signal rejoins (e.g. masterFilter).
     */
    attach(ctx, sourceNode, destinationNode) {
        this.ctx = ctx;
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0;
        this.convolver = ctx.createConvolver();
        sourceNode.connect(this.reverbSend);
        this.reverbSend.connect(this.convolver);
        this.convolver.connect(destinationNode);
    }

    /**
     * Register a spherical reverb trigger volume.
     * @param {{ x: number, y: number, z: number }} center
     * @param {number} radius
     * @param {{ decay: number, wetMix: number, preDelay?: number }} config
     */
    registerZone(center, radius, config) {
        this.zones.push({ center, radiusSq: radius * radius, config });
    }

    /** Drop all registered zones and silence the wet send (call on level unload). */
    unregisterAll() {
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
    update(x, y, z) {
        if (!this.ctx || !this.reverbSend) return;

        let found = null;
        for (const zone of this.zones) {
            const dx = x - zone.center.x, dy = y - zone.center.y, dz = z - zone.center.z;
            if (dx * dx + dy * dy + dz * dz <= zone.radiusSq) {
                found = zone;
                break;
            }
        }

        if (found === this._activeZone) return;
        this._activeZone = found;
        const t = this.ctx.currentTime;

        if (!found) {
            this.reverbSend.gain.setTargetAtTime(0, t, CROSSFADE_TIME);
            return;
        }

        this.convolver.buffer = this._getOrCreateImpulse(found.config.decay, found.config.preDelay ?? 0);
        this.reverbSend.gain.setTargetAtTime(found.config.wetMix, t, CROSSFADE_TIME);
    }

    _getOrCreateImpulse(decay, preDelay) {
        const key = `${decay.toFixed(2)}:${preDelay.toFixed(2)}`;
        let buffer = this._irCache.get(key);
        if (!buffer) {
            buffer = generateSyntheticImpulseResponse(this.ctx, decay, preDelay);
            this._irCache.set(key, buffer);
        }
        return buffer;
    }
}

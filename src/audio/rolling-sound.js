/**
 * Rolling sound synthesis and modulation for physics marbles.
 */

export const ROLLING_MATERIAL_PARAMS = {
    wood: { baseFreq: 200, freqRange: 150, q: 0.5 },
    metal: { baseFreq: 400, freqRange: 300, q: 1 },
    concrete: { baseFreq: 100, freqRange: 80, q: 0.3 },
    glass: { baseFreq: 300, freqRange: 200, q: 0.8 },
    rubber: { baseFreq: 140, freqRange: 90, q: 0.4 },
};

export class RollingSoundManager {
    constructor() {
        /** @type {Map<string, { noise: AudioBufferSourceNode, gain: GainNode, filter: BiquadFilterNode, params: object, sizeMult: number }>} */
        this.sounds = new Map();
    }

    /**
     * Start rolling sound for a marble
     * @param {AudioContext} ctx
     * @param {AudioNode} outputNode
     * @param {string} id
     * @param {number} [radius=0.5]
     * @param {string} [surfaceMaterial='wood']
     */
    startRolling(ctx, outputNode, id, radius = 0.5, surfaceMaterial = 'wood') {
        if (!ctx || !outputNode) return;

        // Stop any existing rolling sound for this marble
        this.stopRolling(ctx, id);

        const t = ctx.currentTime;

        // Create nodes
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        const params = ROLLING_MATERIAL_PARAMS[surfaceMaterial] || ROLLING_MATERIAL_PARAMS.wood;

        // Size affects rolling pitch (smaller = higher)
        const sizeMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);

        // Create noise buffer for rolling texture
        const bufferSize = ctx.sampleRate * 2; // 2 second loop
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Brownian noise (deeper rumble) for rolling
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3; // Boost gain
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Filter setup
        filter.type = 'bandpass';
        filter.frequency.value = params.baseFreq * sizeMult;
        filter.Q.value = params.q;

        // Connect graph
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(outputNode);

        // Start silent - will be modulated by velocity
        gain.gain.setValueAtTime(0, t);

        noise.start(t);

        // Store reference
        this.sounds.set(id, {
            noise,
            gain,
            filter,
            params,
            sizeMult,
        });
    }

    /**
     * Update rolling sound based on marble velocity
     * @param {AudioContext} ctx
     * @param {string} id
     * @param {number} velocity
     * @param {number} [angularVel=0]
     * @param {number} [dopplerRate=1] Playback-rate multiplier from relative marble/camera motion.
     */
    updateRolling(ctx, id, velocity, angularVel = 0, dopplerRate = 1) {
        if (!ctx) return;

        const sound = this.sounds.get(id);
        if (!sound) return;

        const t = ctx.currentTime;
        const normalizedVel = Math.min(velocity / 15, 1); // Cap at 15 units/sec

        sound.noise.playbackRate.setTargetAtTime(dopplerRate, t, 0.1);

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
     * @param {AudioContext} ctx
     * @param {string} id
     */
    stopRolling(ctx, id) {
        const sound = this.sounds.get(id);
        if (!sound) return;

        if (ctx) {
            const t = ctx.currentTime;
            // Fade out quickly
            sound.gain.gain.setTargetAtTime(0, t, 0.05);
        }

        // Stop after fade
        setTimeout(() => {
            try {
                sound.noise.stop();
                sound.noise.disconnect();
                sound.gain.disconnect();
                sound.filter.disconnect();
            } catch {
                // Already stopped
            }
        }, 100);

        this.sounds.delete(id);
    }

    /**
     * Stop all rolling sounds
     * @param {AudioContext} ctx
     */
    stopAllRolling(ctx) {
        for (const id of this.sounds.keys()) {
            this.stopRolling(ctx, id);
        }
    }
}

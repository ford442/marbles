/**
 * Procedural impulse-response generation for convolution reverb.
 *
 * The project has no recorded audio samples anywhere (every sound is
 * synthesized), so reverb impulse responses are generated at runtime too —
 * a noise burst shaped by an exponential decay envelope, rather than an
 * authored .wav asset.
 */

const MAX_DECAY_SECONDS = 8;
const MAX_PRE_DELAY_SECONDS = 0.5;

/**
 * Synthesize a stereo impulse response for use with a ConvolverNode.
 * @param {AudioContext} ctx
 * @param {number} decaySeconds RT-ish decay time; higher = longer tail.
 * @param {number} [preDelaySeconds=0] Silence before the tail starts.
 * @returns {AudioBuffer}
 */
export function generateSyntheticImpulseResponse(ctx, decaySeconds, preDelaySeconds = 0) {
    const decay = Math.min(Math.max(decaySeconds, 0.1), MAX_DECAY_SECONDS);
    const preDelay = Math.min(Math.max(preDelaySeconds, 0), MAX_PRE_DELAY_SECONDS);
    const preDelaySamples = Math.floor(preDelay * ctx.sampleRate);
    const tailSamples = Math.floor(decay * ctx.sampleRate);
    const length = preDelaySamples + tailSamples;

    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = preDelaySamples; i < length; i++) {
            const t = (i - preDelaySamples) / ctx.sampleRate;
            const envelope = Math.exp(-5 * (t / decay));
            // Independent noise per channel decorrelates the tail for stereo width.
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
    }
    return buffer;
}

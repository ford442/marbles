/**
 * Buffer playback with spatial HRTF panning and voice pool management.
 */

import { scheduleVoiceStop } from './voice-pool.js';

/**
 * Play a decoded AudioBuffer with optional 3D HRTF panning and rate/gain modulation.
 * @param {AudioContext} ctx
 * @param {AudioNode} sfxBus
 * @param {import('./voice-pool.js').VoicePool} voicePool
 * @param {AudioBuffer} buffer
 * @param {{ pitch?: number, volume?: number, spatial?: boolean, position?: { x: number, y: number, z: number } | null, maxDistance?: number, id?: string }} opts
 */
export function playSpatialBuffer(ctx, sfxBus, voicePool, buffer, opts) {
    if (!ctx || !sfxBus || !voicePool || !buffer) return;
    if (!voicePool.tryAcquire(opts)) return;

    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = opts.pitch ?? 1;

    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 0.7;

    const nodes = [source, gain];
    let output = gain;

    if (opts.spatial && opts.position && ctx.createPanner) {
        const panner = ctx.createPanner();
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

    output.connect(sfxBus);
    source.start(t);
    const stopAt = t + buffer.duration / (opts.pitch || 1);
    source.stop(stopAt);
    scheduleVoiceStop(ctx, nodes, stopAt, () => voicePool.release(opts));
}

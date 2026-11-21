/**
 * Buffer playback with spatial HRTF panning and voice pool management.
 */

import { scheduleVoiceStop } from './voice-pool.ts';
import type { StoppableNode, VoicePool } from './voice-pool.ts';

/** A world-space point. */
export interface AudioPosition {
    x: number;
    y: number;
    z: number;
}

/** Per-play options; the object itself is the voice-pool token. */
export interface SpatialPlayOptions {
    pitch?: number;
    volume?: number;
    spatial?: boolean;
    position?: AudioPosition | null;
    maxDistance?: number;
    id?: string;
    dopplerRate?: number;
}

/**
 * Play a decoded AudioBuffer with optional 3D HRTF panning and rate/gain modulation.
 */
export function playSpatialBuffer(
    ctx: BaseAudioContext | null,
    sfxBus: AudioNode | null,
    voicePool: VoicePool | null,
    buffer: AudioBuffer | null | undefined,
    opts: SpatialPlayOptions,
): void {
    if (!ctx || !sfxBus || !voicePool || !buffer) return;
    if (!voicePool.tryAcquire(opts)) return;

    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = (opts.pitch ?? 1) * (opts.dopplerRate ?? 1);

    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 0.7;

    const nodes: StoppableNode[] = [source, gain];
    let output: AudioNode = gain;

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
    const stopAt = t + buffer.duration / (source.playbackRate.value || 1);
    source.stop(stopAt);
    scheduleVoiceStop(ctx, nodes, stopAt, () => voicePool.release(opts));
}

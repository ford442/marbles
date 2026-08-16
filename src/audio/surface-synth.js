/**
 * Surface impact synthesis with material-specific harmonic profiles.
 */

export const SURFACE_MATERIAL_SYNTH_PARAMS = {
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

/**
 * Synthesize a material-specific surface hit sound.
 * @param {AudioContext} ctx
 * @param {AudioNode} outputNode
 * @param {number} velocity
 * @param {number} radius
 * @param {string} surfaceMaterial
 * @param {number} volumeScale
 */
export function synthesizeSurfaceHit(ctx, outputNode, velocity, radius = 0.5, surfaceMaterial = 'wood', volumeScale = 1) {
    if (!ctx || !outputNode) return;

    const normalizedVel = Math.min(Math.max(velocity, 0), 30) / 30;
    if (normalizedVel < 0.03) return;

    const sizePitchMult = 1.5 - (radius - 0.3) * (0.8 / 0.5);
    const t = ctx.currentTime;

    const params = SURFACE_MATERIAL_SYNTH_PARAMS[surfaceMaterial] || SURFACE_MATERIAL_SYNTH_PARAMS.wood;
    const pitch = params.baseFreq * sizePitchMult;

    const gain = ctx.createGain();
    gain.connect(outputNode);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = params.noiseFreq * sizePitchMult;
    noiseFilter.Q.value = params.noiseQ;

    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);

    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(normalizedVel * 0.5 * volumeScale, t + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    noise.start(t);
    noise.stop(t + 0.05);

    params.harmonics.forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

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

/**
 * Per-chapter music stems with crossfade (procedural pads when no audio files loaded).
 */

const CHAPTER_STEMS = {
    tutorial: { freq: 220, detune: 0, color: [0.35, 0.45, 0.55] },
    classic: { freq: 196, detune: 3, color: [0.4, 0.38, 0.5] },
    neon: { freq: 130, detune: 7, color: [0.5, 0.2, 0.65] },
    extreme: { freq: 98, detune: -2, color: [0.55, 0.15, 0.2] },
    expert: { freq: 110, detune: 5, color: [0.45, 0.25, 0.35] },
};

export class MusicManager {
    /**
     * @param {AudioContext} ctx
     * @param {GainNode} musicGain
     */
    constructor(ctx, musicGain) {
        this.ctx = ctx;
        this.musicGain = musicGain;
        this.currentChapter = null;
        /** @type {{ oscs: OscillatorNode[], gain: GainNode } | null} */
        this.activeStem = null;
        this._volume = 0.5;
        this._enabled = true;
    }

    setVolume(vol) {
        this._volume = Math.max(0, Math.min(1, vol));
        if (this.activeStem?.gain) {
            this.activeStem.gain.gain.setTargetAtTime(this._enabled ? this._volume * 0.35 : 0, this.ctx.currentTime, 0.15);
        }
    }

    setEnabled(enabled) {
        this._enabled = enabled;
        this.setVolume(this._volume);
    }

    /**
     * @param {string | undefined | null} chapter
     * @param {number} [fadeSec]
     */
    crossfadeToChapter(chapter, fadeSec = 1.2) {
        const key = chapter && CHAPTER_STEMS[chapter] ? chapter : 'classic';
        if (key === this.currentChapter && this.activeStem) return;

        const t = this.ctx.currentTime;
        const prev = this.activeStem;
        this.currentChapter = key;
        this.activeStem = this._createStem(CHAPTER_STEMS[key], fadeSec);

        if (prev) {
            prev.gain.gain.setTargetAtTime(0, t, fadeSec * 0.35);
            const stopAt = t + fadeSec + 0.5;
            for (const osc of prev.oscs) {
                try { osc.stop(stopAt); } catch { /* noop */ }
            }
            setTimeout(() => {
                try {
                    prev.gain.disconnect();
                    for (const osc of prev.oscs) osc.disconnect();
                } catch { /* noop */ }
            }, (fadeSec + 0.6) * 1000);
        }
    }

    /**
     * @param {{ freq: number, detune: number, color: number[] }} spec
     * @param {number} fadeSec
     */
    _createStem(spec, fadeSec) {
        const t = this.ctx.currentTime;
        const stemGain = this.ctx.createGain();
        stemGain.gain.setValueAtTime(0, t);
        stemGain.gain.linearRampToValueAtTime(this._enabled ? this._volume * 0.35 : 0, t + fadeSec);
        stemGain.connect(this.musicGain);

        const oscs = [];
        const ratios = [1, 1.5, 2];
        for (let i = 0; i < ratios.length; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = spec.freq * ratios[i];
            osc.detune.value = spec.detune * 100;
            const g = this.ctx.createGain();
            g.gain.value = spec.color[i % 3] * (0.5 / ratios[i]);
            osc.connect(g);
            g.connect(stemGain);
            osc.start(t);
            oscs.push(osc);
        }

        return { oscs, gain: stemGain };
    }

    stop() {
        if (!this.activeStem) return;
        const t = this.ctx.currentTime;
        this.activeStem.gain.gain.setTargetAtTime(0, t, 0.4);
        for (const osc of this.activeStem.oscs) {
            try { osc.stop(t + 0.6); } catch { /* noop */ }
        }
        this.activeStem = null;
        this.currentChapter = null;
    }
}

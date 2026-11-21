/**
 * Per-chapter music stems with crossfade (procedural pads when no audio files loaded).
 */

/** A procedural pad: root frequency, detune (semitones) and per-partial gains. */
interface ChapterStem {
    freq: number;
    detune: number;
    color: readonly [number, number, number];
}

/** A live stem: its oscillators and the gain they mix into. */
interface ActiveStem {
    oscs: OscillatorNode[];
    gain: GainNode;
}

const CLASSIC_STEM: ChapterStem = { freq: 196, detune: 3, color: [0.4, 0.38, 0.5] };

const CHAPTER_STEMS: Readonly<Partial<Record<string, ChapterStem>>> = {
    tutorial: { freq: 220, detune: 0, color: [0.35, 0.45, 0.55] },
    classic: CLASSIC_STEM,
    neon: { freq: 130, detune: 7, color: [0.5, 0.2, 0.65] },
    extreme: { freq: 98, detune: -2, color: [0.55, 0.15, 0.2] },
    expert: { freq: 110, detune: 5, color: [0.45, 0.25, 0.35] },
};

/** Partial frequency ratios of every stem (root, fifth, octave). */
const STEM_RATIOS = [1, 1.5, 2] as const;

export class MusicManager {
    declare ctx: BaseAudioContext;
    declare musicGain: AudioNode;
    declare currentChapter: string | null;
    declare activeStem: ActiveStem | null;
    declare _volume: number;
    declare _enabled: boolean;

    constructor(ctx: BaseAudioContext, musicGain: AudioNode) {
        this.ctx = ctx;
        this.musicGain = musicGain;
        this.currentChapter = null;
        this.activeStem = null;
        this._volume = 0.5;
        this._enabled = true;
    }

    setVolume(vol: number): void {
        this._volume = Math.max(0, Math.min(1, vol));
        if (this.activeStem?.gain) {
            this.activeStem.gain.gain.setTargetAtTime(this._enabled ? this._volume * 0.35 : 0, this.ctx.currentTime, 0.15);
        }
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        this.setVolume(this._volume);
    }

    crossfadeToChapter(chapter: string | undefined | null, fadeSec = 1.2): void {
        const requested = chapter ? CHAPTER_STEMS[chapter] : undefined;
        const key = chapter && requested ? chapter : 'classic';
        if (key === this.currentChapter && this.activeStem) return;

        const t = this.ctx.currentTime;
        const prev = this.activeStem;
        this.currentChapter = key;
        this.activeStem = this._createStem(requested ?? CLASSIC_STEM, fadeSec);

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

    _createStem(spec: ChapterStem, fadeSec: number): ActiveStem {
        const t = this.ctx.currentTime;
        const stemGain = this.ctx.createGain();
        stemGain.gain.setValueAtTime(0, t);
        stemGain.gain.linearRampToValueAtTime(this._enabled ? this._volume * 0.35 : 0, t + fadeSec);
        stemGain.connect(this.musicGain);

        const oscs: OscillatorNode[] = [];
        STEM_RATIOS.forEach((ratio, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = spec.freq * ratio;
            osc.detune.value = spec.detune * 100;
            const g = this.ctx.createGain();
            // STEM_RATIOS and `color` both have three entries.
            g.gain.value = (spec.color[i % 3] ?? 0) * (0.5 / ratio);
            osc.connect(g);
            g.connect(stemGain);
            osc.start(t);
            oscs.push(osc);
        });

        return { oscs, gain: stemGain };
    }

    stop(): void {
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

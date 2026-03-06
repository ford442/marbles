import { RbsSong } from './types';
import { RbsParser } from './RbsParser';

const DRUM_MAP_16_TO_32: Record<number, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  9: 18,
  10: 20,
  11: 22,
  12: 24,
  13: 26,
  14: 28,
  15: 30,
};

export function importRbsFile(path: string): RbsSong {
  const song = RbsParser.fromFile(path);
  // convert 16-step patterns to 32-step internally
  song.tracks.forEach((track) => {
    track.patterns.forEach((pat) => {
      if (pat.steps.length === 16) {
        const newSteps = new Array(32).fill(0);
        for (let i = 0; i < 16; i++) {
          const idx = DRUM_MAP_16_TO_32[i];
          newSteps[idx] = pat.steps[i];
          // leave the following slot silent by default
        }
        pat.steps = newSteps;
      }
    });
  });
  // simple drum mapping placeholder
  song.tracks.forEach((track) => {
    track.instrument = track.instrument.replace('D', 'Drum');
  });
  return song;
}
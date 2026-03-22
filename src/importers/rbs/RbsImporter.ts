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

// map simple drum instrument names to Hyphon-friendly labels
const DRUM_NAME_MAP: Record<string, string> = {
    '808': 'TR-808',
    '909': 'TR-909',
};

export function importRbsFile(path: string): RbsSong {
    const song = RbsParser.fromFile(path);
    // convert 16-step patterns to 32-step internally and apply mapping
    song.tracks.forEach((track) => {
        track.patterns.forEach((pat) => {
            if (pat.steps.length === 16) {
                const newSteps = new Array(32).fill(0);
                for (let i = 0; i < 16; i++) {
                    const idx = DRUM_MAP_16_TO_32[i];
                    newSteps[idx] = pat.steps[i];
                }
                pat.steps = newSteps;
            }
        });
        // map drum names if applicable
        if (DRUM_NAME_MAP[track.instrument]) {
            track.instrument = DRUM_NAME_MAP[track.instrument];
        } else {
            track.instrument = track.instrument.replace('D', 'Drum');
        }
    });
    return song;
}
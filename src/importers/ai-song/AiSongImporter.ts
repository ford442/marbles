import { AISongData, VersionHistoryEntry } from './types';
import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.resolve(__dirname, '../../../songs/ai-generated');

export function ensureGeneratedDir() {
    if (!fs.existsSync(GENERATED_DIR)) {
        fs.mkdirSync(GENERATED_DIR, { recursive: true });
    }
}

export function normalizeAISong(data: any): AISongData {
    // ensure tracks array exists and each track has an automation array
    if (Array.isArray(data.tracks)) {
        data.tracks.forEach((tr: any) => {
            if (!Array.isArray(tr.automation)) tr.automation = [];
        });
    }
    return data as AISongData;
}

export function saveAISongData(data: AISongData, sourceAI: string): string {
    ensureGeneratedDir();
    data = normalizeAISong(data);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${data.title || 'untitled'}_${ts}.json`;
    const filePath = path.join(GENERATED_DIR, fileName);
    const historyEntry: VersionHistoryEntry = {
        timestamp: ts,
        sourceAI,
    };
    const payload = { data, history: [historyEntry] };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return filePath;
}

export function appendVersionHistory(filePath: string, sourceAI: string) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const entry: VersionHistoryEntry = { timestamp: ts, sourceAI };
        if (!Array.isArray(json.history)) json.history = [];
        json.history.push(entry);
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to append history', e);
    }
}

export function validateAISongData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.tempo !== 'number') return false;
    if (!Array.isArray(data.tracks)) return false;

    // each track should have at least an instrument string
    for (const tr of data.tracks) {
        if (!tr || typeof tr.instrument !== 'string') return false;
        if (tr.automation) {
            if (!Array.isArray(tr.automation)) return false;
            for (const lane of tr.automation) {
                if (typeof lane.parameter !== 'string' || !Array.isArray(lane.points)) return false;
                for (const pt of lane.points) {
                    if (typeof pt.time !== 'number' || typeof pt.value !== 'number') return false;
                }
            }
        }
    }

    return true;
}
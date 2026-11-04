/**
 * Every level the completability harness covers: the shipped manifest maps
 * (as the game converts them) and the dev-only DEV_LEVELS table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapToRuntimeLevel } from '../../src/levels/map-normalize.js';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadManifest() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8'));
}

/** @returns {Array<{ id: string, file: string, map: any, level: any }>} */
export function manifestLevels() {
    const manifest = loadManifest();
    return Object.entries(manifest.maps || {}).map(([id, entry]) => {
        const file = path.join(ROOT, 'assets', String(entry.file).replace(/^assets\//, ''));
        const map = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { id, file: path.relative(ROOT, file), map, level: mapToRuntimeLevel(map, 'json') };
    });
}

/** @returns {Promise<Array<{ id: string, level: any }>>} */
export async function devLevels() {
    const { DEV_LEVELS } = await import('../../src/levels.ts');
    return Object.entries(DEV_LEVELS).map(([id, level]) => ({ id, level }));
}

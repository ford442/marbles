/**
 * "No new JS level without a JSON map": DEV_LEVELS may only hold entries
 * that carry an explicit `devOnly` reason, and none may shadow a shipped or
 * on-disk JSON map. Adding a code-only level without saying why fails CI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, devLevels, loadManifest } from './level-sources.js';

console.log('test_dev_levels_policy.js');

const manifest = loadManifest();
const mapIds = new Set(
    fs.readdirSync(path.join(ROOT, 'assets', 'maps'))
        .filter((f) => f.endsWith('.json') && f !== 'TEMPLATE.json')
        .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', f), 'utf8')).id),
);

const problems = [];
const levels = await devLevels();
for (const { id, level } of levels) {
    if (manifest.maps?.[id] || mapIds.has(id)) {
        problems.push(`${id}: a JSON map with this id exists — delete the DEV_LEVELS entry (JSON is the source of truth)`);
    }
    if (typeof level.devOnly !== 'string' || level.devOnly.trim().length < 20) {
        problems.push(`${id}: missing a devOnly reason — ship it as a JSON map (assets/maps/) or say why it stays code-only`);
    }
}
assert.deepEqual(problems, [], `DEV_LEVELS policy violations:\n  ${problems.join('\n  ')}`);
console.log(`✓ ${levels.length} DEV_LEVELS entries each carry a devOnly reason and shadow no JSON map`);

/**
 * "Every campaign map is replayable": each manifest map listed in a campaign
 * chapter must record a `solution` (replayed by test_manifest_levels.js) with a
 * recorded `par`, so physics/primitive regressions can't silently break it.
 * The only exemption is an explicit `"goalless": true` free-roam map (sandbox).
 * Record one with: npm run level:lab -- assets/maps/<id>.json --waypoints '[[x,z],...]' --write
 */
import assert from 'node:assert/strict';
import { manifestLevels } from './level-sources.js';
import { CAMPAIGN_CHAPTERS } from '../../src/levels/campaign.js';

console.log('test_campaign_solutions_policy.js');

const byId = new Map(manifestLevels().map((l) => [l.id, l]));
const problems = [];
let covered = 0;
let exempt = 0;
for (const chapter of CAMPAIGN_CHAPTERS) {
    for (const id of chapter.levels) {
        const entry = byId.get(id);
        if (!entry) {
            problems.push(`${id} (chapter ${chapter.id}): not in assets/manifest.json`);
            continue;
        }
        if (entry.map.goalless === true) {
            if (entry.map.solution) problems.push(`${id}: goalless maps can't have a solution — drop one or the other`);
            exempt++;
            continue;
        }
        const sol = entry.map.solution;
        if (!sol?.inputs?.length) {
            problems.push(`${id} (${entry.file}): campaign map has no recorded solution`);
        } else if (!(sol.par > 0)) {
            problems.push(`${id} (${entry.file}): solution has no recorded par — re-record with level:lab --write`);
        } else {
            covered++;
        }
    }
}
assert.deepEqual(problems, [], `campaign solution policy violations:\n  ${problems.join('\n  ')}`);
console.log(`✓ ${covered} campaign maps record a solution + par (${exempt} goalless exempt)`);

/**
 * Campaign chapter assignment tests.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CAMPAIGN_CHAPTERS,
  LEVEL_UNLOCK_SLACK,
  getChapterForLevel,
  isLevelUnlockedInChapter,
  LEVEL_CHAPTER_OVERRIDES,
} from '../src/levels/campaign.js';

console.log('test_campaign_chapters.js');

console.assert(
  getChapterForLevel('tutorial') === 'tutorial',
  'override: tutorial'
);
console.assert(
  getChapterForLevel('landing') === 'tutorial',
  'override: landing'
);
console.assert(
  getChapterForLevel('full_course') === 'expert',
  'override: full_course'
);

// JSON chapter field (after override check, before heuristics)
console.assert(
  getChapterForLevel('custom_neon_level', { chapter: 'neon', difficulty: 'easy' }) === 'neon',
  'json chapter field'
);
console.assert(
  getChapterForLevel('custom_plain_level', { chapter: 'invalid_chapter', difficulty: 'easy' }) ===
    'classic',
  'invalid json chapter falls through to heuristics'
);

// Override beats JSON chapter
console.assert(
  getChapterForLevel('landing', { chapter: 'neon' }) === 'tutorial',
  'override beats json chapter'
);

// Heuristic neon keyword
console.assert(
  getChapterForLevel('prismatic_speedway_run', { name: 'Prismatic Speedway' }) === 'neon',
  'heuristic neon keyword'
);

// Heuristic extreme
console.assert(
  getChapterForLevel('storm_peak_run', { name: 'Storm Peak' }) === 'extreme',
  'heuristic extreme keyword'
);

// Every shipped manifest map is listed in exactly one chapter, and its JSON
// `chapter` (when set) agrees with the list.
const manifest = JSON.parse(fs.readFileSync('assets/manifest.json', 'utf8'));
const listed = CAMPAIGN_CHAPTERS.flatMap((c) => c.levels);
assert.equal(new Set(listed).size, listed.length, 'a level is listed in more than one chapter');
for (const [id, entry] of Object.entries(manifest.maps)) {
  const chapter = CAMPAIGN_CHAPTERS.find((c) => c.levels.includes(id));
  assert.ok(chapter, `manifest map ${id} is not listed in any CAMPAIGN_CHAPTERS levels`);
  const map = JSON.parse(fs.readFileSync(`assets/${entry.file}`, 'utf8'));
  if (map.chapter) assert.equal(map.chapter, chapter.id, `${id}: map chapter "${map.chapter}" vs listed in "${chapter.id}"`);
}
for (const id of listed) assert.ok(manifest.maps[id], `CAMPAIGN_CHAPTERS lists ${id}, which is not in the manifest`);
for (const chapter of CAMPAIGN_CHAPTERS) {
  assert.ok(chapter.levels.length >= 6 && chapter.levels.length <= 12, `${chapter.id} should hold ~8 levels (has ${chapter.levels.length})`);
}

// In-chapter gating: the first SLACK + 1 levels are open; level i needs i - SLACK completions.
const neon = CAMPAIGN_CHAPTERS.find((c) => c.id === 'neon').levels;
const none = () => false;
for (let i = 0; i <= LEVEL_UNLOCK_SLACK; i++) assert.ok(isLevelUnlockedInChapter('neon', neon[i], none), `neon[${i}] open`);
assert.ok(!isLevelUnlockedInChapter('neon', neon[LEVEL_UNLOCK_SLACK + 1], none), 'next level gated');
const firstDone = (id) => id === neon[0];
assert.ok(isLevelUnlockedInChapter('neon', neon[LEVEL_UNLOCK_SLACK + 1], firstDone), 'one completion opens one more');
assert.ok(isLevelUnlockedInChapter('neon', 'some_workshop_map', none), 'unlisted levels are not gated');

console.log(`✓ Campaign chapters OK (${Object.keys(LEVEL_CHAPTER_OVERRIDES).length} overrides)`);

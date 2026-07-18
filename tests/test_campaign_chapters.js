/**
 * Campaign chapter assignment tests.
 */
import { getChapterForLevel, LEVEL_CHAPTER_OVERRIDES } from '../src/levels/campaign.js';

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

console.log(`✓ Campaign chapters OK (${Object.keys(LEVEL_CHAPTER_OVERRIDES).length} overrides)`);

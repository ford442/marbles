#!/usr/bin/env node
/**
 * Generate level pipeline inventory from manifest, map JSON files, and DEV_LEVELS.
 * Usage: node scripts/generate-level-inventory.cjs [--markdown]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'assets', 'maps');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'manifest.json');
const LEVELS_JS = path.join(ROOT, 'src', 'levels.js');
const CAMPAIGN_JS = path.join(ROOT, 'src', 'levels', 'campaign.js');
const REGISTRY_JS = path.join(ROOT, 'src', 'zone-setup', 'registry.js');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractDevLevelIds(levelsJs) {
  const ids = [];
  const re = /^\s{4}([a-z][a-z0-9_]*):\s*(?:\{|([a-z][a-z0-9_]*)\s*,?\s*$)/gm;
  let m;
  while ((m = re.exec(levelsJs)) !== null) {
    if (m[1] && m[1] !== 'spawn' && m[1] !== 'goals' && m[1] !== 'camera') {
      ids.push(m[1]);
    }
  }
  return [...new Set(ids)];
}

function extractChapterOverrides(campaignJs) {
  const block = campaignJs.match(/LEVEL_CHAPTER_OVERRIDES\s*=\s*\{([^}]+)\}/s);
  if (!block) return {};
  const overrides = {};
  const re = /^\s*([a-z0-9_]+):\s*'([^']+)'/gm;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    overrides[m[1]] = m[2];
  }
  return overrides;
}

function extractZoneHandlers(registryJs) {
  const handlers = new Set();
  const re = /^\s{4}([a-z0-9_]+):\s*\(/gm;
  let m;
  while ((m = re.exec(registryJs)) !== null) {
    handlers.add(m[1]);
  }
  return handlers;
}

function getChapterHeuristic(levelId, level, overrides) {
  if (overrides[levelId]) return `override:${overrides[levelId]}`;
  if (level.chapter) return `json:${level.chapter}`;

  const id = levelId.toLowerCase();
  const name = (level.name || '').toLowerCase();
  const difficulty = level.difficulty || 'medium';

  if (id.includes('tutorial')) return 'heuristic:tutorial';
  if (id === 'full_course' || difficulty === 'expert') return 'heuristic:expert';
  if (id.endsWith('_extreme') || difficulty === 'extreme') return 'heuristic:extreme';
  if (/neon|cyber|synth|prismatic|plasma|pulse|chrono|grid_run|alley/i.test(id + name)) {
    return 'heuristic:neon';
  }
  if (
    /extreme|volcano|lava|storm|abyssal|void|toxic|magnetic|gravity_well|frostbite|glacial/i.test(
      id + name
    ) ||
    difficulty === 'hard'
  ) {
    return 'heuristic:extreme';
  }
  if (difficulty === 'easy' && (id === 'landing' || id.includes('sandbox'))) {
    return id === 'landing' ? 'heuristic:tutorial' : 'heuristic:classic';
  }
  return 'heuristic:classic';
}

function resolveChapter(chapterField) {
  if (!chapterField) return '';
  const parts = chapterField.split(':');
  return parts[parts.length - 1];
}

function classifySource(id, inManifest, inDev, onDisk) {
  if (inManifest && inDev) return 'dual';
  if (inManifest) return 'json';
  if (onDisk && !inManifest && id.endsWith('_extreme')) return 'orphan-json';
  if (onDisk && !inManifest) return 'orphan-json';
  if (inDev) return 'code';
  if (onDisk) return 'orphan-json';
  return 'unknown';
}

function migrationStatus(source, inManifest) {
  if (source === 'json') return 'shipped';
  if (source === 'dual') return 'json-wins';
  if (source === 'orphan-json') return 'blocked (missing handlers / manifest)';
  return 'dev-only';
}

function buildInventory() {
  const manifest = loadJson(MANIFEST_PATH);
  const manifestIds = new Set(Object.keys(manifest.maps || {}));
  const levelsJs = fs.readFileSync(LEVELS_JS, 'utf8');
  const devIds = new Set(extractDevLevelIds(levelsJs));
  const overrides = extractChapterOverrides(fs.readFileSync(CAMPAIGN_JS, 'utf8'));
  const handlers = extractZoneHandlers(fs.readFileSync(REGISTRY_JS, 'utf8'));

  const mapFiles = fs
    .readdirSync(MAPS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'TEMPLATE.json');

  const mapById = {};
  for (const file of mapFiles) {
    const data = loadJson(path.join(MAPS_DIR, file));
    if (data.id) mapById[data.id] = { ...data, _file: file };
  }

  const allIds = new Set([...manifestIds, ...devIds, ...Object.keys(mapById)]);

  const rows = [];
  for (const id of [...allIds].sort()) {
    const inManifest = manifestIds.has(id);
    const inDev = devIds.has(id);
    const onDisk = Boolean(mapById[id]);
    const source = classifySource(id, inManifest, inDev, onDisk);
    const level = mapById[id] || {};
    const zoneTypes = [...new Set((level.zones || []).map((z) => z.type).filter(Boolean))];
    const unknownZones = zoneTypes.filter((t) => !handlers.has(t));
    const chapterField = getChapterHeuristic(id, level, overrides);
    const chapter = resolveChapter(chapterField);

    rows.push({
      id,
      source,
      in_manifest: inManifest,
      in_dev_levels: inDev,
      on_disk: onDisk,
      chapter,
      chapter_source: chapterField,
      zone_types: zoneTypes.join(', ') || '(dev inline)',
      unknown_zones: unknownZones.join(', ') || '',
      migration_status: migrationStatus(source, inManifest),
      difficulty: level.difficulty || manifest.maps?.[id]?.difficulty || '',
    });
  }

  return {
    generated_at: new Date().toISOString(),
    counts: {
      manifest: manifestIds.size,
      dev_levels: devIds.size,
      map_files: mapFiles.length,
      unique_ids: allIds.size,
      json_only: rows.filter((r) => r.source === 'json').length,
      code_only: rows.filter((r) => r.source === 'code').length,
      dual: rows.filter((r) => r.source === 'dual').length,
      orphan_json: rows.filter((r) => r.source === 'orphan-json').length,
    },
    rows,
  };
}

function toMarkdown(inventory) {
  const { counts, rows } = inventory;
  const lines = [
    '# Level Pipeline Inventory',
    '',
    `> Auto-generated inventory. Regenerate: \`node scripts/generate-level-inventory.cjs --markdown\``,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Manifest (production) | ${counts.manifest} |`,
    `| DEV_LEVELS entries | ${counts.dev_levels} |`,
    `| Map JSON files (excl. template) | ${counts.map_files} |`,
    `| Unique level ids | ${counts.unique_ids} |`,
    `| JSON-only | ${counts.json_only} |`,
    `| Code-only (dev) | ${counts.code_only} |`,
    `| Dual (JSON wins) | ${counts.dual} |`,
    `| Orphan JSON | ${counts.orphan_json} |`,
    '',
    '## Master table',
    '',
    '| id | source | manifest | dev | on_disk | chapter | zone_types | migration |',
    '|----|--------|:--------:|:---:|:-------:|---------|------------|-----------|',
  ];

  for (const r of rows) {
    const flags = (v) => (v ? 'yes' : '—');
    lines.push(
      `| \`${r.id}\` | ${r.source} | ${flags(r.in_manifest)} | ${flags(r.in_dev_levels)} | ${flags(r.on_disk)} | ${r.chapter} | ${r.zone_types.replace(/\|/g, '\\|')} | ${r.migration_status} |`
    );
  }

  return lines.join('\n');
}

const inventory = buildInventory();
const outJson = path.join(ROOT, 'docs', 'architecture', 'level-inventory.json');

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(inventory, null, 2));

if (process.argv.includes('--markdown')) {
  process.stdout.write(toMarkdown(inventory));
} else {
  console.log(`Wrote ${outJson} (${inventory.rows.length} levels)`);
}

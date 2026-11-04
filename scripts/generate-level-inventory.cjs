#!/usr/bin/env node
/**
 * Generate level pipeline inventory from manifest, map JSON files, and DEV_LEVELS.
 * Usage: node scripts/generate-level-inventory.cjs [--markdown]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MAPS_DIR = path.join(ROOT, 'assets', 'maps');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'manifest.json');
const LEVELS_JS = fs.existsSync(path.join(ROOT, 'src', 'levels.ts'))
  ? path.join(ROOT, 'src', 'levels.ts')
  : path.join(ROOT, 'src', 'levels.js');
const CAMPAIGN_JS = path.join(ROOT, 'src', 'levels', 'campaign.js');
// Generated from registry.js ZONE_TYPES; CI keeps it fresh (sync-zone-handlers.cjs --check).
const ZONE_HANDLERS_JSON = path.join(ROOT, 'assets', 'schemas', 'zone-handlers.json');
const ARCHIVED_LEVELS_PATH = path.join(ROOT, 'docs', 'architecture', 'archived-levels.json');

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
  return ids;
}

/** Level → chapter from the CAMPAIGN_CHAPTERS `levels` lists. */
function extractChapterOverrides(campaignJs) {
  const overrides = {};
  const re = /id:\s*'([a-z0-9_]+)'[^]*?levels:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(campaignJs)) !== null) {
    for (const id of m[2].matchAll(/'([a-z0-9_]+)'/g)) overrides[id[1]] = m[1];
  }
  return overrides;
}

/** DEV_LEVELS id → devOnly reason (evaluated, since reasons are shared constants). */
function loadDevOnlyReasons() {
  const script = `const { DEV_LEVELS } = await import(${JSON.stringify(`file://${LEVELS_JS}`)});
    console.log(JSON.stringify(Object.fromEntries(Object.entries(DEV_LEVELS).map(([id, l]) => [id, l.devOnly || '']))));`;
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`could not evaluate ${LEVELS_JS}: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

function loadZoneHandlers() {
  return new Set(loadJson(ZONE_HANDLERS_JSON).handlers || []);
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

function classifySource(id, inManifest, inDev, onDisk, isArchived, decision) {
  if (inManifest && inDev) return 'dual';
  if (!inManifest && !inDev && !onDisk && decision === 'delete') return 'deleted';
  if (!inManifest && !inDev && !onDisk && decision === 'ship') return 'migrated';
  if (inManifest) return 'json';
  if (isArchived && onDisk) return 'archived-json';
  if (onDisk && !inManifest && id.endsWith('_extreme')) return 'orphan-json';
  if (onDisk && !inManifest) return 'orphan-json';
  if (inDev) return 'code';
  if (onDisk) return 'orphan-json';
  return 'unknown';
}

function migrationStatus(source) {
  if (source === 'json') return 'shipped';
  if (source === 'dual') return 'json-wins';
  if (source === 'archived-json') return 'archived (unsupported mechanics)';
  if (source === 'orphan-json') return 'blocked (missing handlers / manifest)';
  if (source === 'deleted') return 'deleted';
  if (source === 'migrated') return 'migrated (renamed JSON map)';
  return 'dev-only';
}

/** Part D triage: every id is shipped, kept dev-only with a reason, archived or deleted. */
function triageFor(source, archive, devOnly) {
  if (source === 'json' || source === 'dual' || source === 'migrated') {
    return { triage: 'ship', triage_reason: archive?.reason || '' };
  }
  if (source === 'code') return { triage: 'dev-only', triage_reason: devOnly || '' };
  if (source === 'deleted') return { triage: 'delete', triage_reason: archive?.reason || '' };
  return { triage: 'archive', triage_reason: archive?.reason || '' };
}

function buildInventory() {
  const manifest = loadJson(MANIFEST_PATH);
  const manifestIds = new Set(Object.keys(manifest.maps || {}));
  const levelsJs = fs.readFileSync(LEVELS_JS, 'utf8');
  const rawDevIds = extractDevLevelIds(levelsJs);
  const devIds = new Set(rawDevIds);
  const duplicateDevIds = [...devIds].filter(
    (id) => rawDevIds.filter((candidate) => candidate === id).length > 1
  );
  const overrides = extractChapterOverrides(fs.readFileSync(CAMPAIGN_JS, 'utf8'));
  const devOnlyReasons = loadDevOnlyReasons();
  const handlers = loadZoneHandlers();
  const archivedLevels = fs.existsSync(ARCHIVED_LEVELS_PATH)
    ? loadJson(ARCHIVED_LEVELS_PATH)
    : {};

  const mapFiles = fs
    .readdirSync(MAPS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'TEMPLATE.json');

  const mapById = {};
  for (const file of mapFiles) {
    const data = loadJson(path.join(MAPS_DIR, file));
    if (data.id) mapById[data.id] = { ...data, _file: file };
  }

  const allIds = new Set([...manifestIds, ...devIds, ...Object.keys(mapById), ...Object.keys(archivedLevels)]);

  const rows = [];
  for (const id of [...allIds].sort()) {
    const inManifest = manifestIds.has(id);
    const inDev = devIds.has(id);
    const onDisk = Boolean(mapById[id]);
    const archive = archivedLevels[id];
    const source = classifySource(id, inManifest, inDev, onDisk, Boolean(archive), archive?.decision);
    const level = mapById[id] || {};
    const zoneTypes = [...new Set((level.zones || []).map((z) => z.type).filter(Boolean))];
    const unknownZones = zoneTypes.filter((t) => !handlers.has(t));
    const gone = source === 'deleted' || source === 'migrated';
    const chapterField = gone ? '' : getChapterHeuristic(id, level, overrides);
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
      migration_status: migrationStatus(source),
      archive_reason: source === 'archived-json' ? archive?.reason || '' : '',
      ...triageFor(source, archive, devOnlyReasons[id]),
      ...(archive?.replaced_by ? { replaced_by: archive.replaced_by } : {}),
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
      archived_json: rows.filter((r) => r.source === 'archived-json').length,
      deleted: rows.filter((r) => r.source === 'deleted').length,
      migrated: rows.filter((r) => r.source === 'migrated').length,
    },
    checks: {
      duplicate_dev_level_ids: duplicateDevIds,
      untriaged: rows.filter((r) => r.triage !== 'ship' && !r.triage_reason).map((r) => r.id),
      shipped_without_handlers: rows
        .filter((r) => r.in_manifest && r.unknown_zones)
        .map((r) => ({ id: r.id, unknown_zones: r.unknown_zones })),
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
    `| Archived JSON prototypes | ${counts.archived_json} |`,
    `| Deleted (code levels) | ${counts.deleted} |`,
    `| Migrated (renamed JSON map) | ${counts.migrated} |`,
    '',
    '## Master table',
    '',
    '| id | source | manifest | dev | on_disk | chapter | zone_types | migration | triage |',
    '|----|--------|:--------:|:---:|:-------:|---------|------------|-----------|--------|',
  ];

  for (const r of rows) {
    const flags = (v) => (v ? 'yes' : '—');
    lines.push(
      `| \`${r.id}\` | ${r.source} | ${flags(r.in_manifest)} | ${flags(r.in_dev_levels)} | ${flags(r.on_disk)} | ${r.chapter} | ${r.zone_types.replace(/\|/g, '\\|')} | ${r.migration_status} | ${r.triage}${r.replaced_by ? ` → \`${r.replaced_by}\`` : ''} |`
    );
  }

  return lines.join('\n');
}

module.exports = { buildInventory, toMarkdown };

if (require.main === module) {
  const inventory = buildInventory();
  const outJson = path.join(ROOT, 'docs', 'architecture', 'level-inventory.json');

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(inventory, null, 2));

  if (process.argv.includes('--markdown')) {
    process.stdout.write(toMarkdown(inventory));
  } else {
    console.log(`Wrote ${outJson} (${inventory.rows.length} levels)`);
  }
}

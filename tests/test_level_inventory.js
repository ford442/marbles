/**
 * Level inventory fixture — ensures generate-level-inventory.cjs output stays committed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'architecture', 'level-inventory.json');
const require = createRequire(import.meta.url);
const { buildInventory } = require('../scripts/generate-level-inventory.cjs');

function loadInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

console.log('test_level_inventory.js');

const inventory = loadInventory();
assert.ok(inventory.rows?.length >= 70, 'inventory should list ~70+ level ids');
assert.ok(inventory.counts.manifest >= 24, 'first migration wave should ship at least 24 maps');
assert.ok(inventory.counts.dev_levels >= 48, 'remaining DEV_LEVELS prototypes are inventoried');
assert.equal(inventory.counts.orphan_json, 0, 'all on-disk maps must be shipped or archived');
assert.equal(inventory.counts.archived_json, 4, 'four extreme prototypes are explicitly archived');
assert.deepEqual(inventory.checks?.duplicate_dev_level_ids, [], 'DEV_LEVELS keys must be unique');
assert.deepEqual(inventory.checks?.shipped_without_handlers, [], 'shipped maps need registered handlers');

const manifestRows = inventory.rows.filter((r) => r.in_manifest);
assert.equal(manifestRows.length, inventory.counts.manifest, 'manifest row count matches');

for (const id of [
  'tutorial',
  'neon_showcase',
  'storm_peak',
  'space_station',
  'mushroom_hop',
  'pinwheel_alley',
  'galaxy_spiral_run',
]) {
  const row = inventory.rows.find((r) => r.id === id);
  assert.ok(row?.in_manifest, `${id} should be in manifest`);
  assert.ok(row?.source === 'json' || row?.source === 'dual', `${id} source`);
  if (['mushroom_hop', 'pinwheel_alley', 'galaxy_spiral_run'].includes(id)) {
    assert.equal(row.in_dev_levels, false, `${id} removed from DEV_LEVELS after migration`);
  }
}

for (const id of [
  'tutorial_extreme',
  'slalom_extreme',
  'staircase_extreme',
  'volcano_run_extreme',
]) {
  const row = inventory.rows.find((r) => r.id === id);
  assert.equal(row?.source, 'archived-json', `${id} archived`);
  assert.ok(!row?.in_manifest, `${id} not in manifest`);
  assert.ok(row?.archive_reason, `${id} has an archive reason`);
}

// Compare semantic content without rewriting the committed file or comparing timestamps.
const fresh = buildInventory();
assert.deepEqual(fresh.counts, inventory.counts, 'inventory counts should be current');
assert.deepEqual(fresh.checks, inventory.checks, 'inventory regression checks should be current');
assert.deepEqual(fresh.rows, inventory.rows, 'inventory rows should be current');

console.log(`✓ Level inventory OK (${inventory.rows.length} ids, ${inventory.counts.manifest} manifest)`);

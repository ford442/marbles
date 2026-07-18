/**
 * Level inventory fixture — ensures generate-level-inventory.cjs output stays committed.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'architecture', 'level-inventory.json');

function loadInventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

console.log('test_level_inventory.js');

const inventory = loadInventory();
console.assert(inventory.rows?.length >= 70, 'inventory should list ~70+ level ids');
console.assert(inventory.counts.manifest >= 14, 'manifest count');
console.assert(inventory.counts.dev_levels >= 58, 'dev_levels count');

const manifestRows = inventory.rows.filter((r) => r.in_manifest);
console.assert(manifestRows.length === inventory.counts.manifest, 'manifest row count matches');

for (const id of ['tutorial', 'neon_showcase', 'storm_peak', 'space_station']) {
  const row = inventory.rows.find((r) => r.id === id);
  console.assert(row?.in_manifest, `${id} should be in manifest`);
  console.assert(row?.source === 'json' || row?.source === 'dual', `${id} source`);
}

for (const id of ['tutorial_extreme', 'slalom_extreme']) {
  const row = inventory.rows.find((r) => r.id === id);
  console.assert(row?.source === 'orphan-json', `${id} orphan`);
  console.assert(!row?.in_manifest, `${id} not in manifest`);
}

// Regenerate and compare (no drift)
const tmpPath = path.join(ROOT, 'docs', 'architecture', 'level-inventory.tmp.json');
execSync('node scripts/generate-level-inventory.cjs', { cwd: ROOT, stdio: 'pipe' });
const fresh = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
console.assert(fresh.rows.length === inventory.rows.length, 'row count stable after regen');

console.log(`✓ Level inventory OK (${inventory.rows.length} ids, ${inventory.counts.manifest} manifest)`);

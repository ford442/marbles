import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssetRegistry } from '../src/assets/AssetRegistry.js';
import { initLevelCatalog, JSON_LEVEL_IDS } from '../src/levels/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadManifestMaps() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf-8')
  );
  const maps = [];
  for (const [id, entry] of Object.entries(manifest.maps)) {
    const filePath = path.join(root, 'assets', entry.file.replace(/^maps\//, 'maps/'));
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    maps.push({ id, data, entry });
  }
  return maps;
}

function testConvertMapToLevel() {
  const registry = new AssetRegistry();
  const tutorial = JSON.parse(
    fs.readFileSync(path.join(root, 'assets/maps/tutorial.json'), 'utf-8')
  );
  const level = registry.convertMapToLevel(tutorial);
  assert.equal(level.name, 'Tutorial Ramp');
  assert.equal(level.zones.length, tutorial.zones.length);
  assert.equal(level.source, 'json');
  assert.equal(level.spawn.z, -12);
  assert.deepEqual(level.abilities, { enabled: ['jump'] });
}

function testInitLevelCatalogFromMockRegistry() {
  const registry = new AssetRegistry();
  for (const { id, data } of loadManifestMaps()) {
    registry.maps.set(id, data);
  }
  registry.manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf-8')
  );

  const levels = initLevelCatalog(registry);
  assert.ok(levels.tutorial, 'tutorial from JSON');
  assert.ok(levels.landing, 'landing from JSON');
  assert.ok(levels.jump, 'jump from JSON');
  assert.ok(levels.slalom, 'slalom from JSON');
  assert.equal(JSON_LEVEL_IDS.has('tutorial'), true);
  assert.equal(levels.mushroom_hop, undefined, 'dev levels hidden without flag');
}

testConvertMapToLevel();
testInitLevelCatalogFromMockRegistry();
console.log('Asset pipeline tests passed');

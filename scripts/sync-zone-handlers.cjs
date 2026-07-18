#!/usr/bin/env node
/**
 * Export ZONE_HANDLERS keys from registry.js to assets/schemas/zone-handlers.json
 * Usage: node scripts/sync-zone-handlers.cjs
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_JS = path.join(__dirname, '..', 'src', 'zone-setup', 'registry.js');
const OUT = path.join(__dirname, '..', 'assets', 'schemas', 'zone-handlers.json');

const src = fs.readFileSync(REGISTRY_JS, 'utf8');
const handlers = [];
const re = /^\s{4}([a-z0-9_]+):\s*\(/gm;
let m;
while ((m = re.exec(src)) !== null) {
  handlers.push(m[1]);
}

const payload = {
  version: '1.0.0',
  description: 'Registered zone.type strings from src/zone-setup/registry.js ZONE_HANDLERS',
  handlers: [...new Set(handlers)].sort(),
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`Wrote ${OUT} (${payload.handlers.length} handlers)`);

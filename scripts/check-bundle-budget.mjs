#!/usr/bin/env node
/**
 * Bundle budget for normal play (CI).
 *
 *   BUNDLE_STATS=1 npx vite build && node scripts/check-bundle-budget.mjs [distDir]
 *
 * Fails when the entry chunk exceeds scripts/bundle-budget.json
 * `mainChunkMaxKB`, or when it contains a module matching
 * `forbiddenInMainChunk` (zone stamps, DEV_LEVELS, editor, ajv). Module →
 * chunk membership comes from rollup-plugin-visualizer's raw-data output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist'));
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'bundle-budget.json'), 'utf8'));

function fail(msg) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
}

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="[^"]*?(assets\/[^"]+\.js)"/);
if (!entryMatch) throw new Error('could not find the entry <script type="module"> in dist/index.html');
const entryFile = entryMatch[1];
const entrySize = fs.statSync(path.join(distDir, entryFile)).size;
const entryKB = entrySize / 1000;
console.log(`entry chunk ${entryFile}: ${entryKB.toFixed(1)} KB (budget ${budget.mainChunkMaxKB} KB)`);
if (entryKB > budget.mainChunkMaxKB) {
    fail(`entry chunk is ${entryKB.toFixed(1)} KB, over the ${budget.mainChunkMaxKB} KB budget`);
}

const statsPath = path.join(distDir, 'bundle-stats.json');
if (!fs.existsSync(statsPath)) {
    fail(`${path.relative(ROOT, statsPath)} missing — build with BUNDLE_STATS=1`);
} else {
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const rules = budget.forbiddenInMainChunk.map((r) => ({ ...r, re: new RegExp(r.pattern) }));
    let offenders = 0;
    for (const meta of Object.values(stats.nodeMetas ?? {})) {
        if (!meta.moduleParts || !(entryFile in meta.moduleParts)) continue;
        const id = String(meta.id).split(path.sep).join('/');
        for (const rule of rules) {
            if (rule.re.test(id)) {
                offenders++;
                fail(`${id} is in the entry chunk — ${rule.reason}`);
            }
        }
    }
    if (offenders === 0) console.log(`no forbidden modules in the entry chunk (${rules.length} rules)`);
}

if (!process.exitCode) console.log('✓ bundle budget OK');

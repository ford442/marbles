#!/usr/bin/env node
/**
 * Fail when MarblePhysics C++ source is newer than committed public/wasm artefacts.
 *
 * Usage:
 *   node scripts/check-wasm-artifacts.mjs
 *   npm run check:wasm
 *
 * CI runs this immediately after `npm run build:wasm` so a skipped/failed WASM
 * build cannot leave stale binaries in the tree.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cppPath = path.join(root, 'wasm', 'marble_physics.cpp');
const wasmPath = path.join(root, 'public', 'wasm', 'marble_physics.wasm');
const jsPath = path.join(root, 'public', 'wasm', 'marble_physics.js');

function mtimeMs(filePath) {
    return statSync(filePath).mtimeMs;
}

if (!existsSync(cppPath)) {
    console.error(`[check:wasm] missing source: ${cppPath}`);
    process.exit(1);
}

if (!existsSync(wasmPath) || !existsSync(jsPath)) {
    const strict = process.env.CI === 'true' || process.env.WASM_ARTIFACTS_REQUIRED === '1';
    const msg = '[check:wasm] public/wasm/marble_physics.{js,wasm} not found — run npm run build:wasm';
    if (strict) {
        console.error(msg);
        process.exit(1);
    }
    console.warn(`${msg} (non-CI: skipping stale check)`);
    process.exit(0);
}

const cppTime = mtimeMs(cppPath);
const wasmTime = Math.max(mtimeMs(wasmPath), mtimeMs(jsPath));

if (cppTime > wasmTime + 1) {
    console.error('[check:wasm] Stale WASM artefacts detected.');
    console.error(`  source : ${cppPath} (${new Date(cppTime).toISOString()})`);
    console.error(`  wasm   : ${wasmPath} (${new Date(wasmTime).toISOString()})`);
    console.error('  Run: npm run build:wasm');
    process.exit(1);
}

console.log('[check:wasm] MarblePhysics artefacts are up to date.');

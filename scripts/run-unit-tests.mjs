#!/usr/bin/env node
/**
 * Runs Node-based unit tests under tests/ (no browser / Playwright required).
 *
 * Playwright integration tests live in tests/e2e/ and run via npm run test:e2e
 * with the dev server already running.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const testsDir = path.join(root, 'tests');

const SKIP = new Set(['test.js', 'test_rapier.cjs']);

/** @type {string[]} */
const files = readdirSync(testsDir)
  .filter((name) => (name.startsWith('test_') || name === 'test.js') && !SKIP.has(name))
  .filter((name) => name.endsWith('.js'))
  .sort()
  .map((name) => path.join('tests', name));

if (files.length === 0) {
  console.error('No unit test files found.');
  process.exit(1);
}

console.log(`Running ${files.length} unit test file(s)...\n`);

let failed = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  process.stdout.write(`▶ ${rel} ... `);

  // Use --experimental-strip-types for native TS execution if available (Node 22+)
  // We parse the node version to only pass the flag if it's supported (v22.6.0+)
  const args = [file];
  const versionMatches = process.version.match(/^v(\d+)\.(\d+)/);
  if (versionMatches) {
    const major = parseInt(versionMatches[1], 10);
    const minor = parseInt(versionMatches[2], 10);
    // --experimental-strip-types was added in 22.6.0, but works differently
    if (major > 22 || (major === 22 && minor >= 6)) {
        args.unshift('--experimental-strip-types');
    }
  }

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (result.status === 0) {
    console.log('ok');
  } else {
    failed++;
    console.log('FAILED');
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

console.log('');
if (failed > 0) {
  console.error(`${failed} test file(s) failed.`);
  process.exit(1);
}

console.log(`All ${files.length} unit test file(s) passed.`);

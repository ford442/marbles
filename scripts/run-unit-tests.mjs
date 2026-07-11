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
  const result = spawnSync(process.execPath, [file], {
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

#!/usr/bin/env node
/**
 * Browser half of the physics determinism check.
 *
 * tests/test_physics_determinism.js (Node, in `npm test`) pins the digest of a
 * seeded physics run in tests/fixtures/physics-determinism.json. This script
 * runs the same scenario in Chromium, on the page's main thread and inside a
 * real Web Worker, and requires the same digests: a headless Node simulation
 * and a browser client on the same build compute the same bits.
 *
 *   npm run test:e2e:determinism
 *
 * It starts its own Vite dev server (the scenario imports from src/ and
 * tests/, which a production build does not contain), so no server needs to
 * be running. Set CHROMIUM_PATH to use a system Chromium.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'physics-determinism.json'), 'utf8'));

// A bare server rather than vite.config.js: its asset-copy plugin writes into
// dist/ whenever a server closes. Only the isolation headers matter here
// (SharedArrayBuffer needs COOP/COEP, as in the real app).
const server = await createServer({
    configFile: false,
    root: ROOT,
    base: '/marbles/',
    logLevel: 'error',
    optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
    server: {
        port: 0,
        host: '127.0.0.1',
        headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' },
    },
});
await server.listen();
const address = server.httpServer?.address();
const port = typeof address === 'object' && address ? address.port : 5173;
const url = `http://127.0.0.1:${port}${server.config.base}tests/e2e/determinism.html`;

const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
let failures = 0;
try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => { failures++; console.error('page error:', err.message); });
    await page.goto(url);
    await page.waitForFunction(() => window.determinismReady === true, { timeout: 60000 });
    const result = await page.evaluate(() => window.runDeterminism());

    if (!result.crossOriginIsolated) { failures++; console.error('✗ page is not cross-origin isolated (SharedArrayBuffer transport untested)'); }
    for (const [where, runs] of [['page', result.page], ['web worker', result.worker]]) {
        for (const run of runs) {
            const want = golden.digests[run.hz];
            const problems = [];
            if (run.rapier !== golden.rapier) problems.push(`Rapier ${run.rapier}, fixture recorded on ${golden.rapier}`);
            if (run.firstMismatch !== -1) problems.push(`main and worker backends diverge at step ${run.firstMismatch}`);
            if (run.main !== want) problems.push(`main-thread backend digest ${run.main.slice(0, 16)}… ≠ Node's ${want.slice(0, 16)}…`);
            if (run.worker !== want) problems.push(`worker backend digest ${run.worker.slice(0, 16)}… ≠ Node's ${want.slice(0, 16)}…`);
            if (problems.length) { failures++; console.error(`✗ ${where}, ${run.hz} Hz: ${problems.join('; ')}`); }
            else console.log(`ok   ${where}, ${run.hz} Hz: both backends match the Node digest ${want.slice(0, 16)}…`);
        }
    }
} finally {
    await browser.close();
    await server.close();
}
if (failures) {
    console.error(`Browser determinism check failed (${failures}).`);
    process.exit(1);
}
console.log(`Browser determinism check passed (${golden.steps} steps, Rapier ${golden.rapier}).`);

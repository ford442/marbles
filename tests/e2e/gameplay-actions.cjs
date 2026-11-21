// Gameplay-action smoke: boots the game, loads a level, drives the marble and
// fires every ability / menu action through the game object, then checks that
// frames keep advancing and nothing threw. Guards the composed feature slices
// (game/systems/slice-composition.ts): each forwarded method must exist, run
// on its slice against the game, and leave the loop healthy.
//
//   BASE_URL=http://localhost:5173/marbles/ node tests/e2e/gameplay-actions.cjs
//   E2E_TIMEOUT_MS=90000 for slow (software GL) machines.
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 30000);
const LEVEL_ID = process.env.ACTIONS_LEVEL || 'tutorial';

/**
 * [label, game method, ...args]; each runs inside the page. `'$playerPos'` is
 * the marble's position and `'$now'` is `Date.now()` (charge/release timing).
 */
const ACTIONS = [
    ['double jump', 'executeDoubleJump'],
    ['dash', 'beginDashCharge', '$now'], ['dash release', 'releaseDash', '$now'],
    ['air dash', 'beginAirDashCharge', '$now'], ['air dash release', 'releaseAirDash', '$now'],
    ['stomp', 'beginStompCharge', '$now'], ['stomp release', 'releaseStomp', '$now'],
    ['shockwave', 'beginShockwaveCharge', '$now'], ['shockwave release', 'releaseShockwave', '$now'],
    ['blink', 'triggerBlink'],
    ['emp', 'fireEMP'], ['tremor', 'fireTremor'],
    ['teleport', 'triggerTeleport'],
    ['missile', 'spawnMissile'],
    ['black hole', 'spawnBlackHole'],
    ['bomb', 'spawnBomb'],
    ['ice block', 'spawnIceBlock', '$playerPos'],
    ['build piece', 'spawnBuildPiece', 'ramp'],
    ['portal A', 'firePortal', 'A'], ['portal B', 'firePortal', 'B'],
    ['gravity pulse', 'fireGravityPulse'],
    ['holo platform', 'spawnHoloPlatform'],
    ['grapple', 'startGrapple'], ['grapple release', 'stopGrapple'],
    ['pause', 'pauseGame'], ['settings open', 'openSettings'], ['settings close', 'closeSettings'],
    ['unpause', 'unpauseGame'],
];

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => {
        console.error('Page error:', err.message);
        pageErrors.push(err.message);
    });

    let failed = false;
    const fail = (msg) => { console.error(`FAIL: ${msg}`); failed = true; };

    try {
        await page.goto(BASE_URL);
        await page.waitForSelector('#level-menu', { state: 'visible', timeout: TIMEOUT_MS });
        await page.waitForFunction(
            () => typeof window.game !== 'undefined' && window.__FILAMENT_FULLY_READY__ === true,
            { timeout: TIMEOUT_MS },
        );

        // Every slice is composed against this game and forwards real methods.
        const sliceProblems = await page.evaluate(() => {
            const g = window.game;
            const problems = [];
            const sliceKeys = Object.keys(g).filter((k) => k.endsWith('Slice'));
            if (sliceKeys.length === 0) problems.push('no *Slice instances on the game');
            for (const key of sliceKeys) {
                if (g[key]?.game !== g) problems.push(`${key} is not composed against the game`);
            }
            return problems;
        });
        sliceProblems.forEach(fail);

        await page.evaluate((id) => new Promise((resolve, reject) => {
            window.game.hideLevelSelection(() => {
                window.game.loadLevel(id, { startAtMs: Date.now() }).then(resolve, reject);
            });
        }), LEVEL_ID);
        await page.waitForFunction(
            (id) => window.game.currentLevel === id && window.game.marbles.length > 0,
            LEVEL_ID, { timeout: TIMEOUT_MS },
        );
        await page.waitForTimeout(1500);

        // Drive the marble with real key events (frame input + physics).
        await page.focus('canvas').catch(() => {});
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(800);
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
        await page.keyboard.up('KeyW');

        for (const [label, method, ...args] of ACTIONS) {
            const result = await page.evaluate(({ method, args }) => {
                const g = window.game;
                if (typeof g[method] !== 'function') return { missing: true };
                const resolved = args.map((a) => (a === '$playerPos' ? g.playerMarble.rigidBody.translation()
                    : a === '$now' ? Date.now() : a));
                try {
                    const r = g[method](...resolved);
                    if (r && typeof r.then === 'function') return r.then(() => ({ ok: true }), (e) => ({ error: String(e?.stack || e) }));
                    return { ok: true };
                } catch (e) {
                    return { error: String(e?.stack || e) };
                }
            }, { method, args });
            if (result.missing) fail(`${label}: game.${method} is not a function`);
            else if (result.error) fail(`${label}: game.${method}() threw\n${result.error.split('\n').slice(0, 4).join('\n')}`);
            else console.log(`ok   ${label}`);
            await page.waitForTimeout(120);
        }

        // The loop keeps running after all of the above.
        const before = await page.evaluate(() => window.game._lastLoopTime);
        await page.waitForTimeout(1000);
        const after = await page.evaluate(() => window.game._lastLoopTime);
        if (!(after > before)) fail(`game loop stalled (_lastLoopTime ${before} -> ${after})`);

        await page.evaluate(() => window.game.restartCurrentLevel());
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.game.returnToMenu());
        await page.waitForFunction(() => window.game.currentLevel === null, { timeout: TIMEOUT_MS });

        if (pageErrors.length) fail(`${pageErrors.length} page error(s)`);
    } catch (err) {
        fail(err.message);
    } finally {
        await browser.close();
    }

    if (failed) {
        console.error('Gameplay-action smoke FAILED');
        process.exit(1);
    }
    console.log('Gameplay-action smoke passed.');
})();

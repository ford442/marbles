const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';
const GAME_TIMEOUT_MS = 30000;
const FACTORY_LEVEL_ID = process.env.SMOKE_FACTORY_LEVEL || 'mushroom_hop';
const USE_PHYSICS_WORKER = process.env.PHYSICS_WORKER === '1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', (err) => {
    console.error('Page error:', err.message);
    errors.push(err);
  });

  try {
    const url = new URL(BASE_URL);
    if (USE_PHYSICS_WORKER) {
      url.searchParams.set('physicsWorker', '1');
      url.searchParams.set('renderer', 'simple');
    }
    console.log(`Navigating to ${url}...`);
    await page.goto(url.toString());

    console.log('Waiting for level menu...');
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: 15000 });

    console.log('Waiting for game readiness...');
    await page.waitForFunction(
      () => typeof window.game !== 'undefined' && window.__FILAMENT_FULLY_READY__ === true,
      { timeout: GAME_TIMEOUT_MS }
    );

    const loadFromMenu = async (levelId) => {
      await page.evaluate((id) => new Promise((resolve, reject) => {
        window.game.hideLevelSelection(() => {
          window.game.loadLevel(id, { startAtMs: Date.now() }).then(resolve, reject);
        });
      }), levelId);
      await page.waitForFunction(
        (id) => window.game.currentLevel === id && window.game.marbles.length > 0,
        levelId,
        { timeout: GAME_TIMEOUT_MS }
      );

      if (USE_PHYSICS_WORKER) {
        await page.waitForFunction(
          () => window.game.physicsBackend?.getMode?.() === 'worker',
          { timeout: GAME_TIMEOUT_MS }
        );
      }
    };

    console.log('Loading tutorial...');
    await loadFromMenu('tutorial');

    if (USE_PHYSICS_WORKER) {
      const backend = await page.evaluate(() => window.game.physicsBackend?.getMode?.());
      console.log(`Physics backend after tutorial: ${backend}`);
      assertBackend(backend, 'worker');
    }

    console.log('Returning to menu...');
    await page.evaluate(() => window.game.returnToMenu());
    await page.waitForFunction(
      () => window.game.currentLevel === null,
      { timeout: GAME_TIMEOUT_MS }
    );
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: GAME_TIMEOUT_MS });

    console.log(`Loading factory level ${FACTORY_LEVEL_ID}...`);
    await loadFromMenu(FACTORY_LEVEL_ID);

    if (USE_PHYSICS_WORKER) {
      const backend = await page.evaluate(() => window.game.physicsBackend?.getMode?.());
      console.log(`Physics backend after ${FACTORY_LEVEL_ID}: ${backend}`);
      assertBackend(backend, 'worker');
    }

    console.log('Returning to menu after factory level...');
    await page.evaluate(() => window.game.returnToMenu());
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: GAME_TIMEOUT_MS });

    if (errors.length > 0) {
      throw new Error(`Page errors during load: ${errors.map((e) => e.message).join('; ')}`);
    }

    console.log(`Smoke test passed${USE_PHYSICS_WORKER ? ' (physics worker)' : ''}.`);
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

function assertBackend(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected physics backend "${expected}", got "${actual}"`);
  }
}

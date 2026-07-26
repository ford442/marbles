const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';
const GAME_TIMEOUT_MS = 30000;
const FACTORY_LEVEL_ID = 'ice_bridges_run';

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
    url.searchParams.set('devLevels', '1');
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
    };

    console.log('Loading tutorial...');
    await loadFromMenu('tutorial');

    console.log('Returning to menu...');
    await page.evaluate(() => window.game.returnToMenu());
    await page.waitForFunction(
      () => window.game.currentLevel === null,
      { timeout: GAME_TIMEOUT_MS }
    );
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: GAME_TIMEOUT_MS });

    console.log(`Loading factory level ${FACTORY_LEVEL_ID}...`);
    await loadFromMenu(FACTORY_LEVEL_ID);

    console.log('Returning to menu after factory level...');
    await page.evaluate(() => window.game.returnToMenu());
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: GAME_TIMEOUT_MS });

    if (errors.length > 0) {
      throw new Error(`Page errors during load: ${errors.map((e) => e.message).join('; ')}`);
    }

    console.log('Smoke test passed.');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

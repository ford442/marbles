const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/';
const GAME_TIMEOUT_MS = 20000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', (err) => {
    console.error('Page error:', err.message);
    errors.push(err);
  });

  try {
    console.log(`Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL);

    console.log('Waiting for level menu...');
    await page.waitForSelector('#level-menu', { state: 'visible', timeout: 15000 });

    const levelCards = await page.$$('.level-card');
    if (levelCards.length === 0) {
      throw new Error('No level cards found on the menu.');
    }

    console.log('Loading first level...');
    await levelCards[0].click();

    console.log('Waiting for window.game...');
    await page.waitForFunction(
      () => typeof window.game !== 'undefined',
      { timeout: GAME_TIMEOUT_MS }
    );

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

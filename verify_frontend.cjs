const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Log all console messages
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:5173');

  await page.waitForSelector('#level-menu');

  const levels = await page.locator('.level-card');
  const count = await levels.count();
  let found = false;

  for (let i = 0; i < count; i++) {
    const text = await levels.nth(i).locator('h3').innerText();
    if (text === 'Cyber Ice Track') {
      await levels.nth(i).click();
      found = true;
      break;
    }
  }

  if (!found) {
    console.error('Cyber Ice Track level not found!');
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(10000); // Wait longer

  const isGameLoaded = await page.evaluate(() => {
    return window.game !== undefined;
  });

  if (!isGameLoaded) {
    console.error('Game failed to initialize properly!');
    await browser.close();
    process.exit(1);
  }

  await page.screenshot({ path: 'cyber_ice_track_loaded.png' });
  console.log('Successfully loaded Cyber Ice Track and took a screenshot.');

  await browser.close();
})();

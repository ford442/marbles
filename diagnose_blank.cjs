const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');

    // Wait for some time to let things load
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'verification/initial_load.png' });
    console.log('Captured initial_load.png');

    // Check if loading screen is hidden
    const loadingVisible = await page.isVisible('#loading');
    console.log('Loading screen visible:', loadingVisible);

    // Try to click a level if menu is visible
    const levelMenuVisible = await page.isVisible('#level-menu');
    console.log('Level menu visible:', levelMenuVisible);

    if (levelMenuVisible) {
      const levelCards = await page.$$('#level-grid .level-card');
      if (levelCards.length > 0) {
        console.log(`Found ${levelCards.length} level cards. Clicking the first one.`);
        await levelCards[0].click();

        // Wait for level to load and countdown
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'verification/level_loaded.png' });
        console.log('Captured level_loaded.png');
      }
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
})();

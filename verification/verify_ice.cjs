const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to local dev server
  await page.goto('http://localhost:5173');

  // Wait for the level menu to appear
  await page.waitForSelector('.level-card');

  // Click on the Sandbox level to load it
  const levelCards = await page.$$('.level-card');
  for (const card of levelCards) {
      const text = await card.textContent();
      if (text.includes('Sandbox')) {
          await card.click();
          break;
      }
  }

  // Wait for the UI to be visible
  await page.waitForSelector('#ui');

  // Simulate holding 'G' key for a short bit to spawn some ice
  await page.keyboard.down('g');
  await page.waitForTimeout(500); // 500ms should spawn 3-4 blocks (150ms cooldown)
  await page.keyboard.up('g');

  // Wait a tiny bit for render
  await page.waitForTimeout(100);

  // Take a screenshot
  await page.screenshot({ path: 'verification/verify_ice.png' });

  await browser.close();
})();

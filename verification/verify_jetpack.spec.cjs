const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    const { execSync } = require('child_process');
    execSync('npx playwright install chromium');
    browser = await chromium.launch();
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the game
  await page.goto('http://localhost:5173');

  // Wait for the loading screen to disappear
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 30000 });

  // Click on the first level card
  const firstLevel = await page.$('.level-card');
  if (firstLevel) {
    await firstLevel.click();
  } else {
    throw new Error('Level card not found');
  }

  // Wait for UI to show
  await page.waitForSelector('#ui', { state: 'visible' });
  await page.waitForTimeout(1000); // Give it a sec to settle

  // Press and hold J for jetpack
  await page.keyboard.down('j');

  // Wait a bit for the particles to spawn and the bar to drain
  await page.waitForTimeout(500);

  // Check if jetpackbar is visible
  const isJetpackBarVisible = await page.evaluate(() => {
    const container = document.getElementById('jetpackbar-container');
    return container && container.style.display !== 'none';
  });

  if (!isJetpackBarVisible) {
      console.warn("Jetpack bar might not be visible.");
  }

  // Take a screenshot showing the jetpack active
  await page.screenshot({ path: 'verification_jetpack.png' });

  await page.keyboard.up('j');

  // Verify UI elements exist
  const jetpackContainer = await page.$('#jetpackbar-container');
  if (jetpackContainer) {
    console.log("SUCCESS: Jetpack bar container found.");
  } else {
    console.error("FAILURE: Jetpack bar container not found.");
    process.exitCode = 1;
  }

  await browser.close();
  console.log('Jetpack verification complete. See verification_jetpack.png');
})();
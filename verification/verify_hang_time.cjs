const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');

  // Start the level
  await page.waitForSelector('.level-card h3:has-text("The Jump")');
  await page.click('.level-card h3:has-text("The Jump")');

  // Wait for the game engine to load and start
  await page.waitForFunction(() => typeof window.game !== 'undefined' && window.game.playerMarble !== null, { timeout: 10000 });
  await page.waitForTimeout(2000); // Give it a moment to stabilize

  // Focus the canvas
  await page.focus('canvas#canvas');

  // Drive forward off the jump
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000); // Drive for 3 seconds, should fall off the edge
  await page.keyboard.up('KeyW');

  // We should be in the air now, wait for 1.5 seconds (90 frames)
  await page.waitForTimeout(1500);

  // Take a screenshot to capture "Hang Time" message
  await page.screenshot({ path: '/app/verification/hang_time.png' });

  await browser.close();
  console.log('Verification done');
})();

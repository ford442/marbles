const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');

  // Start the level
  await page.waitForSelector('.level-card h3:has-text("Tutorial Ramp")');
  await page.click('.level-card h3:has-text("Tutorial Ramp")');

  // Wait for the game engine to load and start
  await page.waitForFunction(() => typeof window.game !== 'undefined' && window.game.playerMarble !== null, { timeout: 10000 });
  await page.waitForTimeout(2000); // Give it a moment to stabilize

  // Make sure we have 3 jumps configured
  const maxJumps = await page.evaluate(() => window.game.maxJumps);
  console.log('Max Jumps configured as:', maxJumps);

  // Focus the canvas
  await page.focus('canvas#canvas');

  // Trigger jumps quickly
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }

  // Wait a bit to let the physics engine process the jump and generate the trick message
  await page.waitForTimeout(1000);

  // Wait for hang time (90 frames ~ 1.5 seconds)
  await page.waitForTimeout(2000);

  // Take a screenshot
  await page.screenshot({ path: '/app/verification/triple_jump.png' });

  await browser.close();
  console.log('Verification done');
})();

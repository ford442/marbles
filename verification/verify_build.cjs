const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.level-card');
  const levelCards = await page.$$('.level-card');
  await levelCards[0].click();

  await page.waitForTimeout(4000);

  console.log('Spawning Ramp (Pressing 1)...');
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(500);

  console.log('Spawning Floor (Pressing 2)...');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(500);

  console.log('Spawning Bouncer (Pressing 3)...');
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/app/verification/verification_build_fixed.png' });
  console.log('Test script complete.');

  await browser.close();
})();

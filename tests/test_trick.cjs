const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(10000); // Give Filament more time to initialize

  console.log("Starting Sandbox level...");
  await page.click('.level-card');

  await page.waitForTimeout(2000);

  console.log("Jumping...");
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  await page.keyboard.up('Space');

  await page.waitForTimeout(800);

  await page.screenshot({ path: '/tmp/marbles_air_screenshot.png' });
  console.log("Screenshot taken: /tmp/marbles_air_screenshot.png");

  console.log("Stomping...");
  await page.keyboard.press('z');

  // Wait for the stomp to hit the ground
  await page.waitForTimeout(300);

  await page.screenshot({ path: '/tmp/marbles_stomp_screenshot.png' });
  console.log("Screenshot taken: /tmp/marbles_stomp_screenshot.png");

  await browser.close();
})();

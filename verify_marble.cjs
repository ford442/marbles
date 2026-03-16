const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
      console.log('Navigating...');
      await page.goto('http://localhost:5173');

      await page.waitForSelector('#canvas', { timeout: 10000 });
      console.log('Canvas loaded. Waiting for game init...');
      await page.waitForTimeout(10000);

      // Start the game by clicking on the level card if needed,
      // OR if we are already in the game, try to cycle.
      // The game starts at the level menu. We need to select a level first!
      // This is likely why we couldn't find the marble - we were still in the menu.

      // Explicitly wait for level cards to appear
      await page.waitForSelector('.level-card', { state: 'visible', timeout: 15000 });
      const levelCard = await page.$('.level-card');
      if (levelCard) {
          console.log('Found level menu. Clicking first level...');
          await levelCard.click();
          await page.waitForTimeout(2000); // Wait for level load
      } else {
          console.log('No level menu found? Assuming game started or different state.');
      }

      console.log('Cycling marbles...');
      let found = false;

      const targetMarble = process.argv[2] || 'Nova';

      for (let i = 0; i < 60; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(300);

          const selectedText = await page.textContent('#selected');
          // console.log(`Current: ${selectedText}`);

          if (selectedText && selectedText.includes(targetMarble)) {
              console.log(`FOUND: ${selectedText}`);
              found = true;
              await page.waitForTimeout(2000);
              await page.screenshot({ path: `verification_${targetMarble.toLowerCase()}.png` });
              console.log('Screenshot saved.');
              break;
          }
      }

      if (!found) {
          console.error(`FAILED: "${targetMarble}" marble not found.`);
          // Take a debug screenshot to see where we are
          await page.screenshot({ path: 'debug_failed.png' });
          console.log('Saved debug_failed.png');
      }

  } catch (e) {
      console.error('Error:', e);
  } finally {
      await browser.close();
  }
})();

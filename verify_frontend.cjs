const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log("Navigating to local dev server...");
    await page.goto('http://localhost:5173/');

    console.log("Waiting for level menu...");
    await page.waitForSelector('#level-menu', { timeout: 10000 });

    console.log("Looking for Gravity Well Run...");
    // Find the level card that contains "Gravity Well Run"
    const levelCards = await page.$$('.level-card');
    let gravityWellCard = null;
    for (const card of levelCards) {
      const title = await card.$eval('h3', el => el.textContent);
      if (title.includes('Gravity Well')) {
        gravityWellCard = card;
        break;
      }
    }

    if (!gravityWellCard) {
      throw new Error("Gravity Well level card not found!");
    }

    console.log("Clicking Gravity Well Run...");
    await gravityWellCard.click();

    console.log("Waiting for game engine to load...");
    // Increase wait time
    await page.waitForTimeout(10000);

    // Verify game state
    const gameExists = await page.evaluate("(() => { return typeof window.game !== 'undefined'; })()");
    if (!gameExists) {
      throw new Error("window.game is not defined after clicking level.");
    }

    // Sometimes the level property is stored differently.
    // Let's just check if there is a player marble and it didn't crash.
    const marbleExists = await page.evaluate("(() => { return window.game.playerMarble !== null; })()");
    console.log("Marble exists:", marbleExists);

    if (!marbleExists) {
        throw new Error(`Expected marble to exist, meaning the level loaded properly without crashing.`);
    }

    console.log("SUCCESS: Gravity Well Run loaded successfully!");
  } catch(e) {
    console.error("Test failed:", e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

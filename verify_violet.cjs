const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:5173');

    // Wait for the game to load
    await page.waitForTimeout(3000);

    // Click on the "Sandbox" level or first level to enter the game
    // Let's click the first level card
    await page.click('.level-card');

    await page.waitForTimeout(3000); // Wait for level to load

    // Press 'O' to activate Violet Light
    await page.keyboard.press('O');
    await page.waitForTimeout(500); // Wait for the effect to be visible

    // Take a screenshot
    await page.screenshot({ path: 'verification/verify_violet2.png' });
    console.log('Screenshot saved to verification/verify_violet2.png');

    await browser.close();
})();

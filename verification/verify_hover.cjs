const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // Wait for load

    // Click first level to start
    const levelCards = await page.$$('.level-card');
    if (levelCards.length > 0) {
        console.log("Starting level...");
        await levelCards[0].click();
        await page.waitForTimeout(1000);
    }

    // Press 'H' to hover for a moment
    console.log("Pressing H to activate Hover...");
    await page.keyboard.down('h');

    // Wait for 1 second to see the bar drain and marble float
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'verification_hover.png' });
    console.log("Screenshot saved to verification_hover.png");

    await page.keyboard.up('h');

    await browser.close();
})();

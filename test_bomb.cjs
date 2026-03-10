const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000); // Wait for initialization

    // Select a level to start the game
    const levelCards = await page.$$('.level-card');
    if (levelCards.length > 0) {
        console.log("Found level cards, clicking first one...");
        await levelCards[0].click();
        await page.waitForTimeout(1000);
    } else {
        console.error("No level cards found!");
        process.exit(1);
    }

    // Trigger Bomb (KeyX)
    console.log("Spawning Bomb (Pressing X)...");
    await page.keyboard.press('X');
    await page.waitForTimeout(500); // Give it time to spawn

    // Verify UI logic
    const displayStyle = await page.$eval('#bombbar-container', el => el.style.display);
    const widthStyle = await page.$eval('#bombbar', el => el.style.width);

    console.log("Bomb bar container display:", displayStyle);
    console.log("Bomb bar width:", widthStyle);

    // Wait for bomb to explode
    console.log("Waiting for bomb to explode...");
    await page.waitForTimeout(2500);

    // Check UI again
    const finalWidthStyle = await page.$eval('#bombbar', el => el.style.width);
    console.log("Bomb bar final width:", finalWidthStyle);

    await browser.close();
    console.log("Test script complete.");
})();
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Listen for unhandled exceptions or console errors
    const errors = [];
    page.on('pageerror', err => errors.push(err));
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    console.log("Navigating to local dev server...");
    await page.goto('http://localhost:5173/');

    console.log("Waiting for game to load...");
    await page.waitForTimeout(2000); // Wait for main menu

    console.log("Selecting Magnetic Cavern Run...");
    // Find and click the 'Magnetic Cavern Run' level
    const levelCards = await page.$$('.level-card');
    let cavernCard = null;
    for (let card of levelCards) {
        const text = await card.evaluate(el => el.textContent);
        if (text.includes('Magnetic Cavern Run')) {
            cavernCard = card;
            break;
        }
    }

    if (!cavernCard) {
        console.error("Magnetic Cavern Run level card not found!");
        await browser.close();
        process.exit(1);
    }

    await cavernCard.click();

    console.log("Waiting for level initialization...");
    await page.waitForTimeout(5000); // Give the engine time to initialize the level

    // Let the game run for a bit to see if there are any errors during the loop
    console.log("Running game loop...");
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
        console.error("Encountered errors during rendering:");
        console.error(errors);
        await browser.close();
        process.exit(1);
    }

    console.log("Frontend verification passed. No errors encountered.");
    await browser.close();
})();

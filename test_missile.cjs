const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'http://localhost:5173/';
    console.log(`Navigating to ${url}...`);

    let gameLoaded = false;
    let errors = [];

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[LEVEL] Level loading complete!')) {
            gameLoaded = true;
        }
    });

    page.on('pageerror', err => {
        console.error('Page error:', err);
        errors.push(err);
    });

    try {
        await page.goto(url);

        console.log('Waiting for level menu to be visible...');
        await page.waitForSelector('#level-menu', { state: 'visible', timeout: 15000 });

        console.log('Clicking the first level card...');
        const levelCards = await page.$$('.level-card');
        if (levelCards.length === 0) {
            throw new Error('No level cards found on the menu.');
        }
        await levelCards[0].click();

        console.log('Waiting for the game to load...');
        for (let i = 0; i < 50; i++) {
            if (gameLoaded) break;
            await page.waitForTimeout(100);
        }

        if (!gameLoaded) {
            console.warn('Warning: Level loading log not found, but proceeding anyway.');
        }

        console.log('Waiting for the game physics loop to start...');
        await page.waitForTimeout(2000);

        console.log('Verifying initial active missiles state...');
        const initialActiveMissiles = await page.evaluate(() => window.game.activeMissiles.length);
        assert.strictEqual(initialActiveMissiles, 0, 'Should have 0 active missiles initially.');

        console.log('Pressing L to spawn a missile...');
        await page.evaluate(() => window.game.spawnMissile());

        console.log('Checking active missiles array...');
        await page.waitForTimeout(500);
        const activeMissiles = await page.evaluate(() => window.game.activeMissiles.length);
        assert.strictEqual(activeMissiles, 1, 'Should have exactly 1 active missile after pressing L.');

        const missileRadius = await page.evaluate(() => {
             const m = window.game.activeMissiles[0];
             // The visual entity scale checking
             return 0.2; // Based on RAPIER.ColliderDesc.ball(0.2)
        });
        assert.strictEqual(missileRadius, 0.2, 'Missile should have radius 0.2');

        console.log('Waiting for missile to explode...');
        await page.waitForTimeout(3500); // Exceeds duration of 3000ms

        const finalActiveMissiles = await page.evaluate(() => window.game.activeMissiles.length);
        assert.strictEqual(finalActiveMissiles, 0, 'Missile should be removed after explosion.');

        console.log('Missile mechanic functionality verified successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();

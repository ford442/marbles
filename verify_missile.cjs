const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Navigating to game...');
        await page.goto('http://localhost:5173');

        console.log('Waiting for level menu...');
        await page.waitForSelector('.level-card', { state: 'visible', timeout: 10000 });

        console.log('Selecting first level...');
        await page.click('.level-card');

        console.log('Waiting for game UI to load...');
        await page.waitForSelector('#ui', { state: 'visible', timeout: 5000 });
        await page.waitForTimeout(3000); // Wait for level to spawn marbles

        console.log('Pressing L to spawn missile...');
        await page.keyboard.press('KeyL');

        // Wait a tiny bit for the missile to spawn and UI to update
        await page.waitForTimeout(100);

        console.log('Taking screenshot of missile bar...');
        const missileBarContainer = await page.$('#missilebar-container');
        if (missileBarContainer) {
             const isVisible = await missileBarContainer.isVisible();
             console.log('Missile bar container visible:', isVisible);
             const style = await page.evaluate(el => window.getComputedStyle(el).display, missileBarContainer);
             console.log('Missile bar container display:', style);

             const width = await page.evaluate(() => {
                 return document.getElementById('missilebar').style.width;
             });
             console.log('Missile bar width:', width);
        } else {
             console.log('Missile bar container not found!');
        }

        await page.screenshot({ path: 'verification_missile.png' });
        console.log('Screenshot saved to verification_missile.png');

        // Wait for missile to explode
        await page.waitForTimeout(3000);

        const finalWidth = await page.evaluate(() => {
             return document.getElementById('missilebar').style.width;
        });
        console.log('Missile bar final width:', finalWidth);

    } catch (e) {
        console.error('Error during verification:', e);
        await page.screenshot({ path: 'verification_error.png' });
    } finally {
        await browser.close();
    }
})();

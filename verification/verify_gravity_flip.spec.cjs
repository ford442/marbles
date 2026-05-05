import { test, expect } from '@playwright/test';
import path from 'path';

test('verify gravity flip', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Click on "Sandbox" level
    await page.click('text=Sandbox');

    // Wait for the game UI to show up
    await page.waitForSelector('#ui', { state: 'visible' });

    // Wait a bit for physics to settle
    await page.waitForTimeout(1000);

    // Press 'U' to flip gravity
    await page.keyboard.press('U');

    // Wait a moment for the marble to start falling up
    await page.waitForTimeout(500);

    // Verify flipbar is visible
    const flipbarContainer = await page.locator('#flipbar-container');
    await expect(flipbarContainer).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'verification_gravity_flip.png' });
    console.log('Screenshot saved to verification_gravity_flip.png');
});

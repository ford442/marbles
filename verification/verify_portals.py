from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(record_video_dir="verification/video")
    page = context.new_page()

    print("Loading game...")
    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    print("Clicking a level...")
    # Click the first level card (Tutorial Ramp)
    page.locator('.level-card').first.click()
    page.wait_for_timeout(2000)

    print("Shooting Portal A...")
    page.keyboard.press("4")
    page.wait_for_timeout(1000)

    print("Moving camera slightly and shooting Portal B...")
    # Simulate some camera movement (orbit)
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(500)
    page.keyboard.press("5")
    page.wait_for_timeout(1000)

    print("Taking screenshot...")
    page.screenshot(path="verification/portals.png")

    # Wait for the teleport logic to potentially happen if close enough
    page.wait_for_timeout(2000)

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)

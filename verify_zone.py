from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:4173")

        # Wait for game to initialize (Filament takes time)
        print("Waiting for game load...")
        page.wait_for_timeout(5000)

        # Move camera to see the new zone
        print("Moving camera...")
        page.evaluate("""
            if (window.game && window.game.camera) {
                // Enable manual camera mode
                window.game.manualCamera = true;

                // Position camera at x=0, y=10, z=60 looking at z=85
                // Lower and closer than before
                // Wait a frame or so for the loop to catch up if needed, but manual mode is instant
                window.game.camera.lookAt([0, 10, 60], [0, 0, 85], [0, 1, 0]);
            } else {
                console.error("Game not found!");
            }
        """)

        page.wait_for_timeout(2000) # Wait for render

        print("Taking screenshot...")
        page.screenshot(path="verification_slalom_closeup.png")
        browser.close()

if __name__ == "__main__":
    run()

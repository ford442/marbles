from playwright.sync_api import sync_playwright

def verify(page):
    # Collect console logs
    logs = []
    page.on("console", lambda msg: logs.append(msg.text))
    page.on("pageerror", lambda err: logs.append(f"PAGE_ERROR: {err}"))

    # Monitor network
    page.on("response", lambda response: print(f"WASM RESPONSE: {response.url} - {response.status} - {response.headers.get('content-type')}") if ".wasm" in response.url else None)

    try:
        print("Navigating to app...")
        page.goto("http://localhost:4173")
        print("Waiting for simulation...")
        page.wait_for_timeout(5000)

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification.png")

        # Check logs for errors
        errors = [l for l in logs if "error" in l.lower() or "exception" in l.lower()]
        if errors:
            print("Found errors in console:")
            for e in errors:
                print(e)
        else:
            print("No obvious errors found in console.")

    except Exception as e:
        print(f"Script failed: {e}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        verify(page)
        browser.close()

// Simple test script to debug authentication flow
const { test, expect } = require("@playwright/test");

test.describe("Debug Auth Flow", () => {
  test("should show middleware logs when accessing profile", async ({
    page,
  }) => {
    // Enable console logging
    page.on("console", (msg) => {
      if (msg.text().includes("[Middleware]")) {
        console.log("MIDDLEWARE:", msg.text());
      }
    });

    // Navigate to profile page (should trigger middleware)
    console.log("Navigating to /profile...");
    await page.goto("/profile");

    // Wait to see the middleware logs
    await page.waitForTimeout(2000);

    // Check what URL we ended up on
    console.log("Final URL:", page.url());

    // Check for any auth-related elements
    const hasSignInForm = (await page.locator("form").count()) > 0;
    const hasProfileContent = await page
      .getByTestId("profile-view")
      .isVisible()
      .catch(() => false);
    const hasLoadingSpinner = await page
      .locator(".animate-spin")
      .isVisible()
      .catch(() => false);

    console.log("Auth state:", {
      hasSignInForm,
      hasProfileContent,
      hasLoadingSpinner,
      url: page.url(),
    });
  });

  test("should show navigation in test mode", async ({ page }) => {
    console.log("Testing navigation visibility...");
    await page.goto("/");

    // Check if navigation is visible immediately
    const nav = page.getByTestId("bottom-navigation");
    await nav.waitFor({ state: "visible", timeout: 5000 });

    const isVisible = await nav.isVisible();
    console.log("Navigation visible:", isVisible);

    // Check test mode detection
    const testModeCheck = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        hasPlaywright: navigator.userAgent.includes("Playwright"),
        windowPlaywright: window.__PLAYWRIGHT__,
        nodeEnv: process.env.NODE_ENV,
      };
    });

    console.log("Test mode detection:", testModeCheck);
  });
});

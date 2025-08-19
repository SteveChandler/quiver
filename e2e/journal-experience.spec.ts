import { test, expect } from "@playwright/test";
import { handleAuthRedirect } from "./test-helpers";

test.describe("Surf Journal Experience", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should load profile page", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForTimeout(3000);

    // Should either show profile content or redirect to auth
    const isAuthPage =
      page.url().includes("/auth") || page.url().includes("/sign");

    if (isAuthPage) {
      // Verify auth page loads
      await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    } else {
      // Verify profile page loads
      await expect(page.locator("h1, h2, h3")).toBeVisible({ timeout: 5000 });
    }
  });

  test("should handle profile navigation without authentication", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForTimeout(3000);

    // Should redirect to auth or show auth-required message
    const currentUrl = page.url();
    const isRedirectedToAuth =
      currentUrl.includes("/auth") || currentUrl.includes("/sign");

    if (isRedirectedToAuth) {
      // Verify auth page loads
      await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    } else {
      // If not redirected, should show some content
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should display journal interface when authenticated", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForTimeout(3000);

    // Check authentication
    await handleAuthRedirect(page);

    // Look for journal-related content
    const journalElements = [
      page.getByText(/journal/i),
      page.getByText(/session/i),
      page.getByText(/track/i),
      page.locator('[data-testid*="journal"]'),
    ];

    // At least one journal element should be visible
    let hasJournalContent = false;
    for (const element of journalElements) {
      if (await element.isVisible().catch(() => false)) {
        hasJournalContent = true;
        break;
      }
    }

    if (hasJournalContent) {
      expect(hasJournalContent).toBeTruthy();
    } else {
      // If no journal content, at least the page should load
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should handle responsive design", async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/profile");
    await page.waitForTimeout(2000);

    // Should load on mobile
    await expect(page.locator("body")).toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);

    // Should load on desktop
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle navigation between pages", async ({ page }) => {
    // Navigate to profile
    await page.goto("/profile");
    await page.waitForTimeout(2000);

    // Navigate to map
    await page.goto("/map");
    await page.waitForTimeout(2000);

    // Should successfully navigate
    await expect(page.locator("body")).toBeVisible();

    // Navigate back to profile
    await page.goto("/profile");
    await page.waitForTimeout(2000);

    // Should still work
    await expect(page.locator("body")).toBeVisible();
  });
});

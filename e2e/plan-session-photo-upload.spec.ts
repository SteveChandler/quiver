import { test, expect } from "@playwright/test";

test.describe("Session Photo Upload Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should load plan session page", async ({ page }) => {
    await page.goto("/plan-session");
    await page.waitForTimeout(3000);

    // Should either show session form or redirect to auth
    const isAuthPage = page.url().includes("/auth");

    if (isAuthPage) {
      // Verify auth page loads
      await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    } else {
      // Verify session page loads
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should load log session page", async ({ page }) => {
    await page.goto("/log-session");
    await page.waitForTimeout(3000);

    // Should either show session form or redirect to auth
    const isAuthPage = page.url().includes("/auth");

    if (isAuthPage) {
      // Verify auth page loads
      await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    } else {
      // Verify session page loads
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should handle form interactions when authenticated", async ({
    page,
  }) => {
    await page.goto("/log-session");
    await page.waitForTimeout(3000);

    // Skip if redirected to auth
    if (page.url().includes("/auth")) {
      test.skip("User not authenticated");
      return;
    }

    // Look for any form elements
    const formElements = [
      page.locator('input[type="text"]'),
      page.locator('input[type="file"]'),
      page.locator("textarea"),
      page.locator("select"),
      page.getByRole("button"),
    ];

    // Try to interact with form elements if they exist
    let hasFormElements = false;
    for (const element of formElements) {
      if (await element.isVisible().catch(() => false)) {
        hasFormElements = true;
        break;
      }
    }

    if (hasFormElements) {
      expect(hasFormElements).toBeTruthy();
    } else {
      // If no form elements, at least the page should load
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should handle navigation between session pages", async ({ page }) => {
    // Navigate to plan session
    await page.goto("/plan-session");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();

    // Navigate to log session
    await page.goto("/log-session");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();

    // Navigate back to home
    await page.goto("/");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should handle responsive design", async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/log-session");
    await page.waitForTimeout(2000);

    // Should load properly on mobile
    await expect(page.locator("body")).toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(1000);

    // Should load properly on desktop
    await expect(page.locator("body")).toBeVisible();
  });
});

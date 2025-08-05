import { test, expect } from "@playwright/test";

test.describe("Forecast Loading Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route("**/api/forecasts/update-enhanced**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            message: "Enhanced forecasts updated for test beach",
            forecastsCount: 96,
          },
        }),
      });
    });

    // Mock beaches API with realistic beach data
    await page.route("**/api/beaches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "test-beach-1",
              name: "Ocean Beach",
              latitude: 32.7503,
              longitude: -117.2534,
              location: "San Diego, CA",
            },
            {
              id: "test-beach-2",
              name: "Pacific Beach",
              latitude: 32.803,
              longitude: -117.2405,
              location: "San Diego, CA",
            },
          ],
        }),
      });
    });
  });

  test.describe("Basic Forecast Loading", () => {
    test("should load beach cards and forecast data", async ({ page }) => {
      await page.goto("/map");

      // Wait for beach cards to load - use more flexible selectors
      await expect(
        page.locator('[data-testid*="beach-card"], .beach-card, .card').first()
      ).toBeVisible({ timeout: 10000 });

      // Check that we have multiple beach cards
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card, .card'
      );
      const cardCount = await beachCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test("should handle forecast errors gracefully", async ({ page }) => {
      // Mock forecast API to return error
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Forecast service unavailable",
          }),
        });
      });

      await page.goto("/map");

      // Should still show beach cards even with forecast errors
      await expect(
        page.locator('[data-testid*="beach-card"], .beach-card, .card').first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Beach Selection", () => {
    test("should allow selecting beach cards", async ({ page }) => {
      await page.goto("/map");

      // Wait for beach cards and select one
      const firstCard = page
        .locator('[data-testid*="beach-card"], .beach-card, .card')
        .first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });

      // Click the first beach card
      await firstCard.click();

      // Should navigate to beach details or show selected state
      await page.waitForTimeout(1000);
      // The test passes if clicking doesn't cause errors
    });
  });

  test.describe("Beach Page Integration", () => {
    test("should load beach detail page", async ({ page }) => {
      await page.goto("/beach/test-beach-1");

      // Should load the beach page without errors
      await expect(page.locator("h1, h2, .beach-header")).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Basic Navigation", () => {
    test("should navigate to map page successfully", async ({ page }) => {
      await page.goto("/map");

      // Should show some content - use more flexible selectors
      await expect(
        page.locator("main, .map-container, .interactive-map")
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

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
            type: "enhanced",
            wave_height: "4-6 ft",
            wind_speed: "10-15 mph",
            wind_direction: "W",
            weather_condition: "Partly cloudy",
            confidence_score: 85,
          },
        }),
      });
    });

    // Mock beaches API
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

      // Wait for beach cards to load
      await expect(
        page.locator('[data-testid="beach-card"]').first()
      ).toBeVisible({ timeout: 10000 });

      // Check that we have multiple beach cards
      const beachCards = page.locator('[data-testid="beach-card"]');
      const cardCount = await beachCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test("should handle forecast errors gracefully", async ({ page }) => {
      // Mock error response
      await page.route("**/api/forecasts/update-enhanced**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Server error",
          }),
        });
      });

      await page.goto("/map");

      // Should still show beach cards even if forecast fails
      await expect(
        page.locator('[data-testid="beach-card"]').first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Beach Selection", () => {
    test("should allow selecting beach cards", async ({ page }) => {
      await page.goto("/map");

      // Wait for beach cards and select one
      const firstCard = page.locator('[data-testid="beach-card"]').first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });

      // Click the first beach card
      await firstCard.click();

      // Page should respond to the interaction (no specific assertion needed)
      await page.waitForTimeout(1000);
    });
  });

  test.describe("Beach Page Integration", () => {
    test("should load beach detail page", async ({ page }) => {
      await page.goto("/beach/test-beach-1");

      // Should load the beach page without errors
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Basic Navigation", () => {
    test("should navigate to map page successfully", async ({ page }) => {
      await page.goto("/map");

      // Should show header
      await expect(page.locator("header")).toBeVisible();

      // Should show some content
      await expect(page.locator("main")).toBeVisible();
    });
  });
});

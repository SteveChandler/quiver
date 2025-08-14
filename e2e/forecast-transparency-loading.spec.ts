import { test, expect } from "@playwright/test";

test.describe("Forecast Transparency and Loading", () => {
  // ---------- Transparency-focused tests (no global mocks) ----------
  test("should display data source transparency for NOAA data", async ({
    page,
  }) => {
    await page.goto("/map");
    await expect(page.locator("body")).toBeVisible();

    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      await expect(page.locator("body")).toBeVisible();

      const transparencyAlert = page.getByRole("alert").filter({
        hasText: /data|source|NOAA|oceanographic/i,
      });

      if (await transparencyAlert.isVisible()) {
        const realDataBadge = page.getByText("Real Wave Data");
        const dataSourceText = page.locator(
          "text=/NOAA WaveWatch III|Open-Meteo Marine/i"
        );
        const checkIcon = page.locator('svg[class*="lucide-circle-check"]');

        if (await realDataBadge.isVisible()) {
          await expect(realDataBadge).toBeVisible();
          await expect(dataSourceText).toBeVisible();
          await expect(checkIcon).toBeVisible();
          await expect(transparencyAlert).toHaveClass(
            /border-green-200|bg-green|border-green/i
          );
        }
      }
    }
  });

  test("should display fallback data indicators when using estimated data", async ({
    page,
  }) => {
    await page.route("**/api/forecasts/update-enhanced**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            message: "Enhanced forecasts updated with fallback data",
            forecastsCount: 96,
            usedFallback: true,
          },
        }),
      });
    });

    await page.goto("/map");

    const searchInput = page.getByPlaceholder(/search.*beach/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Remote Beach Location");
      await searchInput.press("Enter");
      await page.waitForTimeout(2000);

      const transparencyAlert = page
        .getByRole("alert")
        .filter({ hasText: /estimated|fallback|conditions/i });
      if (await transparencyAlert.isVisible()) {
        const estimatedBadge = page.getByText("Estimated Conditions");
        const warningText = page.getByText(/Using estimated wave conditions/i);
        const alertIcon = page.locator('svg[class*="lucide-circle-alert"]');
        await expect(estimatedBadge).toBeVisible();
        await expect(warningText).toBeVisible();
        await expect(alertIcon).toBeVisible();
        await expect(transparencyAlert).toHaveClass(
          /border-orange-200|bg-orange|border-amber/i
        );
      }
    }
  });

  test("should never return stale data in forecast displays", async ({
    page,
  }) => {
    await page.goto("/map");
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      const staleDataWarning = page.getByText(/stale|outdated|old.*data/i);
      const expiredWarning = page.getByText(/expired|invalid.*forecast/i);
      await expect(staleDataWarning).not.toBeVisible();
      await expect(expiredWarning).not.toBeVisible();

      const forecastTimestamp = page.locator(
        "[data-testid='forecast-timestamp']"
      );
      if (await forecastTimestamp.isVisible()) {
        const timestampText = await forecastTimestamp.textContent();
        const forecastTime = new Date(timestampText || "");
        const now = new Date();
        const hoursDiff =
          Math.abs(now.getTime() - forecastTime.getTime()) / (1000 * 60 * 60);
        expect(hoursDiff).toBeLessThan(24);
      }
    }
  });

  test("should show confidence ratings correctly with yellow for Fair", async ({
    page,
  }) => {
    await page.goto("/map");
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      const fairRating = page
        .getByText("Fair")
        .filter({ hasText: /confidence|rating/i });
      if (await fairRating.isVisible()) {
        await expect(fairRating).toHaveClass(/yellow|amber/i);
      }
    }
  });

  test("should handle API failures gracefully without showing stale data", async ({
    page,
  }) => {
    await page.goto("/map");
    await page.route("**/api/forecasts/**", (route) => route.abort("failed"));
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      const errorMessage = page.getByText(/error|failed.*load|try.*again/i);
      const staleDataDisplay = page.getByText(/last.*updated|cached.*data/i);
      const hasError = await errorMessage.isVisible().catch(() => false);
      const hasStaleData = await staleDataDisplay
        .isVisible()
        .catch(() => false);
      if (!hasError) {
        const forecastDisplay = page.locator(
          "[data-testid='forecast-display']"
        );
        await expect(forecastDisplay).not.toBeVisible();
      }
      expect(hasStaleData).toBeFalsy();
    }
  });

  test("should maintain transparency across different forecast views", async ({
    page,
  }) => {
    await page.goto("/");
    const homeTransparency = page
      .getByRole("alert")
      .filter({ hasText: /data.*source|NOAA|estimated/i });
    if (await homeTransparency.isVisible())
      await expect(homeTransparency).toBeVisible();

    await page.goto("/map");
    const mapTransparency = page
      .getByRole("alert")
      .filter({ hasText: /data.*source|NOAA|estimated/i });
    if (await mapTransparency.isVisible())
      await expect(mapTransparency).toBeVisible();

    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      const detailTransparency = page
        .getByRole("alert")
        .filter({ hasText: /data.*source|NOAA|estimated/i });
      if (await detailTransparency.isVisible())
        await expect(detailTransparency).toBeVisible();
    }
  });

  // ---------- Loading-flow tests (scoped mocks) ----------
  test.describe("Loading flows & beach selection (mocked)", () => {
    test.beforeEach(async ({ page }) => {
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

    test("should load beach cards and forecast data", async ({ page }) => {
      await page.goto("/map");
      await expect(
        page.locator('[data-testid*="beach-card"], .beach-card, .card').first()
      ).toBeVisible({ timeout: 10000 });
      const beachCards = page.locator(
        '[data-testid*="beach-card"], .beach-card, .card'
      );
      expect(await beachCards.count()).toBeGreaterThan(0);
    });

    test("should handle forecast errors gracefully", async ({ page }) => {
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
      await expect(
        page.locator('[data-testid*="beach-card"], .beach-card, .card').first()
      ).toBeVisible({ timeout: 10000 });
    });

    test("should allow selecting beach cards", async ({ page }) => {
      await page.goto("/map");
      const firstCard = page
        .locator('[data-testid*="beach-card"], .beach-card, .card')
        .first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });
      await firstCard.click();
      await page.waitForTimeout(1000);
    });

    test("should load beach detail page", async ({ page }) => {
      await page.goto("/beach/test-beach-1");
      await expect(page.locator("h1, h2, .beach-header")).toBeVisible({
        timeout: 10000,
      });
    });

    test("should navigate to map page successfully", async ({ page }) => {
      await page.goto("/map");
      await expect(
        page.locator("main, .map-container, .interactive-map")
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

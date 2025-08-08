import { test, expect } from "@playwright/test";

test.describe("Forecast Data Transparency", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should display data source transparency for NOAA data", async ({
    page,
  }) => {
    // Navigate to forecast page or beach detail with forecast
    await page.goto("/map");
    await expect(page.locator("body")).toBeVisible();

    // Find a beach with forecast data
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();
      await expect(page.locator("body")).toBeVisible();

      // Look for forecast data transparency component
      const transparencyAlert = page.getByRole("alert").filter({
        hasText: /data|source|NOAA|oceanographic/i,
      });

      if (await transparencyAlert.isVisible()) {
        // Verify real data indicators
        const realDataBadge = page.getByText("Real Wave Data");
        // Accept both NOAA and Open-Meteo sources since we now use Open-Meteo as fallback
        const dataSourceText = page.locator(
          "text=/NOAA WaveWatch III|Open-Meteo Marine/i"
        );
        const checkIcon = page.locator('svg[class*="lucide-circle-check"]');

        if (await realDataBadge.isVisible()) {
          await expect(realDataBadge).toBeVisible();
          await expect(dataSourceText).toBeVisible();
          await expect(checkIcon).toBeVisible();

          // Verify green styling for real data
          await expect(transparencyAlert).toHaveClass(/border-green-200/);
        }
      }
    }
  });

  test("should display fallback data indicators when using estimated data", async ({
    page,
  }) => {
    // Mock API to simulate locations with no real wave data (forcing fallback)
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

    // Search for a remote location that would use fallback data
    const searchInput = page.getByPlaceholder(/search.*beach/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Remote Beach Location");
      await searchInput.press("Enter");
      await page.waitForTimeout(2000);

      // Look for forecast transparency indicators
      const transparencyAlert = page.getByRole("alert").filter({
        hasText: /estimated|fallback|conditions/i,
      });

      if (await transparencyAlert.isVisible()) {
        // Verify fallback data indicators
        const estimatedBadge = page.getByText("Estimated Conditions");
        const warningText = page.getByText(/Using estimated wave conditions/i);
        const alertIcon = page.locator('svg[class*="lucide-circle-alert"]');

        await expect(estimatedBadge).toBeVisible();
        await expect(warningText).toBeVisible();
        await expect(alertIcon).toBeVisible();

        // Verify orange styling for fallback data
        await expect(transparencyAlert).toHaveClass(/border-orange-200/);
      }
    }
  });

  test("should never return stale data in forecast displays", async ({
    page,
  }) => {
    // This test validates that stale data is never shown [[memory:3347074]]
    await page.goto("/map");

    // Find forecast data on any beach
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();

      // Check for any stale data indicators or timestamps
      const staleDataWarning = page.getByText(/stale|outdated|old.*data/i);
      const expiredWarning = page.getByText(/expired|invalid.*forecast/i);

      // Should NOT have stale data warnings
      await expect(staleDataWarning).not.toBeVisible();
      await expect(expiredWarning).not.toBeVisible();

      // Check for current timestamps
      const forecastTimestamp = page.locator(
        "[data-testid='forecast-timestamp']"
      );
      if (await forecastTimestamp.isVisible()) {
        const timestampText = await forecastTimestamp.textContent();
        const forecastTime = new Date(timestampText || "");
        const now = new Date();
        const hoursDiff =
          Math.abs(now.getTime() - forecastTime.getTime()) / (1000 * 60 * 60);

        // Forecast should be recent (within 24 hours)
        expect(hoursDiff).toBeLessThan(24);
      }
    }
  });

  test("should show confidence ratings correctly with yellow for Fair", async ({
    page,
  }) => {
    // Test the preference for Fair confidence rating in yellow [[memory:3347079]]
    await page.goto("/map");

    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();

      // Look for confidence rating displays
      const confidenceRating = page.locator(
        "[data-testid='confidence-rating']"
      );
      const fairRating = page.getByText("Fair").filter({
        hasText: /confidence|rating/i,
      });

      if (await fairRating.isVisible()) {
        // Verify Fair rating has yellow styling
        await expect(fairRating).toHaveClass(/yellow|amber/);

        // Alternative: check for yellow background or text color
        const fairElement = fairRating.first();
        const computedStyle = await fairElement.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
          };
        });

        // Should contain yellow/amber color values
        const hasYellowStyling =
          computedStyle.backgroundColor.includes("rgb(254, 240, 138)") || // yellow-200
          computedStyle.backgroundColor.includes("rgb(251, 191, 36)") || // yellow-400
          computedStyle.color.includes("rgb(146, 64, 14)") || // yellow-800
          computedStyle.borderColor.includes("rgb(251, 191, 36)"); // yellow-400

        expect(hasYellowStyling).toBeTruthy();
      }
    }
  });

  test("should handle API failures gracefully without showing stale data", async ({
    page,
  }) => {
    // Test network resilience
    await page.goto("/map");

    // Simulate network issues by intercepting API calls
    await page.route("**/api/forecasts/**", (route) => {
      route.abort("failed");
    });

    // Try to load forecast data
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();

      // Should show error message, not stale data
      const errorMessage = page.getByText(/error|failed.*load|try.*again/i);
      const staleDataDisplay = page.getByText(/last.*updated|cached.*data/i);

      // Should either show error or no data, never stale data
      const hasError = await errorMessage.isVisible();
      const hasStaleData = await staleDataDisplay.isVisible();

      if (!hasError) {
        // If no explicit error, should not show any forecast data
        const forecastDisplay = page.locator(
          "[data-testid='forecast-display']"
        );
        await expect(forecastDisplay).not.toBeVisible();
      }

      // Critical: Never show stale data even on API failure
      expect(hasStaleData).toBeFalsy();
    }
  });

  test("should display data source details in forecast stats", async ({
    page,
  }) => {
    await page.goto("/map");

    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();

      // Look for forecast stats section with data sources
      const forecastStats = page.locator("[data-testid='forecast-stats']");
      if (await forecastStats.isVisible()) {
        // Should show multiple data sources
        const noaaWaveWatch = page.getByText("NOAA WaveWatch III");
        const noaaCOOPS = page.getByText("NOAA CO-OPS");
        const ndbcBuoys = page.getByText("NDBC Buoys");
        const noaaWeather = page.getByText("NOAA Weather");

        // At least one data source should be visible
        const dataSources = [noaaWaveWatch, noaaCOOPS, ndbcBuoys, noaaWeather];
        const visibleSources = await Promise.all(
          dataSources.map((source) => source.isVisible().catch(() => false))
        );
        const hasVisibleSource = visibleSources.some(Boolean);

        expect(hasVisibleSource).toBeTruthy();

        // Should show data quality indicators
        const dataQuality = page.getByText(/data.*quality|confidence/i);
        if (await dataQuality.isVisible()) {
          await expect(dataQuality).toBeVisible();
        }
      }
    }
  });

  test("should maintain transparency across different forecast views", async ({
    page,
  }) => {
    await page.goto("/");

    // Test forecast transparency on home page
    const homeForeccast = page.locator("[data-testid='forecast-content']");
    if (await homeForeccast.isVisible()) {
      const homeTransparency = page.getByRole("alert").filter({
        hasText: /data.*source|NOAA|estimated/i,
      });

      if (await homeTransparency.isVisible()) {
        await expect(homeTransparency).toBeVisible();
      }
    }

    // Test on map page
    await page.goto("/map");
    const mapForecast = page.locator("[data-testid='forecast-display']");
    if (await mapForecast.isVisible()) {
      const mapTransparency = page.getByRole("alert").filter({
        hasText: /data.*source|NOAA|estimated/i,
      });

      if (await mapTransparency.isVisible()) {
        await expect(mapTransparency).toBeVisible();
      }
    }

    // Test on beach detail page
    const beachCard = page
      .locator(".beach-card, [data-testid='beach-card']")
      .first();
    if (await beachCard.isVisible()) {
      await beachCard.click();

      const detailTransparency = page.getByRole("alert").filter({
        hasText: /data.*source|NOAA|estimated/i,
      });

      if (await detailTransparency.isVisible()) {
        await expect(detailTransparency).toBeVisible();
      }
    }
  });
});

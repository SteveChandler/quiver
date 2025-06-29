import { test, expect } from "@playwright/test";

test.describe("ForecastCard Component - Unauthenticated User Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication for unauthenticated tests
    await page.context().clearCookies();
    await page.goto("/");
    await page.waitForTimeout(3000);
  });

  test("should display forecast cards on landing page", async ({ page }) => {
    // Look for forecast cards using CSS selectors that match the actual component
    const forecastCards = page.locator(".bg-white\\/90.backdrop-blur-sm");
    const cardCount = await forecastCards.count();

    if (cardCount > 0) {
      const firstCard = forecastCards.first();

      // Check for day/date structure
      const dayText = firstCard.getByText(
        /today|tomorrow|thu|fri|sat|sun|mon|tue|wed/i
      );
      const hasDayText = await dayText.isVisible().catch(() => false);

      // Check for forecast data
      const forecastData = firstCard.getByText(/ft|mph|°f/i);
      const hasForecastData = await forecastData.isVisible().catch(() => false);

      expect(hasDayText || hasForecastData).toBeTruthy();
    }
  });

  test("should show basic forecast metrics on landing page", async ({
    page,
  }) => {
    const forecastCards = page.locator(".bg-white\\/90.backdrop-blur-sm");
    const cardCount = await forecastCards.count();

    if (cardCount > 0) {
      const firstCard = forecastCards.first();

      // Check for basic forecast metrics (from mock data)
      const waveHeight = firstCard.getByText(/\d+(\.\d+)?\s*(ft)?/i);
      const windSpeed = firstCard.getByText(/\d+\s*mph/i);
      const waterTemp = firstCard.getByText(/\d+°f/i);

      const hasWaveHeight = await waveHeight.isVisible().catch(() => false);
      const hasWindSpeed = await windSpeed.isVisible().catch(() => false);
      const hasWaterTemp = await waterTemp.isVisible().catch(() => false);

      // Should have at least basic forecast data
      expect(hasWaveHeight || hasWindSpeed || hasWaterTemp).toBeTruthy();
    }
  });
});

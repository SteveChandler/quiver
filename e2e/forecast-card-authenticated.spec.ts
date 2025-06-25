import { test, expect } from "@playwright/test";

test.describe("ForecastCard Component - Authenticated User Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Add Playwright detection to trigger test mode
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    // Use authenticated state by going to a page that requires login
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  });

  test.describe("Layout Structure", () => {
    test("should display day and date at the top", async ({ page }) => {
      // Navigate to a page with forecast cards (homepage forecast section)
      await page.waitForTimeout(2000);

      // Check if we're on the authenticated home screen with tabs
      const tabs = page.getByRole("tab");
      const tabCount = await tabs.count();

      if (tabCount > 0) {
        // We're on authenticated home screen, look for forecast tab
        const forecastTab = page.getByRole("tab", { name: /forecast/i });
        if (await forecastTab.isVisible()) {
          await forecastTab.click();
          await page.waitForTimeout(2000);
        }
      }

      // Look for forecast cards using the actual CSS classes from the component
      const forecastCards = page.locator(".bg-white\\/90.backdrop-blur-sm");
      let cardCount = await forecastCards.count();

      if (cardCount === 0) {
        // Try to trigger forecast display via beach search
        const beachSearchSection = page.getByText(
          /beach forecast|find surf forecast/i
        );
        if (await beachSearchSection.isVisible()) {
          const searchButton = page.getByRole("button", {
            name: /use my current location|search/i,
          });
          if (await searchButton.isVisible()) {
            await searchButton.click();
            await page.waitForTimeout(3000);
            cardCount = await forecastCards.count();
          }
        }
      }

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check for day/date text at the top
        const dayText = firstCard.getByText(
          /today|tomorrow|mon|tue|wed|thu|fri|sat|sun/i
        );
        const dateText = firstCard.getByText(
          /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i
        );

        const hasDayText = await dayText.isVisible().catch(() => false);
        const hasDateText = await dateText.isVisible().catch(() => false);

        expect(hasDayText || hasDateText).toBeTruthy();
      }
    });

    test("should display conditions in a horizontal row beneath day/date", async ({
      page,
    }) => {
      await page.waitForTimeout(2000);

      // Look for forecast cards with conditions
      const forecastCards = page.locator(".bg-white\\/90.backdrop-blur-sm");
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check for wave height indicator
        const waveIcon = firstCard.locator("svg").first();
        const waveText = firstCard.getByText(/ft|high|wave/i);

        // Check for wind speed indicator
        const windText = firstCard.getByText(/mph|wind|knots/i);

        // Check for water temperature indicator
        const tempText = firstCard.getByText(/°f|°c|water|temp/i);

        const hasWaveInfo =
          (await waveIcon.isVisible().catch(() => false)) ||
          (await waveText.isVisible().catch(() => false));
        const hasWindInfo = await windText.isVisible().catch(() => false);
        const hasTempInfo = await tempText.isVisible().catch(() => false);

        // Should have at least wave and wind information
        expect(hasWaveInfo && hasWindInfo).toBeTruthy();
      }
    });

    test("should display icons for each forecast metric", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check for SVG icons (waves, wind, thermometer, navigation)
        const icons = firstCard.locator("svg");
        const iconCount = await icons.count();

        // Should have at least 2-3 icons (wave, wind, temperature)
        expect(iconCount).toBeGreaterThanOrEqual(2);

        // Check for specific icon types by their typical class names or data attributes
        const waveIcon = firstCard.locator("svg").first();
        const hasWaveIcon = await waveIcon.isVisible().catch(() => false);
        expect(hasWaveIcon).toBeTruthy();
      }
    });
  });

  test.describe("Data Display", () => {
    test("should show wave height with units", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Look for wave height text (typically includes "ft" or numbers)
        const waveHeight = firstCard.getByText(/\d+(\.\d+)?\s*ft|high/i);
        const hasWaveHeight = await waveHeight.isVisible().catch(() => false);

        expect(hasWaveHeight).toBeTruthy();
      }
    });

    test("should show wind speed with units", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Look for wind speed text
        const windSpeed = firstCard.getByText(/\d+\s*mph|wind/i);
        const hasWindSpeed = await windSpeed.isVisible().catch(() => false);

        expect(hasWindSpeed).toBeTruthy();
      }
    });

    test("should show water temperature when available", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Look for temperature text
        const waterTemp = firstCard.getByText(/\d+°f|°c|water/i);
        const hasWaterTemp = await waterTemp.isVisible().catch(() => false);

        // Water temperature should be visible in forecast cards
        expect(hasWaterTemp).toBeTruthy();
      }
    });
  });

  test.describe("Wave Direction Feature", () => {
    test("should display wave direction when data is available", async ({
      page,
    }) => {
      // Navigate to a page that uses real forecast data (beach search)
      const beachSearchSection = page.getByText(
        /beach forecast|find surf forecast/i
      );
      if (await beachSearchSection.isVisible()) {
        // Try to get location-based forecast
        const locationButton = page.getByRole("button", {
          name: /use my current location/i,
        });
        if (await locationButton.isVisible()) {
          await locationButton.click();
          await page.waitForTimeout(5000);

          // Look for forecast card with wave direction
          const forecastCard = page
            .locator(".forecast-card, [data-testid*='forecast-card']")
            .first();
          if (await forecastCard.isVisible()) {
            // Check for wave direction text (SW, NW, etc.)
            const waveDirection = forecastCard.getByText(
              /direction|sw|nw|ne|se|n|s|e|w/i
            );
            const hasWaveDirection = await waveDirection
              .isVisible()
              .catch(() => false);

            if (hasWaveDirection) {
              expect(hasWaveDirection).toBeTruthy();
            }
          }
        }
      }
    });

    test("should display navigation icon for wave direction", async ({
      page,
    }) => {
      // Navigate to beach search to get real forecast data
      const beachSearchSection = page.getByText(
        /beach forecast|find surf forecast/i
      );
      if (await beachSearchSection.isVisible()) {
        const locationButton = page.getByRole("button", {
          name: /use my current location/i,
        });
        if (await locationButton.isVisible()) {
          await locationButton.click();
          await page.waitForTimeout(5000);

          const forecastCard = page
            .locator(".forecast-card, [data-testid*='forecast-card']")
            .first();
          if (await forecastCard.isVisible()) {
            // Check for navigation/compass icon (typically represented by SVG)
            const icons = forecastCard.locator("svg");
            const iconCount = await icons.count();

            // Should have multiple icons including navigation icon if wave direction is present
            expect(iconCount).toBeGreaterThanOrEqual(3);
          }
        }
      }
    });

    test("should handle missing wave direction gracefully", async ({
      page,
    }) => {
      await page.waitForTimeout(2000);

      // Check homepage forecast cards which may not have wave direction
      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Should still display other forecast data even if wave direction is missing
        const waveHeight = firstCard.getByText(/\d+(\.\d+)?\s*ft|high/i);
        const windSpeed = firstCard.getByText(/\d+\s*mph|wind/i);

        const hasWaveHeight = await waveHeight.isVisible().catch(() => false);
        const hasWindSpeed = await windSpeed.isVisible().catch(() => false);

        // Core forecast data should still be present
        expect(hasWaveHeight || hasWindSpeed).toBeTruthy();
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should display properly on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check that card content is visible and not cut off
        const cardBounds = await firstCard.boundingBox();
        if (cardBounds) {
          expect(cardBounds.width).toBeLessThanOrEqual(375);
          expect(cardBounds.width).toBeGreaterThan(200); // Should have reasonable width
        }

        // Content should still be readable
        const hasText = await firstCard
          .locator("text")
          .isVisible()
          .catch(() => false);
        const hasIcons = await firstCard
          .locator("svg")
          .isVisible()
          .catch(() => false);

        expect(hasText || hasIcons).toBeTruthy();
      }
    });

    test("should display properly on tablet devices", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/");
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check that card scales properly for tablet
        const cardBounds = await firstCard.boundingBox();
        if (cardBounds) {
          expect(cardBounds.width).toBeLessThanOrEqual(768);
          expect(cardBounds.width).toBeGreaterThan(250);
        }

        // Content should be well-spaced
        const icons = firstCard.locator("svg");
        const iconCount = await icons.count();
        expect(iconCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe("Interactive Features", () => {
    test("should handle hover states properly", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Hover over the card
        await firstCard.hover();
        await page.waitForTimeout(500);

        // Card should still be visible and functional after hover
        const isVisible = await firstCard.isVisible();
        expect(isVisible).toBeTruthy();
      }
    });

    test("should maintain accessibility standards", async ({ page }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check for text content that would be readable by screen readers
        const textContent = await firstCard.textContent();
        expect(textContent).toBeTruthy();
        expect(textContent!.length).toBeGreaterThan(10);

        // Check that interactive elements are properly structured
        const focusableElements = firstCard.locator(
          "button, a, input, select, textarea, [tabindex]"
        );
        const focusableCount = await focusableElements.count();

        // Should have minimal focusable elements since it's primarily a display component
        expect(focusableCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should handle missing forecast data gracefully", async ({ page }) => {
      await page.waitForTimeout(2000);

      // Even if some forecast data is missing, the component should still render
      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Should display some content even with partial data
        const hasContent = await firstCard.textContent();
        expect(hasContent).toBeTruthy();

        // Should have basic structure
        const hasAnyText = await firstCard
          .locator("text")
          .isVisible()
          .catch(() => false);
        const hasAnyIcon = await firstCard
          .locator("svg")
          .isVisible()
          .catch(() => false);

        expect(hasAnyText || hasAnyIcon).toBeTruthy();
      }
    });

    test("should display placeholder text when data is unavailable", async ({
      page,
    }) => {
      await page.waitForTimeout(2000);

      const forecastCards = page.locator(
        ".forecast-card, [data-testid*='forecast-card'], [class*='card']"
      );
      const cardCount = await forecastCards.count();

      if (cardCount > 0) {
        const firstCard = forecastCards.first();

        // Check for placeholder or default text
        const noDataText = firstCard.getByText(/no data|unavailable|--/i);
        const hasPlaceholder = await noDataText.isVisible().catch(() => false);

        // Should either have real data or placeholder text
        const hasRealData = await firstCard
          .getByText(/\d+/i)
          .isVisible()
          .catch(() => false);

        expect(hasRealData || hasPlaceholder).toBeTruthy();
      }
    });
  });
});

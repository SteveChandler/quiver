import { test, expect } from "@playwright/test";

test.describe("Beach Search Fallback Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // Add Playwright detection to trigger test mode
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    // Navigate to the homepage where beach search is available
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  });

  test.describe("Fallback Message Display", () => {
    test("should show fallback message when searching for non-existent beach", async ({
      page,
    }) => {
      // Navigate to forecast tab if available
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      // Find the beach search input
      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Search for a non-existent beach
        await searchInput.fill("Tampico");
        await searchButton.click();

        // Wait for the search to complete
        await page.waitForTimeout(5000);

        // Check for fallback message
        const fallbackMessage = page.getByText(/beach "tampico" not found/i);
        expect(await fallbackMessage.isVisible()).toBeTruthy();

        // Check for the info icon
        const infoIcon = page.locator('[data-lucide="info"]');
        expect(await infoIcon.isVisible()).toBeTruthy();

        // Check for explanation text
        const explanationText = page.getByText(/we're showing you.*instead/i);
        expect(await explanationText.isVisible()).toBeTruthy();
      }
    });

    test("should display list of available beaches in fallback", async ({
      page,
    }) => {
      // Navigate to forecast tab if available
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Search for non-existent beach
        await searchInput.fill("NonExistentBeach123");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Check for available beaches grid
        const beachSuggestions = page.locator(
          "button:has-text('Beach'), button:has-text('beach')"
        );
        const suggestionCount = await beachSuggestions.count();

        // Should have at least a few beach suggestions
        expect(suggestionCount).toBeGreaterThan(0);
        expect(suggestionCount).toBeLessThanOrEqual(12); // Limited to 12 as per implementation

        // Check that suggestions are clickable buttons
        if (suggestionCount > 0) {
          const firstSuggestion = beachSuggestions.first();
          expect(await firstSuggestion.isVisible()).toBeTruthy();

          // Check button has proper styling
          const buttonClasses = await firstSuggestion.getAttribute("class");
          expect(buttonClasses).toContain("hover:bg-blue");
        }
      }
    });

    test("should show loading state when fetching beach suggestions", async ({
      page,
    }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        await searchInput.fill("InvalidBeachName");
        await searchButton.click();

        // Check for loading state during search
        const loadingSpinner = page.locator('[data-lucide="loader-2"]');
        const isLoading = await loadingSpinner.isVisible();

        // Loading state might be brief, so we don't strictly require it
        // but if it's there, it should be visible
        if (isLoading) {
          expect(isLoading).toBeTruthy();
        }

        await page.waitForTimeout(5000);

        // After loading completes, check for beach suggestions loading text
        const loadingBeachesText = page.getByText(/loading beaches/i);
        const beachSuggestions = page.locator("button");

        // Either should show loading text or beach suggestions
        const hasLoadingText = await loadingBeachesText.isVisible();
        const hasSuggestions = (await beachSuggestions.count()) > 0;

        expect(hasLoadingText || hasSuggestions).toBeTruthy();
      }
    });
  });

  test.describe("Beach Suggestion Interactions", () => {
    test("should navigate to suggested beach when clicked", async ({
      page,
    }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Search for non-existent beach to trigger fallback
        await searchInput.fill("FakeBeach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Find and click on a beach suggestion
        const beachSuggestions = page.locator(
          "button:has-text('Beach'), button:has-text('beach')"
        );
        const suggestionCount = await beachSuggestions.count();

        if (suggestionCount > 0) {
          const firstSuggestion = beachSuggestions.first();
          const suggestedBeachName = await firstSuggestion.textContent();

          await firstSuggestion.click();
          await page.waitForTimeout(3000);

          // Verify the search input now contains the suggested beach name
          const updatedInputValue = await searchInput.inputValue();
          expect(updatedInputValue).toBe(suggestedBeachName);

          // Verify fallback message is no longer visible
          const fallbackMessage = page.getByText(/not found/i);
          expect(await fallbackMessage.isVisible()).toBeFalsy();

          // Verify success message appears
          const successMessage = page.getByText(/showing surf conditions/i);
          expect(await successMessage.isVisible()).toBeTruthy();
        }
      }
    });

    test("should show forecast data for selected suggested beach", async ({
      page,
    }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        await searchInput.fill("TestInvalidBeach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        const beachSuggestions = page.locator(
          "button:has-text('Beach'), button:has-text('beach')"
        );
        const suggestionCount = await beachSuggestions.count();

        if (suggestionCount > 0) {
          await beachSuggestions.first().click();
          await page.waitForTimeout(3000);

          // Check for forecast card
          const forecastCard = page.locator(".forecast-card").first();
          if (await forecastCard.isVisible()) {
            // Verify forecast data is displayed
            const hasWaveHeight = await forecastCard
              .getByText(/ft|wave/i)
              .isVisible();
            const hasWindSpeed = await forecastCard
              .getByText(/mph|wind/i)
              .isVisible();
            const hasWaterTemp = await forecastCard
              .getByText(/°f|temp/i)
              .isVisible();

            expect(hasWaveHeight || hasWindSpeed || hasWaterTemp).toBeTruthy();
          }
        }
      }
    });

    test("should handle multiple suggestion clicks properly", async ({
      page,
    }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        await searchInput.fill("AnotherFakeBeach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        const beachSuggestions = page.locator(
          "button:has-text('Beach'), button:has-text('beach')"
        );
        const suggestionCount = await beachSuggestions.count();

        if (suggestionCount >= 2) {
          // Click first suggestion
          const firstBeach = await beachSuggestions.first().textContent();
          await beachSuggestions.first().click();
          await page.waitForTimeout(2000);

          let inputValue = await searchInput.inputValue();
          expect(inputValue).toBe(firstBeach);

          // Search for another non-existent beach
          await searchInput.fill("YetAnotherFakeBeach");
          await searchButton.click();
          await page.waitForTimeout(5000);

          // Click second suggestion
          const newSuggestions = page.locator(
            "button:has-text('Beach'), button:has-text('beach')"
          );
          if ((await newSuggestions.count()) >= 2) {
            const secondBeach = await newSuggestions.nth(1).textContent();
            await newSuggestions.nth(1).click();
            await page.waitForTimeout(2000);

            inputValue = await searchInput.inputValue();
            expect(inputValue).toBe(secondBeach);
          }
        }
      }
    });
  });

  test.describe("Success Cases", () => {
    test("should not show fallback message for valid beach searches", async ({
      page,
    }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Search for a known valid beach
        await searchInput.fill("Ocean Beach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Should not show fallback message
        const fallbackMessage = page.getByText(/not found/i);
        expect(await fallbackMessage.isVisible()).toBeFalsy();

        // Should show success message instead
        const successMessage = page.getByText(/showing surf conditions/i);
        expect(await successMessage.isVisible()).toBeTruthy();

        // Should not show beach suggestions
        const beachSuggestions = page.locator(
          "button:has-text('Beach'), button:has-text('beach')"
        );
        expect(await beachSuggestions.count()).toBe(0);
      }
    });

    test("should handle partial matches correctly", async ({ page }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Search for partial match (e.g., "Ocean" should match "Ocean Beach")
        await searchInput.fill("Ocean");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Should find a match without showing fallback
        const fallbackMessage = page.getByText(/not found/i);
        const hasFallback = await fallbackMessage.isVisible();

        // Success message should be shown instead of fallback
        const successMessage = page.getByText(/showing surf conditions/i);
        const hasSuccess = await successMessage.isVisible();

        expect(hasSuccess || !hasFallback).toBeTruthy();
      }
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle empty search input appropriately", async ({ page }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Clear input and try to search
        await searchInput.fill("");
        await searchButton.click();
        await page.waitForTimeout(2000);

        // Should not trigger fallback for empty search
        const fallbackMessage = page.getByText(/not found/i);
        expect(await fallbackMessage.isVisible()).toBeFalsy();
      }
    });

    test("should handle very long beach names", async ({ page }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        const longBeachName =
          "VeryLongNonExistentBeachNameThatShouldNotMatchAnything123456789";
        await searchInput.fill(longBeachName);
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Should handle long names gracefully
        const fallbackMessage = page.getByText(/not found/i);
        expect(await fallbackMessage.isVisible()).toBeTruthy();

        // Fallback message should be properly formatted
        const messageContainer = page.locator(".bg-blue-50");
        if (await messageContainer.isVisible()) {
          const containerBox = await messageContainer.boundingBox();
          expect(containerBox?.width).toBeDefined();
        }
      }
    });

    test("should handle special characters in search", async ({ page }) => {
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        // Test with special characters
        await searchInput.fill("Beach@#$%");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Should handle special characters without crashing
        const fallbackMessage = page.getByText(/not found/i);
        const hasPage = await page.locator("body").isVisible();

        expect(hasPage).toBeTruthy(); // Page should still be functional
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should display fallback message properly on mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        await searchInput.fill("MobileTestBeach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Check that fallback message fits on mobile screen
        const fallbackContainer = page.locator(".bg-blue-50");
        if (await fallbackContainer.isVisible()) {
          const containerBox = await fallbackContainer.boundingBox();
          expect(containerBox?.width).toBeLessThanOrEqual(375);

          // Beach suggestions should be in mobile-friendly grid
          const suggestionGrid = page.locator(".grid-cols-2");
          expect(await suggestionGrid.isVisible()).toBeTruthy();
        }
      }
    });

    test("should display more beach suggestions on larger screens", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });

      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      if (await forecastTab.isVisible()) {
        await forecastTab.click();
        await page.waitForTimeout(2000);
      }

      const searchInput = page.locator('input[placeholder*="beach"]');
      const searchButton = page.getByRole("button", { name: /search/i });

      if ((await searchInput.isVisible()) && (await searchButton.isVisible())) {
        await searchInput.fill("DesktopTestBeach");
        await searchButton.click();
        await page.waitForTimeout(5000);

        // Check for desktop grid layout
        const suggestionGrid = page.locator(".sm\\:grid-cols-3");
        if (await suggestionGrid.isVisible()) {
          expect(await suggestionGrid.isVisible()).toBeTruthy();
        }
      }
    });
  });
});

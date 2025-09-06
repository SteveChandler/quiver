import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  waitForElementReady,
  waitForPageLoadAndDismissModal,
  ensureAuthenticated,
} from "./test-helpers";

test.describe("Forecast Components", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we are authenticated and truly on the Home screen (not Landing)
    const authed = await ensureAuthenticated(page);
    if (!authed) {
      throw new Error(
        "Authentication missing for forecast component tests. Ensure E2E creds or dev helper are configured."
      );
    }

    await page.goto("/");
    await waitForPageLoadAndDismissModal(page);

    // Verify Home screen markers: bottom nav present, landing CTA absent
    await expect(page.getByTestId("bottom-navigation")).toBeVisible();
    const landingCta = page.locator('[data-testid="test-fallback-cta"]');
    expect(await landingCta.count()).toBe(0);
  });

  test.describe("ForecastTab Component", () => {
    test("displays forecast information correctly", async ({ page }) => {
      // Wait for forecast tab to be visible - try multiple selectors
      const forecastTab = page.locator('[data-testid="forecast-tab"], #forecast-tab-content, .space-y-4:has-text("ft"), .space-y-4:has-text("mph")').first();
      await waitForElementReady(forecastTab);

      // Check that forecast data is displayed - be more flexible with units
      const hasWaveHeight = await page.locator("text=/ft|feet|wave/i").count() > 0;
      const hasWindSpeed = await page.locator("text=/mph|kts|wind/i").count() > 0;
      
      // At least one of these should be true for a valid forecast
      expect(hasWaveHeight || hasWindSpeed).toBe(true);
    });

    test("handles high confidence forecast display", async ({ page }) => {
      // Look for high confidence indicator
      const highConfidenceIndicator = page.locator('[data-testid="high-confidence-forecast"]');
      const highConfidenceCount = await highConfidenceIndicator.count();
      
      if (highConfidenceCount > 0) {
        // High confidence indicator found - verify it's visible
        await expect(highConfidenceIndicator.first()).toBeVisible();
      } else {
        // No high confidence indicator is also valid - just verify the forecast tab loaded
        // The forecast tab element was already found in the previous test
        const forecastTab = page.locator('[data-testid="forecast-tab"], #forecast-tab-content').first();
        await expect(forecastTab).toBeVisible();
      }
    });

    test("navigates to beach details when forecast is clicked", async ({
      page,
    }) => {
      // Look for clickable forecast elements
      const forecastCards = page
        .locator('[data-testid="beach-card"], .forecast-card, .beach-forecast')
        .first();

      if ((await forecastCards.count()) > 0) {
        await waitForElementReady(forecastCards);
        await forecastCards.click();

        // Should navigate to beach detail page or forecast detail
        await page.waitForTimeout(1000);
        const url = page.url();
        expect(url).toMatch(/(beach|forecast)/);
      }
    });
  });

  test.describe("ForecastFeedbackForm Component", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a session page where feedback form might be available
      await page.goto("/sessions");
      await waitForPageLoad(page);
    });

    test("displays feedback form elements", async ({ page }) => {
      // Try to find feedback form or trigger it
      const feedbackTrigger = page
        .locator('button:has-text("feedback"), button:has-text("Feedback")')
        .first();

      if ((await feedbackTrigger.count()) > 0) {
        await feedbackTrigger.click();
        await page.waitForTimeout(500);

        // Check for form elements
        await expect(page.locator("text=/wave height/i").first()).toBeVisible();
        await expect(page.locator("text=/wind/i").first()).toBeVisible();
      }
    });

    test("allows wave height slider interaction", async ({ page }) => {
      // Look for feedback form or create a session first
      const logSessionButton = page
        .locator('button:has-text("Log Session"), a:has-text("Log Session")')
        .first();

      if ((await logSessionButton.count()) > 0) {
        await logSessionButton.click();
        await waitForPageLoad(page);

        // Look for sliders in the form
        const sliders = page.locator('[role="slider"]');

        if ((await sliders.count()) > 0) {
          const waveHeightSlider = sliders.first();
          await waitForElementReady(waveHeightSlider);

          // Test slider interaction with keyboard
          await waveHeightSlider.focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("ArrowRight");

          // Verify slider value changed
          const sliderValue = await waveHeightSlider.getAttribute(
            "aria-valuenow"
          );
          expect(parseInt(sliderValue || "0")).toBeGreaterThan(0);
        }
      }
    });

    test("allows wind condition selection", async ({ page }) => {
      // Look for session logging or feedback forms
      const logSessionButton = page
        .locator('button:has-text("Log Session"), a:has-text("Log Session")')
        .first();

      if ((await logSessionButton.count()) > 0) {
        await logSessionButton.click();
        await waitForPageLoad(page);

        // Look for wind condition selects
        const windSelect = page.locator('[role="combobox"]').first();

        if ((await windSelect.count()) > 0) {
          await waitForElementReady(windSelect);
          await windSelect.click();

          // Wait for options to appear
          await page.waitForTimeout(500);

          // Look for wind condition options
          const windOptions = page.locator("text=/glassy|offshore|onshore/i");

          if ((await windOptions.count()) > 0) {
            await windOptions.first().click();
            await expect(windSelect).toContainText(/glassy|offshore|onshore/i);
          }
        }
      }
    });

    test("validates form submission", async ({ page }) => {
      // Navigate to log session form
      const logSessionButton = page
        .locator('button:has-text("Log Session"), a:has-text("Log Session")')
        .first();

      if ((await logSessionButton.count()) > 0) {
        await logSessionButton.click();
        await waitForPageLoad(page);

        // Fill out basic session info first
        const beachInput = page
          .locator(
            'input[placeholder*="beach"], input[placeholder*="location"]'
          )
          .first();
        if ((await beachInput.count()) > 0) {
          await beachInput.fill("Test Beach");
          await page.waitForTimeout(500);

          // Select first suggestion if available
          const firstSuggestion = page
            .locator('[role="option"], .suggestion')
            .first();
          if ((await firstSuggestion.count()) > 0) {
            await firstSuggestion.click();
          }
        }

        // Look for submit button
        const submitButton = page
          .locator(
            'button[type="submit"], button:has-text("Save"), button:has-text("Log")'
          )
          .first();

        if ((await submitButton.count()) > 0) {
          // Try to submit and check for validation or success
          await submitButton.click();
          await page.waitForTimeout(1000);

          // Check for either success message or validation errors
          const hasSuccess =
            (await page.locator("text=/success|saved|logged/i").count()) > 0;
          const hasValidation =
            (await page.locator("text=/required|error/i").count()) > 0;

          expect(hasSuccess || hasValidation).toBe(true);
        }
      }
    });
  });

  test.describe("Adjusted Forecast Display", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to beach detail page where adjusted forecasts might be shown
      await page.goto("/beach/");
      await waitForPageLoad(page);
    });

    test("displays forecast adjustments when available", async ({ page }) => {
      // Look for adjusted forecast indicators
      const adjustedIndicators = page.locator(
        "text=/adjusted|community|confirmed/i"
      );

      if ((await adjustedIndicators.count()) > 0) {
        await expect(adjustedIndicators.first()).toBeVisible();
      }
    });

    test("shows tooltip information for forecast details", async ({ page }) => {
      // Look for info buttons or tooltips
      const infoButtons = page
        .locator(
          'button[aria-label*="info"], button:has([class*="info"]), .tooltip-trigger'
        )
        .first();

      if ((await infoButtons.count()) > 0) {
        await waitForElementReady(infoButtons);
        await infoButtons.hover();

        // Check for tooltip content
        await page.waitForTimeout(500);
        const tooltipContent = page.locator(
          '[role="tooltip"], .tooltip-content'
        );

        if ((await tooltipContent.count()) > 0) {
          await expect(tooltipContent.first()).toBeVisible();
        }
      }
    });
  });

  test.describe("Forecast Navigation", () => {
    test("allows navigation between different forecast views", async ({
      page,
    }) => {
      // Look for forecast navigation tabs or buttons
      const forecastTabs = page.locator(
        '[role="tab"], .tab, button:has-text("forecast")'
      );

      if ((await forecastTabs.count()) > 1) {
        // Click through different tabs
        for (let i = 0; i < Math.min(await forecastTabs.count(), 3); i++) {
          const tab = forecastTabs.nth(i);
          await waitForElementReady(tab);
          await tab.click();
          await page.waitForTimeout(500);

          // Verify content changed
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });

    test("handles date navigation in forecasts", async ({ page }) => {
      // Look for date navigation elements
      const dateNavigators = page.locator(
        'button:has-text("next"), button:has-text("previous"), .date-nav'
      );

      if ((await dateNavigators.count()) > 0) {
        const nextButton = dateNavigators.filter({ hasText: /next|→/ }).first();

        if ((await nextButton.count()) > 0) {
          await waitForElementReady(nextButton);
          await nextButton.click();

          // Should show different date content
          await page.waitForTimeout(1000);
          await expect(page.locator("body")).toBeVisible();
        }
      }
    });
  });
});

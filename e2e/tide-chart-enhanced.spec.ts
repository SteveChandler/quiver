import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

// Beach page URL - using the correct route pattern
const BEACH_URL = "/ca/la-jolla/blacks";

/**
 * E2E tests for the tide chart on beach detail pages.
 *
 * The Tides tab renders an embedded surf terminal widget inside an iframe
 * (TradingView-based charting), NOT a Recharts SVG component.
 */
test.describe("Tide Chart", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Tide Chart' });
  });

  test.describe("Tide Chart Display", () => {
    test("shows tide chart on beach detail page", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      // Navigate to Forecast tab
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();

      // Click on Tides sub-tab
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // The tide chart heading should be visible
      await expect(page.getByRole("heading", { name: /tide forecast/i }).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("loads embedded chart with series toggles", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      // Navigate to Forecast > Tides
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // The chart is inside an iframe — access the frame content
      const chartFrame = page.frameLocator('iframe').first();

      // Verify Waves and Tide series toggle buttons exist
      await expect(chartFrame.getByRole("button", { name: /toggle waves/i })).toBeVisible({ timeout: 15000 });
      await expect(chartFrame.getByRole("button", { name: /toggle tide/i })).toBeVisible({ timeout: 15000 });
    });

    test("shows time range selector buttons", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      // Navigate to Forecast > Tides
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // The chart iframe should have time range buttons
      const chartFrame = page.frameLocator('iframe').first();
      await expect(chartFrame.getByRole("button", { name: /24H/i })).toBeVisible({ timeout: 15000 });
      await expect(chartFrame.getByRole("button", { name: /3D/i })).toBeVisible();
      await expect(chartFrame.getByRole("button", { name: /7D/i })).toBeVisible();
      await expect(chartFrame.getByRole("button", { name: /12D/i })).toBeVisible();
    });
  });

});

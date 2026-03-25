import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

// Beach page URL - using the correct route pattern (Blacks is in San Diego)
const BEACH_URL = "/ca/san-diego/blacks";

/**
 * E2E tests for the tide chart on beach detail pages.
 *
 * The Tides tab renders a Recharts SVG chart inside TideChartSection,
 * with time range tabs (Today, 3-Day, 7-Day).
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

    test("loads tide chart section with Recharts SVG", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      // Navigate to Forecast > Tides
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // The tide chart is a Recharts SVG component (not an iframe)
      const tideChartSection = page.getByTestId("tide-chart-section");
      await expect(tideChartSection).toBeVisible({ timeout: 15000 });

      // Verify the Recharts SVG container is rendered
      const svgChart = tideChartSection.locator("svg.recharts-surface");
      await expect(svgChart.first()).toBeVisible({ timeout: 15000 });
    });

    test("shows time range selector buttons", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      // Navigate to Forecast > Tides
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // Time range buttons are inside the TideChartSection (not an iframe)
      const tideChartSection = page.getByTestId("tide-chart-section");
      await expect(tideChartSection).toBeVisible({ timeout: 15000 });

      // Verify the time range tabs: Today, 3-Day, 7-Day
      await expect(tideChartSection.getByRole("tab", { name: /today/i })).toBeVisible();
      await expect(tideChartSection.getByRole("tab", { name: /3-day/i })).toBeVisible();
      await expect(tideChartSection.getByRole("tab", { name: /7-day/i })).toBeVisible();
    });
  });

});

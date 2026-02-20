import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

// Beach page URL - using the correct route pattern
const BEACH_URL = "/ca/la-jolla/blacks";

/**
 * E2E tests for the enhanced tide chart with diagnostics
 */
test.describe("Enhanced Tide Chart", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Enhanced Tide Chart' });
  });

  test.describe("Tide Chart Display", () => {
    test("shows tide chart on beach detail page", async ({ page }) => {
      // Navigate to a known beach page
      await page.goto(BEACH_URL);
      await page.waitForLoadState("networkidle");

      // Navigate to Forecast tab first
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      await page.waitForLoadState("networkidle");

      // Click on Tides sub-tab
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // The tide chart heading should be visible (use first() as there are multiple tide-related headings)
      await expect(page.getByRole("heading", { name: /tide forecast/i }).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("displays current time marker on tide chart", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("networkidle");

      // Navigate to Forecast tab first
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      await page.waitForLoadState("networkidle");

      // Click on Tides sub-tab
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // Look for "Now" marker text (shows current tide height) - use first() as it appears in both chart and table
      await expect(page.getByText(/Now.*ft/).first()).toBeVisible({ timeout: 10000 });
    });
  });

  // Note: Diagnostics panel tests are skipped until diagnostics data is passed from forecast-tab.tsx
  test.describe("Diagnostics Panel", () => {
    test.fixme("shows diagnostics panel when debug mode is enabled", async ({
      page,
    }) => {
      // TODO: Implement when feature is ready
    });

    test.fixme("expands diagnostics panel on click", async ({ page }) => {
      // TODO: Implement when feature is ready
    });

    test.fixme("shows raw data sample when expanded", async ({ page }) => {
      // TODO: Implement when feature is ready
    });

    test.fixme("shows NOAA source links", async ({ page }) => {
      // TODO: Implement when feature is ready
    });
  });

  // Note: Verification badge tests skipped until diagnostics data is passed from forecast-tab.tsx
  test.describe("Verification Badge", () => {
    test.fixme("shows verification badge in diagnostics mode", async ({ page }) => {
      // TODO: Implement when feature is ready
    });
  });

  test.describe("Hourly Table", () => {
    test("shows hourly tide table when present", async ({ page }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("networkidle");

      // Navigate to Forecast tab first
      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      await page.waitForLoadState("networkidle");

      // Click on Tides sub-tab
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      await tidesTab.click();

      // Wait for the tide table to appear
      const tideTable = page.getByTestId("tide-hourly-table");
      await expect(tideTable).toBeVisible({ timeout: 10000 });

      // Should have multiple rows
      const rows = page.getByTestId("tide-table-row");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(18); // Max 18 rows
    });
  });

  // Note: Data quality tests skipped until diagnostics data is passed from forecast-tab.tsx
  test.describe("Data Quality", () => {
    test.fixme("validates tide data accuracy", async ({ page }) => {
      // TODO: Implement when feature is ready
    });

    test.fixme("shows confidence score", async ({ page }) => {
      // TODO: Implement when feature is ready
    });
  });
});

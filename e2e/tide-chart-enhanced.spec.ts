import { test, expect } from "@playwright/test";

// Beach page URL - using the correct route pattern
const BEACH_URL = "/ca/la-jolla/blacks";

/**
 * E2E tests for the enhanced tide chart with diagnostics
 */
test.describe("Enhanced Tide Chart", () => {
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
    test.skip("shows diagnostics panel when debug mode is enabled", async ({
      page,
    }) => {
      // Navigate with tide_debug query param
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Diagnostics panel should be visible
      const diagnosticsPanel = page.getByTestId("tide-diagnostics-panel");
      await expect(diagnosticsPanel).toBeVisible({ timeout: 10000 });
    });

    test.skip("expands diagnostics panel on click", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Click on the diagnostics panel header to expand
      const panelHeader = page.getByText("NOAA CO-OPS Tide Data");
      await panelHeader.click();

      // Should show station details
      await expect(page.getByText(/Station/i)).toBeVisible();
      await expect(page.getByText(/Datum/i)).toBeVisible();
    });

    test.skip("shows raw data sample when expanded", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Expand the diagnostics panel
      const panelHeader = page.getByText("NOAA CO-OPS Tide Data");
      await panelHeader.click();

      // Should show raw data sample section
      await expect(page.getByText(/Raw Data Sample/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test.skip("shows NOAA source links", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Expand the diagnostics panel
      const panelHeader = page.getByText("NOAA CO-OPS Tide Data");
      await panelHeader.click();

      // Should show NOAA API and Station Page links
      await expect(page.getByRole("link", { name: /NOAA API/i })).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Station Page/i })
      ).toBeVisible();
    });
  });

  // Note: Verification badge tests skipped until diagnostics data is passed from forecast-tab.tsx
  test.describe("Verification Badge", () => {
    test.skip("shows verification badge in diagnostics mode", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Should show verification status (Verified, Partial, or Unverified)
      const badgeTexts = ["Verified", "Partial", "Unverified"];
      const badgeFound = await Promise.any(
        badgeTexts.map(async (text) => {
          const badge = page.getByText(text, { exact: true });
          if (await badge.isVisible()) return true;
          return false;
        })
      ).catch(() => false);

      expect(badgeFound).toBeTruthy();
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
    test.skip("validates tide data accuracy", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Expand diagnostics
      const panelHeader = page.getByText("NOAA CO-OPS Tide Data");
      await panelHeader.click();

      // Should show validation status
      const validationPassed = page.getByText(/All validation checks passed/i);
      const validationErrors = page.getByText(/Validation Errors/i);

      // Either validation passed OR errors are shown - both are valid states
      const hasValidationInfo =
        (await validationPassed.isVisible()) ||
        (await validationErrors.isVisible());
      expect(hasValidationInfo).toBeTruthy();
    });

    test.skip("shows confidence score", async ({ page }) => {
      await page.goto(`${BEACH_URL}?tide_debug=true`);
      await page.waitForLoadState("networkidle");

      // Click on Tides tab if present
      const tidesTab = page.getByRole("tab", { name: /tides/i });
      if (await tidesTab.isVisible()) {
        await tidesTab.click();
      }

      // Look for percentage indicator (confidence score)
      const confidenceIndicator = page.locator("text=/%/");
      await expect(confidenceIndicator.first()).toBeVisible({ timeout: 5000 });
    });
  });
});

import { test, expect } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from "./utils/error-detection";

// Beach page URL matching the reported tide chart issue.
const BEACH_URL = "/ca/san-diego/ocean-beach-pier";

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
      await expect(
        page.getByRole("heading", { name: /tide forecast/i }).first()
      ).toBeVisible({
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
      await expect(
        tideChartSection.getByRole("tab", { name: /today/i })
      ).toBeVisible();
      await expect(
        tideChartSection.getByRole("tab", { name: /3-day/i })
      ).toBeVisible();
      await expect(
        tideChartSection.getByRole("tab", { name: /7-day/i })
      ).toBeVisible();
    });

    test("3-day tide curve spans the chart instead of truncating after the first cycle", async ({
      page,
    }) => {
      await page.goto(BEACH_URL);
      await page.waitForLoadState("load");

      const forecastTab = page.getByRole("tab", { name: /forecast/i });
      await forecastTab.click();
      const tidesTab = page.getByRole("tab", { name: /^tides$/i });
      await tidesTab.click();

      const tideChartSection = page.getByTestId("tide-chart-section");
      await expect(tideChartSection).toBeVisible({ timeout: 15000 });
      await tideChartSection.getByRole("tab", { name: /3-day/i }).click();

      const svgChart = tideChartSection.locator("svg.recharts-surface");
      await expect(svgChart.first()).toBeVisible({ timeout: 15000 });

      const coverage = await tideChartSection.evaluate((section) => {
        const svg = section.querySelector("svg.recharts-surface");
        const curve = section.querySelector("path.recharts-area-curve");
        const viewBox = svg?.getAttribute("viewBox") ?? "";
        const width = Number(viewBox.trim().split(/\s+/)[2]);
        const pathData = curve?.getAttribute("d") ?? "";
        const coords = Array.from(pathData.matchAll(/[MLC]([^MLC]+)/g))
          .flatMap((match) => match[1].trim().split(/[,\s]+/).map(Number))
          .filter(Number.isFinite);
        const xValues = coords.filter((_, index) => index % 2 === 0);
        const maxX = xValues.length ? Math.max(...xValues) : 0;

        return { maxX, width, pathDataLength: pathData.length };
      });

      expect(coverage.pathDataLength).toBeGreaterThan(1000);
      expect(coverage.width).toBeGreaterThan(0);
      expect(coverage.maxX / coverage.width).toBeGreaterThan(0.9);
    });
  });
});

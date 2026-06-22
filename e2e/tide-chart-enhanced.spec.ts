import { test, expect } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  ErrorCapture,
} from "./utils/error-detection";
import {
  createLocalAdminClient,
  getLocalBeachBySlug,
  isLocalE2ETarget,
} from "./utils/local-supabase-fixtures";

// Beach page URL matching the reported tide chart issue.
const BEACH_URL = "/ca/san-diego/ocean-beach-pier";
const HOUR_MS = 60 * 60 * 1000;

type TideScheduleEntry = {
  height: number;
  time: number;
  type: "high" | "low";
};

function formatForecastTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

function buildTideSchedule(anchor: Date): TideScheduleEntry[] {
  return Array.from({ length: 28 }, (_, index) => {
    const isHigh = index % 2 === 0;
    const date = new Date(anchor.getTime() + (index * 6 - 12) * HOUR_MS);
    const cycle = Math.floor(index / 2);

    return {
      height: isHigh ? 4.2 + (cycle % 3) * 0.3 : 0.4 + (cycle % 2) * 0.2,
      time: Math.floor(date.getTime() / 1000),
      type: isHigh ? "high" : "low",
    };
  });
}

function tideHeightForIndex(index: number): string {
  const height = 2.4 + Math.sin(index / 2) * 1.3;
  return `${height.toFixed(1)} ft`;
}

async function ensureLocalOceanBeachTideFixture(): Promise<void> {
  if (!isLocalE2ETarget()) return;

  const admin = createLocalAdminClient();
  const beach = await getLocalBeachBySlug("ocean-beach-pier");
  const { data: rows, error } = await admin
    .from("enhanced_forecasts")
    .select("id,raw_forecast")
    .eq("beach_id", beach.id)
    .order("forecast_at", { ascending: true })
    .limit(80);

  if (error) throw error;
  if (!rows || rows.length < 24) {
    throw new Error("Ocean Beach Pier local forecast fixture is too sparse");
  }

  const anchor = new Date();
  anchor.setUTCMinutes(0, 0, 0);
  const tideSchedule = buildTideSchedule(anchor);

  for (let index = 0; index < rows.length; index += 1) {
    const temporaryDate = new Date(Date.UTC(2040, 0, 1, index * 3));
    const { error: temporaryError } = await admin
      .from("enhanced_forecasts")
      .update({
        forecast_at: temporaryDate.toISOString(),
        forecast_date: temporaryDate.toISOString().slice(0, 10),
        forecast_time: formatForecastTime(temporaryDate),
      })
      .eq("id", rows[index].id);

    if (temporaryError) throw temporaryError;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as {
      id: string;
      raw_forecast: Record<string, unknown> | null;
    };
    const forecastDate = new Date(anchor.getTime() + (index - 4) * 3 * HOUR_MS);
    const nextTide =
      tideSchedule.find((entry) => entry.time * 1000 > forecastDate.getTime()) ??
      tideSchedule[tideSchedule.length - 1];
    const nextTideDate = new Date(nextTide.time * 1000);
    const { error: updateError } = await admin
      .from("enhanced_forecasts")
      .update({
        forecast_at: forecastDate.toISOString(),
        forecast_date: forecastDate.toISOString().slice(0, 10),
        forecast_time: formatForecastTime(forecastDate),
        next_tide_at: nextTideDate.toISOString(),
        next_tide_height: `${nextTide.height.toFixed(1)} ft`,
        next_tide_type: nextTide.type === "high" ? "High" : "Low",
        raw_forecast: {
          ...(row.raw_forecast ?? {}),
          tide_schedule: tideSchedule,
        },
        tide_height: tideHeightForIndex(index),
        tide_status: index % 4 < 2 ? "Rising" : "Falling",
      })
      .eq("id", row.id);

    if (updateError) throw updateError;
  }
}

/**
 * E2E tests for the tide chart on beach detail pages.
 *
 * The Tides tab renders a Recharts SVG chart inside TideChartSection,
 * with time range tabs (Today, 3-Day, 7-Day).
 */
test.describe("Tide Chart", () => {
  let errorCapture: ErrorCapture;

  test.beforeAll(async () => {
    await ensureLocalOceanBeachTideFixture();
  });

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

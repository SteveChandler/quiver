import { expect, test, type Page } from "@playwright/test";

import { TEST_BEACHES, TIMEOUTS } from "./fixtures/test-data";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import {
  createLocalAdminClient,
  getLocalBeachBySlug,
  isLocalE2ETarget,
} from "./utils/local-supabase-fixtures";
import { navigateToBeach, waitForPageLoad } from "./utils/test-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

const PILOT_VIEWPORTS = [
  { name: "360px", width: 360, height: 900 },
  { name: "390px", width: 390, height: 900 },
  { name: "412px", width: 412, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
];
const HOUR_MS = 60 * 60 * 1000;

function formatForecastTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

async function ensureLocalBlacksPilotForecasts(): Promise<void> {
  if (!isLocalE2ETarget()) return;

  const admin = createLocalAdminClient();
  const beach = await getLocalBeachBySlug(TEST_BEACHES.blacks.slug);
  const anchor = new Date();
  anchor.setUTCMinutes(0, 0, 0);

  const rows = Array.from({ length: 12 }, (_, index) => {
    const forecastDate = new Date(anchor.getTime() + (index - 2) * 3 * HOUR_MS);
    return {
      beach_id: beach.id,
      confidence_score: 82,
      data_source: "e2e_session_intelligence_fixture",
      forecast_at: forecastDate.toISOString(),
      forecast_date: forecastDate.toISOString().slice(0, 10),
      forecast_time: formatForecastTime(forecastDate),
      raw_forecast: {},
      tide_height: "2.8 ft",
      tide_status: index % 2 === 0 ? "Rising" : "Falling",
      updated_at: anchor.toISOString(),
      wave_height: `${3 + (index % 3)} ft`,
      wave_period: "12s",
      wind_direction: "E",
      wind_direction_deg: 90,
      wind_speed: "5 mph",
    };
  });

  const { error: upsertError } = await admin
    .from("enhanced_forecasts")
    .upsert(rows, { onConflict: "beach_id,forecast_at" });

  if (upsertError) throw upsertError;

  const { data: fixtureRows, error: refetchError } = await admin
    .from("enhanced_forecasts")
    .select("id")
    .eq("beach_id", beach.id)
    .eq("data_source", "e2e_session_intelligence_fixture")
    .gte("forecast_at", new Date(anchor.getTime() - 6 * HOUR_MS).toISOString())
    .order("forecast_at", { ascending: true })
    .limit(12);

  if (refetchError) throw refetchError;
  if (!fixtureRows || fixtureRows.length < 12) {
    throw new Error("Blacks local session-intelligence forecast fixture setup failed");
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
}

async function openFirstWhyThisCall(page: Page): Promise<void> {
  await page.getByRole("button", { name: /why this call/i }).first().click();
  await expect(page.getByRole("heading", { name: "Positive signals" }).first()).toBeVisible({
    timeout: TIMEOUTS.medium,
  });
}

test.describe("Guest Session Intelligence pilot surfaces", () => {
  let errorCapture: ErrorCapture;

  test.beforeAll(async () => {
    await ensureLocalBlacksPilotForecasts();
  });

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Guest Session Intelligence pilot surfaces",
    });
  });

  for (const viewport of PILOT_VIEWPORTS) {
    test(`spot pilot preserves beach tabs at ${viewport.name} @requires-data`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await navigateToBeach(page, TEST_BEACHES.blacks);
      await page.waitForLoadState("load");

      const pilot = page.getByTestId("session-intelligence-pilot");
      await expect(pilot).toBeVisible({ timeout: TIMEOUTS.long });
      await expect(page.getByRole("heading", { name: /best surf windows at/i })).toBeVisible();

      const cards = page.getByTestId("surf-window-card");
      await expect(cards.first()).toBeVisible({ timeout: TIMEOUTS.long });
      expect(await cards.count()).toBeLessThanOrEqual(3);

      await expect(page.getByTestId("app-deep-link-cta").first()).toHaveAttribute(
        "href",
        /\/app\/spot\/.+window=/
      );
      await openFirstWhyThisCall(page);

      await expect(page.getByRole("tab", { name: /^forecast$/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /reviews/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /local intel/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /sessions/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`regional pilot preserves seven-day outlook at ${viewport.name} @requires-data`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/forecast?region=southern-california");
      await waitForPageLoad(page);

      const bestWindows = page.getByTestId("regional-best-surf-windows");
      await expect(bestWindows).toBeVisible({ timeout: TIMEOUTS.long });
      await expect(
        bestWindows.getByRole("heading", { name: /best windows this week/i })
      ).toBeVisible();

      const cards = bestWindows.getByTestId("surf-window-card");
      await expect(cards.first()).toBeVisible({ timeout: TIMEOUTS.long });
      expect(await cards.count()).toBeLessThanOrEqual(5);

      await expect(bestWindows.getByTestId("app-deep-link-cta").first()).toHaveAttribute(
        "href",
        /\/app\/spot\/.+window=/
      );
      await openFirstWhyThisCall(page);

      const outlook = page.getByTestId("seven-day-outlook");
      await expect(outlook).toBeVisible({ timeout: TIMEOUTS.long });
      await expect(
        outlook.getByRole("heading", { name: /7-Day.*Outlook/i })
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

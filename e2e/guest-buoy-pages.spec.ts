/**
 * Public buoy pages: one station page and one hub.
 *
 * Needs the wave-station catalogue migration
 * (20261110200000_wave_station_catalogue.sql) applied and the sync cron run at
 * least once against the target database. Locally it also runs against the
 * fixture source: `BUOY_PAGES_FIXTURES=1 next dev`.
 *
 * @project guest
 */

import { expect, test } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const STATION_PATH = "/buoys/station/torrey-pines-outer-ca-46225";

test.describe("Buoy pages", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  test("station page shows the reading, honest labels and attribution", async ({ page }) => {
    const response = await page.goto(STATION_PATH);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Torrey Pines Outer/i);
    await expect(page.getByTestId("buoy-status-chip")).toHaveAttribute("data-status", /^(fresh|stale|offline)$/);
    await expect(page.getByText("Significant wave height at the buoy")).toBeVisible();
    await expect(page.getByText(/not surf height at a beach/i).first()).toBeVisible();
    await expect(page.getByTestId("buoy-attribution")).toContainText("NOAA National Data Buoy Center");
    await expect(page.getByTestId("buoy-not-for-navigation")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${STATION_PATH}$`));

    const chart = page.getByTestId("buoy-trend-chart");
    await expect(chart).toBeVisible();
    await chart.getByRole("button", { name: "24 h" }).click();
    await expect(chart.getByRole("button", { name: "24 h" })).toHaveAttribute("aria-pressed", "true");
  });

  test("legacy ids redirect to the canonical station URL", async ({ request }) => {
    for (const legacy of ["/buoys/station/46225", "/buoys/station/100", "/buoys/46225"]) {
      const response = await request.get(legacy, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers().location).toMatch(new RegExp(`${STATION_PATH}$`));
    }
  });

  test("unknown stations and countries are real 404s", async ({ request }) => {
    expect((await request.get("/buoys/station/no-such-buoy-00000")).status()).toBe(404);
    expect((await request.get("/buoys/zz")).status()).toBe(404);
  });

  test("country hub lists California buoys with freshness", async ({ page }) => {
    const response = await page.goto("/buoys/us");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/United States wave buoys/i);
    await expect(page.getByRole("link", { name: "California" })).toHaveAttribute("href", "/buoys/us/ca");
    const torrey = page.getByTestId("buoy-hub-station").filter({ hasText: "Torrey Pines Outer" });
    await expect(torrey).toContainText(/Live|Stale|Offline/);
    await torrey.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${STATION_PATH}$`));
  });
});

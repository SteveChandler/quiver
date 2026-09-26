/**
 * Buoy-record season pages: evidence renders in server HTML, photos are credited,
 * and the legacy state-profile sections are gone for buoy-backed cities.
 *
 * @project guest
 */
import { test, expect, type Page } from "@playwright/test";

import { assertNoErrors, setupErrorDetection, type ErrorCapture } from "./utils/error-detection";

/** No-op for pages with no page-specific checks beyond the shared assertions below. */
async function noExtraChecks(_page: Page): Promise<void> {}

/** Newport drops the state-profile "Peak" label and explains its summer-heavy season. */
async function newportExtraChecks(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Why Newport's best days still come in summer" }),
  ).toBeVisible();
  await expect(page.getByRole("table").getByText("Peak")).toHaveCount(0);
}

const PAGES = [
  {
    path: "/best-time-to-surf/cocoa-beach",
    station: "NOAA NDBC station 41113",
    credit: /Rusty Clark/,
    extraChecks: noExtraChecks,
  },
  {
    path: "/best-time-to-surf/newport-beach",
    station: "NOAA NDBC station 46253",
    credit: /Don Ramey Logan/,
    extraChecks: newportExtraChecks,
  },
] as const;

test.describe("best-time buoy record", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  for (const target of PAGES) {
    test(`${target.path} serves the buoy record in its HTML`, async ({ page, request }) => {
      const response = await request.get(target.path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(target.station);
      expect(html).toContain("How the buoy score works");
      expect(html).not.toContain("Dawn Patrol vs Afternoon Sessions");
      expect(html).toMatch(/aria-label="Score: \d+[^"]*"/);
      expect(html).not.toMatch(/aria-label="Score: \d+[^"]*"[^>]*>0<\/span>/);

      await page.goto(target.path);
      await expect(page.getByRole("heading", { name: "Month by month at the buoy" })).toBeVisible();
      await expect(page.getByText(target.credit).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Download the monthly numbers (CSV)" })).toHaveAttribute(
        "href",
        /\/data\/surf-climatology\/.+\.csv$/,
      );

      await target.extraChecks(page);
    });
  }

  test("the CSV downloads with its source header", async ({ request }) => {
    const response = await request.get("/data/surf-climatology/cocoa-beach.csv");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("not surf height at the beach");
  });

  test("Honolulu no longer shows North Shore winter text", async ({ request }) => {
    const response = await request.get("/best-time-to-surf/honolulu");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("Pipe Masters");
    expect(html).toContain("NOAA NDBC station 51211");
  });
});

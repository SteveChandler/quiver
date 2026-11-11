/**
 * Public tide station pages (/tides/station/{slug}) and hubs (/tides/...).
 *
 * Needs migration 20261110200000_create_tide_stations.sql applied and the
 * registry seeded (scripts/tides/seed-tide-stations.ts). Before that, every
 * /tides URL is a real 404 and these tests fail by design.
 */
import { expect, test } from "@playwright/test";
import { assertNoErrors, type ErrorCapture, setupErrorDetection } from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const LA_JOLLA = "/tides/station/la-jolla-scripps-institution-wharf-ca-9410230";

test.describe("Tide station pages", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    // Page analytics are not under test here.
    await page.route("**/api/events", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }),
    );
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Tide station pages" });
  });

  test("NOAA station page shows tides in local time with credit and canonical", async ({ page }) => {
    const response = await page.goto(LA_JOLLA, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1, name: /La Jolla tides/i })).toBeVisible();
    await expect(page.getByTestId("tide-station-now")).toContainText(/Rising|Falling/);
    await expect(page.getByTestId("tide-week-table").locator("tbody tr")).toHaveCount(7);
    await expect(page.getByTestId("tide-week-table")).toContainText(/\d{1,2}:\d{2} (AM|PM)/);
    await expect(page.getByTestId("tide-station-curve")).toBeVisible();
    await expect(page.getByText("America/Los_Angeles", { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId("tide-station-credit")).toContainText("NOAA CO-OPS");
    await expect(page.getByTestId("tide-station-credit")).toContainText("Not for navigation");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${LA_JOLLA}$`));
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

    const nearbyBeach = page.getByRole("link", { name: /surf forecast/i }).first();
    await expect(nearbyBeach).toHaveAttribute("href", /^\/ca\//);
  });

  test("US state hub lists the station and links to it", async ({ page }) => {
    const response = await page.goto("/tides/usa/ca", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /California tide times/i })).toBeVisible();
    const link = page.getByTestId("tide-hub-list").locator(`a[href="${LA_JOLLA}"]`);
    await expect(link).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("United States");
  });

  test("unknown station and unknown country return 404", async ({ request }) => {
    expect((await request.get("/tides/station/not-a-real-station-0000000")).status()).toBe(404);
    expect((await request.get("/tides/atlantis")).status()).toBe(404);
    expect((await request.get("/tides/japan/tokyo")).status()).toBe(404);
  });
});

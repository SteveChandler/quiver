import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  createMajorEventBulkForecastFixture,
  type MajorEventHoldFixturePhase,
} from "./fixtures/major-event-recommendation-hold";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import { dismissMapEntryOverlay } from "./utils/map-helpers";

const BULK_FORECAST_URL_FRAGMENT = "/api/forecasts/bulk";
const OBJECTIVE_SWELL_LABEL = "3.5ft, 14s";

// Beach discovery on /map is a Next server action and is intentionally left
// intact. The mocked browser boundary starts at the already-sanitized bulk
// response, while focused API tests own evaluator/adapter enforcement.

async function navigateAndWaitForBulkForecast(page: Page): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(BULK_FORECAST_URL_FRAGMENT) &&
      candidate.status() === 200,
  );
  await page.goto("/map?search=Waikiki", {
    waitUntil: "domcontentloaded",
  });
  await response;
  await dismissMapEntryOverlay(page);
}

async function reloadAndWaitForBulkForecast(page: Page): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(BULK_FORECAST_URL_FRAGMENT) &&
      candidate.status() === 200,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await response;
  await dismissMapEntryOverlay(page);
}

interface OpenMapConditionsResult {
  markerButton: Locator;
  objectiveSwell: Locator;
}

async function openWaikikiConditions(
  page: Page,
): Promise<OpenMapConditionsResult> {
  const markerButton = page
    .getByRole("button", { name: /View Waikiki.* conditions/i })
    .first();
  await expect(markerButton).toBeVisible({ timeout: 30_000 });
  await markerButton.click();

  const callout = page.locator('[data-conditions-callout="true"]');
  await expect(callout).toBeVisible({ timeout: 10_000 });
  const objectiveSwell = callout.locator(
    '[data-callout-banner="s1"][data-callout-label]',
  );
  await expect(objectiveSwell).toHaveAttribute(
    "data-callout-label",
    OBJECTIVE_SWELL_LABEL,
  );
  await expect(
    callout.getByText(OBJECTIVE_SWELL_LABEL, { exact: true }),
  ).toBeVisible();

  return { markerButton, objectiveSwell };
}

async function expectAvailableMarker(page: Page): Promise<string> {
  const { markerButton, objectiveSwell } = await openWaikikiConditions(page);
  const marker = page.getByTestId("beach-marker").filter({ has: markerButton });

  await expect(marker).toHaveAttribute("data-condition-summary", "GOOD");
  await expect(marker).toHaveAttribute("data-condition-score", "91");
  return (await objectiveSwell.getAttribute("data-callout-label")) ?? "";
}

async function expectHeldMarker(page: Page): Promise<string> {
  const { markerButton, objectiveSwell } = await openWaikikiConditions(page);
  const marker = page.getByTestId("beach-marker").filter({ has: markerButton });

  await expect(marker).toHaveAttribute("data-condition-summary", "UNKNOWN");
  await expect(marker).not.toHaveAttribute("data-condition-score", /.+/);
  await expect(
    page.locator('[data-testid="beach-marker"][data-condition-score]'),
  ).toHaveCount(0);
  return (await objectiveSwell.getAttribute("data-callout-label")) ?? "";
}

test.describe("guest map major-event recommendation hold", () => {
  let errorCapture: ErrorCapture;
  let phase: MajorEventHoldFixturePhase;
  let servedPhases: MajorEventHoldFixturePhase[];

  test.beforeEach(async ({ page, context }) => {
    errorCapture = setupErrorDetection(page);
    phase = "available";
    servedPhases = [];

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 21.2767, longitude: -157.8263 });

    await page.route("**/rest/v1/custom_spots**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "*/0" },
        body: "[]",
      });
    });
    await page.route("**/api/forecasts/bulk?*", async (route) => {
      const requestPhase = phase;
      const url = new URL(route.request().url());
      const beachIds = (url.searchParams.get("beachIds") ?? "")
        .split(",")
        .filter(Boolean);
      servedPhases.push(requestPhase);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          createMajorEventBulkForecastFixture(beachIds, requestPhase),
        ),
      });
    });
    await page.route("**/api/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { ok: true, skipped: true, status: "tracking_disabled" },
        }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    try {
      await assertNoErrors(page, errorCapture, {
        context: "Guest map major-event recommendation hold",
      });
    } finally {
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test("held bulk state removes the prior positive while preserving objective height until cancellation", async ({
    page,
  }) => {
    await navigateAndWaitForBulkForecast(page);
    const beforeHoldHeight = await expectAvailableMarker(page);

    phase = "held";
    await reloadAndWaitForBulkForecast(page);
    const heldHeight = await expectHeldMarker(page);
    expect(heldHeight).toBe(beforeHoldHeight);

    phase = "cancelled";
    await reloadAndWaitForBulkForecast(page);
    const cancelledHeight = await expectAvailableMarker(page);
    expect(cancelledHeight).toBe(beforeHoldHeight);

    expect(servedPhases).toEqual(
      expect.arrayContaining(["available", "held", "cancelled"]),
    );
  });
});

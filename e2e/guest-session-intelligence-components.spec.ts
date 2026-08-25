import { expect, test } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const viewports = [
  { name: "360px", width: 360, height: 900 },
  { name: "390px", width: 390, height: 900 },
  { name: "412px", width: 412, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
];

test.describe("Guest Session Intelligence component preview", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page, request }) => {
    errorCapture = setupErrorDetection(page);
    // /dev/session-intelligence-preview is gated off (notFound → 404) in
    // production. Probe through the request fixture (not the page, so the 404
    // isn't recorded by error detection) and skip when an external run targets
    // production; local E2E uses VERCEL_ENV="preview" and exercises the route.
    const probe = await request.get("/dev/session-intelligence-preview");
    // eslint-disable-next-line playwright/no-skipped-test -- production intentionally excludes this preview-only route.
    test.skip(
      probe.status() === 404,
      "Dev preview route disabled in production.",
    );
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Session Intelligence component preview",
    });
  });

  for (const viewport of viewports) {
    test(`renders reusable best-window cards at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const response = await page.goto("/dev/session-intelligence-preview", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load");

      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Session Intelligence components" })
      ).toBeVisible();
      await expect(page.getByTestId("surf-window-card")).toHaveCount(3);

      const cards = page.getByTestId("surf-window-card");
      const firstCard = cards.nth(0);
      const thirdCard = cards.nth(2);

      await expect(firstCard).toContainText("#1");
      await expect(firstCard).toContainText("7:00-9:30 AM");
      await expect(
        firstCard.getByRole("link", { name: "Ocean Beach", exact: true })
      ).toBeVisible();
      await expect(firstCard).not.toContainText("7:00-9:30 AM looks worth it at Ocean Beach");
      await expect(firstCard).toContainText("Worth it");
      await expect(firstCard).not.toContainText("High - buoy + model");
      await expect(firstCard.getByAltText("Surf photo of Ocean Beach")).toHaveAttribute(
        "src",
        /OceanBeachSurfers\.jpg/
      );
      await expect(firstCard.getByAltText(/map view/i)).toHaveCount(0);
      await expect(firstCard).toContainText("Wave");
      await expect(firstCard).toContainText("4 ft at 12s from W");
      await expect(firstCard).toContainText("Wind");
      await expect(firstCard).toContainText("5 NE (offshore)");
      await expect(firstCard).toContainText("Tide");
      await expect(firstCard).toContainText("Rising, 3.5 ft");
      await expect(firstCard).toContainText("intermediate");
      await expect(firstCard).toContainText("longboard");
      await expect(firstCard).toContainText("dawn-patrol");

      await expect(thirdCard).toContainText("#3");
      await expect(thirdCard).toContainText("10:00 AM-12:00 PM");
      await expect(thirdCard).toContainText("Maybe");
      await expect(thirdCard).not.toContainText("Low - sparse data");
      await expect(thirdCard).toContainText("Wave data is sparse");
      await expect(thirdCard).not.toContainText("Tide data is unavailable");
      await expect(
        thirdCard.getByRole("link", { name: "View Preview Beach 3 forecast" })
      ).toBeVisible();

      await expect(
        page.getByRole("link", { name: "Open this beach in Quiver" }).first()
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /why this call/i })).toHaveCount(1);

      await page
        .getByRole("button", {
          name: "Why this call for Ocean Beach 7:00-9:30 AM",
        })
        .click();
      await expect(firstCard.getByRole("heading", { name: "Positive signals" })).toBeVisible();
      await expect(firstCard).toContainText("Forecast model row is present");
      await expect(firstCard).toContainText("Sources present");
      await expect(firstCard).toContainText("model");

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  }
});

import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
}

test.describe("Guest forecast accuracy trust page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Guest forecast accuracy trust page",
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`renders a non-empty trust page on ${viewport.name} @requires-data`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      const response = await page.goto("/forecast-accuracy", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load");

      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      await expect(
        page.getByRole("heading", {
          name: "The forecast that learns what you like.",
        })
      ).toBeVisible();
      await expect(page.getByText(/NOAA baseline/i).first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Three checks, then a plain score." })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "More accurate than Surfline. Twice as sharp as NOAA.",
        })
      ).toBeVisible();
      await expect(page.getByText("WINNER")).toBeVisible();
      await expect(
        page.getByRole("img", {
          name: "Quiver mean absolute error 0.30m",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("img", {
          name: "Surfline mean absolute error 0.35m",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("img", {
          name: "NOAA mean absolute error 0.67m",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Tighter than Surfline. 100% good sessions at three breaks.",
        })
      ).toBeVisible();
      await expect(page.getByText("Ala Moana Bowls")).toBeVisible();
      await expect(page.getByText("Malibu First Point")).toBeVisible();
      await expect(page.getByText("Terramar Point")).toBeVisible();
      await expect(page.getByText(/Saved Quiver session ratings/i)).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const jsonLdCount = await page
        .locator('script[type="application/ld+json"]')
        .count();
      expect(jsonLdCount).toBeGreaterThan(0);

      await expect(
        page.getByRole("region", {
          name: "Forecast accuracy metrics building",
        })
      ).toHaveCount(0);
      await expect(page.getByText(/Validated pairs/i)).toHaveCount(0);
      await expect(page.getByText(/Quiver MAE/i)).toHaveCount(0);
    });
  }
});

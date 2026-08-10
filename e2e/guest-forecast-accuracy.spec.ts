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
          name: "How to judge a surf forecast.",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Measure the same thing on the same sample.",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Offshore wave height is not breaking face height.",
        })
      ).toBeVisible();
      await expect(
        page.getByText("No same-sample comparison. No accuracy ranking.")
      ).toBeVisible();
      await expect(page.getByText("WINNER")).toHaveCount(0);
      await expect(page.getByText(/0\.(30|35|67)m/)).toHaveCount(0);
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

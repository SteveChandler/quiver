import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import { isVisibleSafe } from "./utils/strict-helpers";

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
      await expectNoHorizontalOverflow(page);

      const jsonLdCount = await page
        .locator('script[type="application/ld+json"]')
        .count();
      expect(jsonLdCount).toBeGreaterThan(0);

      const buildingPanel = page.getByRole("region", {
        name: "Forecast accuracy metrics building",
      });
      const hasBuildingPanel = await isVisibleSafe(buildingPanel, {
        timeout: 2_000,
      });

      // eslint-disable-next-line playwright/no-conditional-in-test -- Live accuracy data can legitimately be present or building depending on local/prod metric freshness.
      if (hasBuildingPanel) {
        await expect(
          page.getByRole("heading", {
            name: "Accuracy rows are being verified.",
          })
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Accuracy lift claim" })
        ).toBeVisible();
        await expect(
          page.getByText(/better in the latest buoy check/i)
        ).toHaveCount(0);
      } else {
        await expect(page.getByText(/Validated pairs/i).first()).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: "Top Beaches by Accuracy Improvement",
          })
        ).toBeVisible();
        await expect(page.getByText(/Quiver MAE/i).first()).toBeVisible();
        await expect(
          page
            .getByText(
              /High - buoy \+ model|Medium - buoy \+ model|Low - sparse data|Model only/i
            )
            .first()
        ).toBeVisible();
      }
    });
  }
});

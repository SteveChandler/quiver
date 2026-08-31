import { expect, test, type Page } from "@playwright/test";

import { TIMEOUTS } from "./fixtures/test-data";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import { waitForPageLoad } from "./utils/test-helpers";

test.use({ storageState: { cookies: [], origins: [] } });

const PILOT_VIEWPORTS = [
  { name: "360px", width: 360, height: 900 },
  { name: "390px", width: 390, height: 900 },
  { name: "412px", width: 412, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
];
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

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Guest Session Intelligence pilot surfaces",
    });
  });

  for (const viewport of PILOT_VIEWPORTS) {
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

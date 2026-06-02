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

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
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
      await expect(
        page.getByRole("link", { name: "Open this window in Quiver" }).first()
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /why this call/i }).first()).toBeVisible();

      await page.getByRole("button", { name: /why this call/i }).first().click();
      await expect(page.getByRole("heading", { name: "Positive signals" }).first()).toBeVisible();
      await expect(page.getByText("Tide data is unavailable")).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  }
});

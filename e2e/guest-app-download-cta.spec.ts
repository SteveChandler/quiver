/**
 * Regression: the app-first landing's primary "Get the app" CTA links to
 * /download. That route ships in the same redesign, so a promotion that brings
 * the landing but not /download leaves a visible-but-dead link that 404s on
 * click. A plain visibility assertion (see guest-landing.spec.ts) does NOT
 * catch this — only clicking through and confirming the destination loads does.
 */
import { expect, test } from "@playwright/test";
import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Guest landing → /download CTA", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Guest landing to download CTA",
    });
  });

  test("the landing 'Get the app' CTA navigates to a working /download page @smoke", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The field-guide hero CTA — the link whose destination is /download
    // (the navbar/App Store CTAs go to apps.apple.com, not an internal route).
    const cta = page.locator('a[href^="/download"]').first();
    await expect(cta).toBeVisible();

    await cta.click();

    await page.waitForURL(/\/download/, {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("download-view")).toBeVisible();
  });
});

/**
 * Android beta landing page validation.
 *
 * @project guest
 */

import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_LANDING_URL,
} from "@/lib/constants/app-store";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Android beta page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "android beta page",
    });
  });

  test("renders the group-gated beta instructions and QR", async ({ page }) => {
    await page.goto("/android-beta");
    await page.waitForLoadState("load");

    await expect(
      page.getByRole("heading", { name: /join the quiver android beta/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/the closed-test install link is not public on this page yet/i),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /join the tester group/i }),
    ).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    await expect(
      page.getByRole("link", {
        name: new RegExp(`email ${ANDROID_BETA_CONTACT_EMAIL}`, "i"),
      }),
    ).toHaveAttribute("href", ANDROID_BETA_CONTACT_MAILTO);

    const qr = page.getByTestId("android-beta-qr");
    await expect(qr).toBeVisible();
    const qrScreenshot = await qr.screenshot();
    const qrPng = PNG.sync.read(qrScreenshot);
    const decoded = jsQR(
      new Uint8ClampedArray(qrPng.data),
      qrPng.width,
      qrPng.height,
    );
    expect(decoded?.data).toBe(ANDROID_BETA_LANDING_URL);

    await expect(page.getByText(/testflight/i)).toHaveCount(0);
    await expect(page.getByText(/join the ios beta/i)).toHaveCount(0);
  });
});

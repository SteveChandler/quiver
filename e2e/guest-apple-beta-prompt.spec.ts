/**
 * Apple Sign-In iOS Beta Prompt
 *
 * Browser-level guard for the prompt markup used after Apple OAuth.
 *
 * @project guest
 */

import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import {
  APPLE_BETA_PROMPT_BODY_COPY,
} from "@/components/app-store/apple-beta-prompt";
import {
  IOS_TESTFLIGHT_BETA_CTA,
  IOS_TESTFLIGHT_BETA_URL,
} from "@/lib/constants/app-store";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Apple beta prompt", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "apple beta prompt",
    });
  });

  test("desktop renders the branded QR handoff", async ({ page }) => {
    await page.goto("/e2e/apple-beta-prompt");
    await page.waitForLoadState("load");

    const dialog = page.getByRole("dialog", {
      name: /get quiver on your iphone/i,
    });

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(APPLE_BETA_PROMPT_BODY_COPY)).toBeVisible();
    await expect(dialog.getByText("Scan with your iPhone camera")).toBeVisible();

    const qr = dialog.getByTestId("apple-beta-prompt-qr");
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("width", "228");
    await expect(qr).toHaveAttribute("height", "228");
    const logo = qr.locator('image[href="/quiver-app-icon-128.png"]');
    await expect(logo).toHaveCount(1);
    const logoPixels = await qr.evaluate((svg) => {
      const image = svg.querySelector("image");
      if (!image) return null;
      const viewBoxWidth = svg.viewBox.baseVal.width;
      const viewBoxHeight = svg.viewBox.baseVal.height;
      const bounds = svg.getBoundingClientRect();
      return {
        width:
          (Number(image.getAttribute("width")) / viewBoxWidth) * bounds.width,
        height:
          (Number(image.getAttribute("height")) / viewBoxHeight) * bounds.height,
      };
    });
    expect(Math.round(logoPixels?.width ?? 0)).toBe(32);
    expect(Math.round(logoPixels?.height ?? 0)).toBe(32);

    const qrScreenshot = await qr.screenshot();
    const qrPng = PNG.sync.read(qrScreenshot);
    const decoded = jsQR(
      new Uint8ClampedArray(qrPng.data),
      qrPng.width,
      qrPng.height
    );
    expect(decoded?.data).toBe(IOS_TESTFLIGHT_BETA_URL);

    await expect(
      dialog.getByRole("button", { name: /copy beta link/i })
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /not now/i })).toBeVisible();

    await dialog.getByRole("button", { name: /copy beta link/i }).click();
    await expect(page.getByTestId("apple-beta-prompt-last-action")).toHaveText(
      "copy"
    );
  });

  test("iPhone mode links directly to TestFlight with the session CTA", async ({
    page,
  }) => {
    await page.goto("/e2e/apple-beta-prompt?mode=ios");
    await page.waitForLoadState("load");

    const dialog = page.getByRole("dialog", {
      name: /get quiver on your iphone/i,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(APPLE_BETA_PROMPT_BODY_COPY)).toBeVisible();
    await expect(dialog.getByTestId("apple-beta-prompt-qr")).toHaveCount(0);

    const testFlightLink = dialog.getByRole("link", {
      name: IOS_TESTFLIGHT_BETA_CTA,
    });
    await expect(testFlightLink).toBeVisible();
    await expect(testFlightLink).toHaveAttribute(
      "href",
      IOS_TESTFLIGHT_BETA_URL
    );
    await expect(dialog.getByRole("button", { name: /not now/i })).toBeVisible();
  });
});

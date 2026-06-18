/**
 * Guest Download Page Tests
 *
 * Public /download zine marketing page.
 *
 * @project guest
 */

import { expect, test } from "@playwright/test";

import {
  assertNoErrors,
  gotoWithErrorCheck,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Guest Download Page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, "/download");
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "download page" });
  });

  test("renders the download page for guests @smoke", async ({ page }) => {
    expect(page.url()).toContain("/download");
    await expect(page.getByTestId("download-view")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /get quiver for your phone/i }),
    ).toBeVisible();
  });

  test("exposes an app-download CTA", async ({ page }) => {
    await expect(page.getByTestId("store-download-buttons").first()).toBeVisible();
  });

  test("exposes the Surfline comparison path", async ({ page }) => {
    await expect(
      page.getByTestId("store-download-compare-link").first(),
    ).toHaveAttribute("href", "/vs/surfline");
  });
});

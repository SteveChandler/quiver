import { test, expect } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.describe("surf map prototype route", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  test("redirects the public prototype URL to the canonical map", async ({ page }) => {
    await page.goto("/surf-map-prototype");
    await page.waitForLoadState("load");
    await expect(page).toHaveURL(/\/map$/);
  });
});

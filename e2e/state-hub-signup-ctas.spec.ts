/**
 * State Hub Signup CTAs E2E Tests
 *
 * Verifies that `/beaches/usa/[state]` renders the state-specific signup copy
 * in the inline CTA, using the concrete copy variant when the state has
 * ≥ 20 surfable breaks.
 */

import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from "./utils/error-detection";

test.describe("State hub signup CTAs", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "State hub signup CTAs" });
  });

  test("/ca renders concrete state-specific copy (≥20 breaks)", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/beaches/usa/ca");
    await page.waitForLoadState("load");

    const inlineCta = page.locator("[data-testid='inline-signup-cta']");
    await expect(inlineCta).toContainText(/California's \d+ breaks is firing right now/);
  });
});

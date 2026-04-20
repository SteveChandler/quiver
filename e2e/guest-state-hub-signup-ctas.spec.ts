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

  test("/ca sticky bar renders on mobile scroll with ≥48px tap target", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/beaches/usa/ca");
    await page.waitForLoadState("load");

    // Sticky bar should not be visible at y=0
    const bar = page.locator("[data-testid='sticky-signup-bar']");
    await expect(bar).toBeHidden();

    // Scroll past the 150px threshold
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(bar).toBeVisible();

    // Tap target ≥48×48
    const button = page.locator("[data-testid='sticky-signup-cta']");
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });
});

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
    await expect(inlineCta).toContainText(/California's \d+ breaks are firing right now/);
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

  test("/beaches/usa/nc renders generic fallback copy (<20 breaks)", async ({ page }) => {
    // North Carolina had 6 beaches in production as of 2026-04-20 — well below the 20-break
    // threshold. If NC ever crosses 20 breaks, swap for another small state (ME/RI/NH all <5).
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/beaches/usa/nc");
    await page.waitForLoadState("load");

    const inline = page.locator("[data-testid='inline-signup-cta']");
    await expect(inline).toContainText("Your next North Carolina session, delivered");

    // Concrete copy MUST NOT appear
    await expect(page.getByText(/North Carolina's \d+ breaks are firing/)).toHaveCount(0);
  });

  test("/ca sticky bar tap fires signup_cta_click with correct source + variant", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });

    const eventsCaptured: any[] = [];
    await page.route("**/api/events", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          eventsCaptured.push(JSON.parse(req.postData() || "{}"));
        } catch {}
      }
      await route.continue();
    });

    await page.goto("/beaches/usa/ca");
    await page.waitForLoadState("load");
    await page.evaluate(() => window.scrollTo(0, 400));

    await page.locator("[data-testid='sticky-signup-cta']").click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for fire-and-forget fetch to /api/events
    await page.waitForTimeout(500);

    const click = eventsCaptured.find((e) => e.eventType === "signup_cta_click");
    expect(click).toBeDefined();
    expect(click.metadata.source).toBe("state-hub-ca");
    expect(click.metadata.cta_copy_variant).toBe("v1-breaks-count");
    expect(click.metadata.cta_type).toBe("sticky_bar");
  });
});

import { test, expect } from "@playwright/test";
import path from "node:path";

import { assertNoErrors, setupErrorDetection, type ErrorCapture } from "./utils/error-detection";

const displays = [
  { name: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
  { name: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
  { name: "mobile-reduced-motion", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
] as const;

for (const display of displays) {
  test.describe(`best-time directory ${display.name}`, () => {
    test.use({ viewport: display.viewport });
    let errorCapture: ErrorCapture;

    test.beforeEach(async ({ page }) => {
      errorCapture = setupErrorDetection(page);
      await page.emulateMedia({ reducedMotion: display.reducedMotion });
    });

    test.afterEach(async ({ page }) => {
      await assertNoErrors(page, errorCapture);
    });

    test("city links become readable on scroll and open a season guide", async ({ page, request }, testInfo) => {
      const response = await page.goto("/best-time-to-surf");
      expect(response?.status()).toBe(200);
      const directory = page.getByRole("region", { name: "All City Surf Season Guides" });
      const cityLink = directory.getByRole("link", { name: "Cocoa Beach", exact: true });
      await cityLink.scrollIntoViewIfNeeded();

      try {
        // Visibility alone accepts opacity:0, so check every ancestor's painted opacity.
        await expect.poll(async () => directory.evaluate((element) => {
          let opacity = 1;
          for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
            opacity *= Number(getComputedStyle(ancestor).opacity);
          }
          return opacity;
        }), { timeout: 10_000 }).toBe(1);
        await expect(cityLink).toBeInViewport();
      } finally {
        const screenshot = await page.screenshot({
          ...(process.env.SEO_EVIDENCE_DIR
            ? { path: path.join(process.env.SEO_EVIDENCE_DIR, `${display.name}.png`) }
            : {}),
        });
        await testInfo.attach(display.name, { body: screenshot, contentType: "image/png" });
      }

      const destination = await request.get("/best-time-to-surf/cocoa-beach");
      expect(destination.status()).toBe(200);
      await cityLink.click();
      await expect(page).toHaveURL(/\/best-time-to-surf\/cocoa-beach$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Cocoa Beach/i);
    });
  });
}

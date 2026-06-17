import { test, expect, type Page } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";

async function waitForMapInstance(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __quiverMapInstance?: unknown })
          .__quiverMapInstance
      ),
    { timeout: 30000 }
  );
}

async function layerExists(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        __quiverMapInstance?: { getLayer: (id: string) => unknown };
      }
    ).__quiverMapInstance;
    return Boolean(map && map.getLayer("quiver-swell-field"));
  });
}

async function waitForLayer(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        (
          window as unknown as {
            __quiverMapInstance?: { getLayer: (id: string) => unknown };
          }
        ).__quiverMapInstance?.getLayer("quiver-swell-field")
      ),
    { timeout: 10000 }
  );
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`swell field — ${viewport.name}`, () => {
    let errorCapture: ErrorCapture;

    test.beforeEach(async ({ page }) => {
      errorCapture = setupErrorDetection(page);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
    });

    test.afterEach(async ({ page }) => {
      await assertNoErrors(page, errorCapture);
    });

    test("toggles the swell field layer on and off", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);

      expect(await layerExists(page)).toBe(false);
      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();
      await waitForLayer(page);

      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
    });

    test("switches layers without console errors", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();

      await page.getByTestId("swell-layer-wind").click();
      await expect(page.getByTestId("swell-layer-wind")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      await page.getByTestId("swell-layer-s2").click();
      await expect(page.getByTestId("swell-layer-s2")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      expect(await layerExists(page)).toBe(true);
    });

    test("animates when motion allowed, static under reduced motion", async ({
      browser,
    }) => {
      // Motion allowed.
      const ctx1 = await browser.newContext({
        reducedMotion: "no-preference",
        viewport,
      });
      const page1 = await ctx1.newPage();
      const cap1 = setupErrorDetection(page1);
      await page1.goto("/map");
      await page1.waitForLoadState("load");
      await waitForMapInstance(page1);
      await page1.getByTestId("swell-field-toggle").click();
      await waitForLayer(page1);
      const a = await page1
        .locator("canvas.mapboxgl-canvas")
        .first()
        .screenshot();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- need two frames apart to observe animation
      await page1.waitForTimeout(900);
      const b = await page1
        .locator("canvas.mapboxgl-canvas")
        .first()
        .screenshot();
      expect(Buffer.compare(a, b)).not.toBe(0); // frames differ -> animating
      await assertNoErrors(page1, cap1);
      await ctx1.close();

      // Reduced motion.
      const ctx2 = await browser.newContext({
        reducedMotion: "reduce",
        viewport,
      });
      const page2 = await ctx2.newPage();
      const cap2 = setupErrorDetection(page2);
      await page2.goto("/map");
      await page2.waitForLoadState("load");
      await waitForMapInstance(page2);
      await page2.getByTestId("swell-field-toggle").click();
      await waitForLayer(page2);
      const c = await page2
        .locator("canvas.mapboxgl-canvas")
        .first()
        .screenshot();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- confirm NO change over time under reduced motion
      await page2.waitForTimeout(900);
      const d = await page2
        .locator("canvas.mapboxgl-canvas")
        .first()
        .screenshot();
      expect(Buffer.compare(c, d)).toBe(0); // identical -> static
      await assertNoErrors(page2, cap2);
      await ctx2.close();
    });
  });
}

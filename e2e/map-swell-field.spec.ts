import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";

test.describe.configure({ mode: "serial" });

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

async function waitForMapIdle(page: Page): Promise<void> {
  await waitForMapInstance(page);
  await page.waitForFunction(
    () => {
      const map = (
        window as unknown as {
          __quiverMapInstance?: {
            isStyleLoaded?: () => boolean;
          };
        }
      ).__quiverMapInstance;

      return Boolean(map?.isStyleLoaded?.());
    },
    { timeout: 30000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = (
          window as unknown as {
            __quiverMapInstance?: {
              loaded?: () => boolean;
              once: (event: "idle", callback: () => void) => void;
            };
          }
        ).__quiverMapInstance;

        if (!map || map.loaded?.()) {
          resolve();
          return;
        }

        map.once("idle", resolve);
      }),
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

async function tryWaitForLayer(page: Page, timeout = 5000): Promise<boolean> {
  return page
    .waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __quiverMapInstance?: { getLayer: (id: string) => unknown };
            }
          ).__quiverMapInstance?.getLayer("quiver-swell-field")
        ),
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

async function requireRenderedSwellLayer(page: Page): Promise<void> {
  await waitForMapIdle(page);
  await expect(page.getByTestId("swell-layer-selector")).toBeVisible({
    timeout: 30000,
  });
  if (await tryWaitForLayer(page, 3000)) return;

  for (const testId of [
    "swell-layer-s2",
    "swell-layer-wind",
    "swell-layer-combined",
    "swell-layer-s1",
  ]) {
    const option = page.getByTestId(testId);
    if (!(await option.isVisible({ timeout: 1000 }).catch(() => false))) {
      continue;
    }
    await option.click();
    if (await tryWaitForLayer(page, 5000)) return;
  }

  throw new Error("Expected a rendered swell field layer, but no layer was available");
}

async function canvasFrame(page: Page): Promise<Buffer> {
  await waitForMapIdle(page);
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await expect(canvas).toBeVisible();
  return canvas.screenshot();
}

function changedPixelCount(left: Buffer, right: Buffer): number {
  const leftPng = PNG.sync.read(left);
  const rightPng = PNG.sync.read(right);

  expect(leftPng.width).toBe(rightPng.width);
  expect(leftPng.height).toBe(rightPng.height);

  let changed = 0;
  for (let i = 0; i < leftPng.data.length; i += 4) {
    const delta =
      Math.abs(leftPng.data[i] - rightPng.data[i]) +
      Math.abs(leftPng.data[i + 1] - rightPng.data[i + 1]) +
      Math.abs(leftPng.data[i + 2] - rightPng.data[i + 2]) +
      Math.abs(leftPng.data[i + 3] - rightPng.data[i + 3]);

    if (delta > 24) {
      changed += 1;
    }
  }

  return changed;
}

async function waitForAnimatedCanvas(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const first = await canvasFrame(page);
        // eslint-disable-next-line playwright/no-wait-for-timeout -- sample two settled frames to confirm particles have seeded and are moving
        await page.waitForTimeout(350);
        const second = await canvasFrame(page);
        return changedPixelCount(first, second);
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(250);
}

async function waitForStableCanvas(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const first = await canvasFrame(page);
        // eslint-disable-next-line playwright/no-wait-for-timeout -- sample a longer quiet window so late Mapbox tile/data repaints settle before passing
        await page.waitForTimeout(450);
        const second = await canvasFrame(page);
        // eslint-disable-next-line playwright/no-wait-for-timeout -- reduced-motion particles must remain static across the same window used by the final smoke
        await page.waitForTimeout(450);
        const third = await canvasFrame(page);
        return Math.max(
          changedPixelCount(first, second),
          changedPixelCount(second, third),
        );
      },
      { timeout: 20000 },
    )
    .toBeLessThanOrEqual(250);
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

    test("starts with the swell field layer on and toggles it off and on", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);

      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();

      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
      expect(await layerExists(page)).toBe(false);

      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();
    });

    test("switches layers without console errors", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);
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

    test("keeps the forecast timeline inside the map legend", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);

      const legend = page.getByTestId("map-condition-legend");
      const selector = page.getByTestId("swell-layer-selector");
      const timeline = page.getByTestId("swell-forecast-timeline");

      await expect(legend).toBeVisible();
      await expect(selector).toBeVisible();
      await expect(timeline).toBeVisible();
      await expect(legend).toHaveCSS("background-color", "rgb(244, 235, 216)");
      await expect(legend).toHaveCSS("color", "rgb(17, 16, 13)");
      await expect(legend).toHaveCSS("border-top-width", "2px");
      await expect(legend.getByText("Worth it")).toBeVisible();
      await expect(legend.getByText("Scout it")).toBeVisible();
      await expect(legend.getByText("GOOD")).toHaveCount(0);
      await expect(legend.getByText("CHECK")).toHaveCount(0);

      const legendBox = await legend.boundingBox();
      const selectorBox = await selector.boundingBox();
      const timelineBox = await timeline.boundingBox();

      expect(legendBox).not.toBeNull();
      expect(selectorBox).not.toBeNull();
      expect(timelineBox).not.toBeNull();

      const visibleLegendBox = legendBox!;
      const visibleSelectorBox = selectorBox!;
      const visibleTimelineBox = timelineBox!;

      expect(visibleSelectorBox.x).toBeGreaterThanOrEqual(visibleLegendBox.x);
      expect(visibleSelectorBox.y).toBeGreaterThanOrEqual(visibleLegendBox.y);
      expect(
        visibleSelectorBox.x + visibleSelectorBox.width
      ).toBeLessThanOrEqual(visibleLegendBox.x + visibleLegendBox.width);
      expect(
        visibleSelectorBox.y + visibleSelectorBox.height
      ).toBeLessThanOrEqual(visibleLegendBox.y + visibleLegendBox.height);
      expect(visibleTimelineBox.x).toBeGreaterThanOrEqual(visibleLegendBox.x);
      expect(visibleTimelineBox.y).toBeGreaterThanOrEqual(visibleLegendBox.y);
      expect(
        visibleTimelineBox.x + visibleTimelineBox.width
      ).toBeLessThanOrEqual(visibleLegendBox.x + visibleLegendBox.width);
      expect(
        visibleTimelineBox.y + visibleTimelineBox.height
      ).toBeLessThanOrEqual(
        visibleLegendBox.y + visibleLegendBox.height
      );
      expect(visibleLegendBox.width).toBeLessThanOrEqual(viewport.width - 12);

      await legend
        .getByRole("button", { name: "Minimize map legend" })
        .press("Enter");

      await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
      await expect(timeline).toBeVisible();
      await expect(
        legend.getByRole("button", { name: "Expand map legend" })
      ).toBeVisible();

      await legend
        .getByRole("button", { name: "Expand map legend" })
        .press("Enter");

      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();
      await expect(timeline).toBeVisible();
    });

    test("animates when motion allowed, static under reduced motion", async ({
      page,
      context,
    }) => {
      // Motion allowed.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await requireRenderedSwellLayer(page);
      await waitForAnimatedCanvas(page);
      const a = await canvasFrame(page);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- need two frames apart to observe animation
      await page.waitForTimeout(900);
      const b = await canvasFrame(page);
      expect(changedPixelCount(a, b)).toBeGreaterThan(250);

      // Reduced motion.
      const page2 = await context.newPage();
      await page2.setViewportSize(viewport);
      await page2.emulateMedia({ reducedMotion: "reduce" });
      const cap2 = setupErrorDetection(page2);
      await page2.goto("/map");
      await page2.waitForLoadState("load");
      await waitForMapInstance(page2);
      await requireRenderedSwellLayer(page2);
      await waitForStableCanvas(page2);
      await assertNoErrors(page2, cap2);
      await page2.close();
    });
  });
}

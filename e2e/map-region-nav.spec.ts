import { test, expect, type Page } from "@playwright/test";
import { TIMEOUTS, VIEWPORTS } from "./fixtures/test-data";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";
import { dismissMapEntryOverlay } from "./utils/map-helpers";

type MapCenter = {
  lat: number;
  lon: number;
};

async function waitForMapInstance(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __quiverMapInstance?: unknown })
          .__quiverMapInstance,
      ),
    { timeout: TIMEOUTS.long },
  );
}

async function getMapCenter(page: Page): Promise<MapCenter> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        __quiverMapInstance?: {
          getCenter: () => { lat: number; lng: number };
        };
      }
    ).__quiverMapInstance;

    if (!map) {
      throw new Error("Map instance unavailable");
    }

    const center = map.getCenter();
    return { lat: center.lat, lon: center.lng };
  });
}

async function waitForMapCenterNear(
  page: Page,
  expected: MapCenter,
  toleranceDegrees: number,
): Promise<void> {
  await page.waitForFunction(
    ({ lat, lon, tolerance }) => {
      const map = (
        window as unknown as {
          __quiverMapInstance?: {
            getCenter: () => { lat: number; lng: number };
          };
        }
      ).__quiverMapInstance;

      if (!map) return false;

      const center = map.getCenter();
      return (
        Math.abs(center.lat - lat) <= tolerance &&
        Math.abs(center.lng - lon) <= tolerance
      );
    },
    { lat: expected.lat, lon: expected.lon, tolerance: toleranceDegrees },
    { timeout: TIMEOUTS.long },
  );
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Map toolbar region navigation", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Map region nav" });
  });

  test("anonymous desktop has one toolbar, search, region pills, and no desktop sidebar", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto("/map");
    await page.waitForLoadState("load");
    await dismissMapEntryOverlay(page);

    await expect(page.getByTestId("map-controls")).toHaveCount(1);
    await expect(
      page.getByRole("searchbox", {
        name: "Search beaches, spots, or cities",
      }),
    ).toBeVisible({ timeout: TIMEOUTS.medium });
    await expect(page.getByTestId("map-region-pill-san-diego")).toBeVisible();
    await expect(page.getByTestId("map-region-pill-hawaii")).toBeVisible();
    await expect(page.getByText(/spots in view/i)).toHaveCount(0);
  });

  test("region pills remount and recenter the map while the swell field is on", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto("/map");
    await page.waitForLoadState("load");
    await dismissMapEntryOverlay(page);
    await waitForMapInstance(page);

    const initialCenter = await getMapCenter(page);

    await page.getByTestId("swell-field-toggle").click();
    await expect(page.getByTestId("swell-layer-selector")).toBeVisible({
      timeout: TIMEOUTS.medium,
    });

    await page.getByTestId("map-region-pill-hawaii").click();
    await waitForMapCenterNear(
      page,
      { lat: 21.66, lon: -158.06 },
      1.25,
    );

    const hawaiiCenter = await getMapCenter(page);
    expect(Math.abs(hawaiiCenter.lon - initialCenter.lon)).toBeGreaterThan(10);
  });

  test("toolbar search recenters from one region to an out-of-region beach", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto("/map");
    await page.waitForLoadState("load");
    await dismissMapEntryOverlay(page);
    await waitForMapInstance(page);

    await page.getByTestId("map-region-pill-hawaii").click();
    await waitForMapCenterNear(
      page,
      { lat: 21.66, lon: -158.06 },
      1.25,
    );

    const hawaiiCenter = await getMapCenter(page);
    const search = page.getByRole("searchbox", {
      name: "Search beaches, spots, or cities",
    });
    await search.fill("Blacks");

    await waitForMapCenterNear(
      page,
      { lat: 32.89, lon: -117.25 },
      1,
    );

    const sanDiegoCenter = await getMapCenter(page);
    expect(Math.abs(sanDiegoCenter.lon - hawaiiCenter.lon)).toBeGreaterThan(10);
  });

  test("mobile keeps search and region pills visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/map");
    await page.waitForLoadState("load");
    await dismissMapEntryOverlay(page);

    await expect(
      page.getByRole("searchbox", {
        name: "Search beaches, spots, or cities",
      }),
    ).toBeVisible({ timeout: TIMEOUTS.medium });
    await expect(page.getByTestId("map-region-pill-san-diego")).toBeVisible();
  });
});

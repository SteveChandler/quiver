import { test, expect, type Page, type Route } from "@playwright/test";
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
  await page.getByRole("button", { name: "Expand map legend" }).click();
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

function hourlyTimelineChunk(
  beachIds: string[],
  timelineBeachIds: string[],
  start: string,
  hours: number,
  hasMore: boolean,
): Record<string, unknown> {
  const startMs = Date.parse(start);
  const timestamps = Array.from({ length: hours }, (_, index) =>
    new Date(startMs + index * 60 * 60 * 1000).toISOString(),
  );
  const partition = (index = 0) => ({
    s1Dir: 270,
    s1PeriodS: 14,
    s1HeightFt: 3.5 + index / 10,
    s2Dir: null,
    s2PeriodS: null,
    s2HeightFt: null,
    windDir: null,
    windMph: null,
  });

  return {
    success: true,
    data: {
      forecasts: Object.fromEntries(beachIds.map((beachId) => [beachId, "3.5 ft"])),
      swellPartitions: Object.fromEntries(
        beachIds.map((beachId) => [beachId, partition()]),
      ),
      hourlySwellTimeline: {
        timestamps,
        partitionsByBeach: Object.fromEntries(
          timelineBeachIds.map((beachId) => [
            beachId,
            timestamps.map((_, index) =>
              index === 7
                ? null
                : partition(index),
            ),
          ]),
        ),
        hasMore,
        nextStart: hasMore
          ? new Date(startMs + hours * 60 * 60 * 1000).toISOString()
          : null,
      },
    },
  };
}

async function routeMapBeachCatalog(page: Page): Promise<void> {
  const beaches = [
    {
      id: "mission-beach",
      name: "Mission Beach",
      slug: "mission-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
      timezone: "America/Los_Angeles",
      lat: 32.7702,
      lon: -117.2525,
    },
    {
      id: "waikiki",
      name: "Waikiki",
      slug: "waikiki",
      city: "Honolulu",
      state: "HI",
      country: "USA",
      timezone: "Pacific/Honolulu",
      lat: 21.2767,
      lon: -157.8263,
    },
  ];

  await page.route("**/api/beaches/nearby?*", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: beaches }),
    });
  });
  await page.route("**/api/beaches", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { beaches } }),
    });
  });
  await page.route("**/rest/v1/custom_spots?*", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      headers: { "Content-Range": "*/0" },
      body: "[]",
    });
  });
}

async function routeExpandableTimeline(
  page: Page,
): Promise<{ requests: Array<{ start: string; hours: string | null }> }> {
  const requests: Array<{ start: string; hours: string | null }> = [];
  const initialStart = "2026-07-10T20:00:00.000Z";
  const secondStart = "2026-07-12T20:00:00.000Z";

  await page.route("**/api/forecasts/bulk?*", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("timeline") !== "hourly") {
      await route.continue();
      return;
    }

    const start = url.searchParams.get("timelineStart") ?? initialStart;
    requests.push({ start, hours: url.searchParams.get("timelineHours") });
    const beachIds = (url.searchParams.get("beachIds") ?? "")
      .split(",")
      .filter(Boolean);
    const explicitTimelineBeachIds = (url.searchParams.get("timelineBeachIds") ?? "")
      .split(",")
      .filter(Boolean);
    const timelineBeachIds = explicitTimelineBeachIds.length > 0
      ? explicitTimelineBeachIds
      : beachIds;
    const body = start === secondStart
      ? hourlyTimelineChunk(beachIds, timelineBeachIds, secondStart, 182, true)
      : hourlyTimelineChunk(beachIds, timelineBeachIds, initialStart, 48, true);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });

  return { requests };
}

async function firstMarkerAboveTimeline(page: Page, timelineTop: number): Promise<ReturnType<Page["getByTestId"]>> {
  const markers = page.getByTestId("beach-marker");
  const count = await markers.count();
  for (let index = 0; index < count; index += 1) {
    const marker = markers.nth(index);
    const box = await marker.boundingBox();
    if (box && box.y + box.height < timelineTop) return marker;
  }
  throw new Error("No visible beach marker is above the forecast timeline");
}

test.describe("expandable local forecast timeline", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await routeMapBeachCatalog(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Expandable map forecast timeline" });
  });

  test("keeps a truthful field loading status until the first forecast chunk resolves", async ({ page }) => {
    let releaseForecast!: () => void;
    const forecastRelease = new Promise<void>((resolve) => {
      releaseForecast = resolve;
    });
    let reportRequest!: (url: URL) => void;
    const forecastRequest = new Promise<URL>((resolve) => {
      reportRequest = resolve;
    });

    await page.route("**/api/forecasts/bulk?*", async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("timeline") !== "hourly") {
        await route.continue();
        return;
      }

      reportRequest(url);
      await forecastRelease;
      const beachIds = (url.searchParams.get("beachIds") ?? "")
        .split(",")
        .filter(Boolean);
      const explicitTimelineBeachIds = (url.searchParams.get("timelineBeachIds") ?? "")
        .split(",")
        .filter(Boolean);
      const timelineBeachIds = explicitTimelineBeachIds.length > 0
        ? explicitTimelineBeachIds
        : beachIds;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          hourlyTimelineChunk(
            beachIds,
            timelineBeachIds,
            "2026-07-10T20:00:00.000Z",
            48,
            false,
          ),
        ),
      });
    });

    await page.goto("/map?search=Mission%20Beach", { waitUntil: "commit" });
    await expect(page.getByText("Unable to Load map data")).toHaveCount(0);

    try {
      const requestUrl = await forecastRequest;
      expect(requestUrl.searchParams.get("timelineHours")).toBe("48");
      await expect(page.getByTestId("swell-field-loading-note")).toBeVisible();
      await expect(page.getByTestId("swell-field-empty-note")).toHaveCount(0);
    } finally {
      releaseForecast();
    }

    await expect(page.getByTestId("swell-field-loading-note")).toHaveCount(0);
    await expect(page.getByTestId("swell-field-empty-note")).toHaveCount(0);
    await expect(page.getByText("Unable to Load map data")).toHaveCount(0);
    await expect(page.getByTestId("map-container")).toBeVisible();
  });

  test("uses absolute Hawaii time, keyboard hours, and a ten-day background horizon", async ({ page }) => {
    const timeline = await routeExpandableTimeline(page);
    await page.goto("/map?search=Waikiki");
    await page.waitForLoadState("load");

    const dayTimeline = page.getByTestId("swell-day-timeline");
    await expect(dayTimeline).toBeVisible({ timeout: 30000 });
    await expect(dayTimeline).toHaveAttribute("data-timezone", "Pacific/Honolulu");
    await expect(page.getByText(/\+\d+h/)).toHaveCount(0);

    const bubble = page.getByTestId("timeline-bubble");
    await expect(bubble).toHaveText(/Fri 10 — 10 AM HST/);
    const slider = page.getByRole("slider", { name: "Forecast time" });
    await slider.press("ArrowRight");
    await expect(bubble).toHaveText(/Fri 10 — 11 AM HST/);
    await slider.press("PageDown");
    await expect(bubble).toHaveText(/Sat 11 — 11 AM HST/);

    await expect.poll(() => timeline.requests.filter(
      (request) => request.start === "2026-07-12T20:00:00.000Z"
        && request.hours === "182",
    ).length).toBe(1);
    await expect(page.getByTestId("timeline-day-Sun-19")).toBeVisible();
    await expect(page.getByTestId("timeline-day-Mon-20")).toHaveCount(0);
    await slider.press("End");
    await expect(bubble).toHaveText(/Sun 19/);
    expect(timeline.requests.filter(
      (request) => request.start === "2026-07-12T20:00:00.000Z"
        && request.hours === "182",
    )).toHaveLength(1);
  });

  test("keeps the mobile bubble, controls, and conditions callout inside the map timeline", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await routeExpandableTimeline(page);
    await page.goto("/map");
    await page.waitForLoadState("load");

    const panel = page.getByTestId("timeline-panel");
    const bubble = page.getByTestId("timeline-bubble");
    await expect(panel).toBeVisible({ timeout: 30000 });
    await expect(bubble).toBeVisible();

    const [panelBox, bubbleBox, playBox, mapBox] = await Promise.all([
      panel.boundingBox(),
      bubble.boundingBox(),
      page.getByRole("button", { name: "Play forecast timeline" }).boundingBox(),
      page.getByTestId("map-container").boundingBox(),
    ]);
    expect(panelBox).not.toBeNull();
    expect(bubbleBox).not.toBeNull();
    expect(playBox).not.toBeNull();
    expect(mapBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(mapBox!.y + mapBox!.height);
    expect(bubbleBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
    expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width);
    expect(playBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
    expect(playBox!.x + playBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width);

    const slider = page.getByRole("slider", { name: "Forecast time" });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 756, height: 781 },
    ]) {
      await page.setViewportSize(viewport);
      await slider.press("End");
      const [endBubbleBox, resizedPanelBox] = await Promise.all([
        bubble.boundingBox(),
        panel.boundingBox(),
      ]);
      expect(endBubbleBox).not.toBeNull();
      expect(resizedPanelBox).not.toBeNull();
      expect(endBubbleBox!.x).toBeGreaterThanOrEqual(resizedPanelBox!.x);
      expect(endBubbleBox!.x + endBubbleBox!.width).toBeLessThanOrEqual(
        resizedPanelBox!.x + resizedPanelBox!.width,
      );

      await slider.press("Home");
      const startBubbleBox = await bubble.boundingBox();
      expect(startBubbleBox).not.toBeNull();
      expect(startBubbleBox!.x).toBeGreaterThanOrEqual(resizedPanelBox!.x);
      expect(startBubbleBox!.x + startBubbleBox!.width).toBeLessThanOrEqual(
        resizedPanelBox!.x + resizedPanelBox!.width,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });

    await slider.fill("7");
    const emptyNote = page.getByTestId("swell-field-empty-note");
    await expect(emptyNote).toHaveText("No swell data for this forecast hour");
    const [emptyNoteBox, nullFramePanelBox] = await Promise.all([
      emptyNote.boundingBox(),
      panel.boundingBox(),
    ]);
    expect(emptyNoteBox).not.toBeNull();
    expect(nullFramePanelBox).not.toBeNull();
    expect(emptyNoteBox!.y + emptyNoteBox!.height).toBeLessThanOrEqual(
      nullFramePanelBox!.y,
    );
    await slider.fill("8");
    await expect(emptyNote).toHaveCount(0);

    await expect(page.getByTestId("beach-marker").first()).toBeVisible({ timeout: 30000 });
    const marker = await firstMarkerAboveTimeline(page, panelBox!.y);
    await marker.click();
    const callout = page.locator('[data-conditions-callout="true"]');
    await expect(callout).toBeVisible();
    const calloutBox = await callout.boundingBox();
    expect(calloutBox).not.toBeNull();
    expect(calloutBox!.y + calloutBox!.height).toBeLessThanOrEqual(panelBox!.y);
  });

  test("keeps Hawaii pins and the swell field visible while playback skips a missing frame", async ({ page }) => {
    await routeExpandableTimeline(page);
    await page.goto("/map?search=Waikiki");
    await page.waitForLoadState("load");
    await page.getByRole("option", { name: "Waikiki Honolulu, HI" }).click();
    await waitForMapInstance(page);
    await requireRenderedSwellLayer(page);

    const markers = page.getByTestId("beach-marker");
    await expect(markers.first()).toBeVisible({ timeout: 30000 });
    const initialMarkerCount = await markers.count();
    expect(initialMarkerCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Play forecast timeline" }).click();
    await expect.poll(
      async () => Number(await page.getByRole("slider", { name: "Forecast time" }).inputValue()),
      { timeout: 10000 },
    ).toBeGreaterThan(7);

    expect(await markers.count()).toBe(initialMarkerCount);
    await expect(markers.first()).toBeVisible();
    await expect(page.getByTestId("swell-field-empty-note")).toHaveCount(0);
    expect(await layerExists(page)).toBe(true);
  });
});

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
      await routeMapBeachCatalog(page);
      await routeExpandableTimeline(page);
    });

    test.afterEach(async ({ page }) => {
      await assertNoErrors(page, errorCapture);
    });

    test("starts with the swell field layer on and toggles it off and on", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);

      await expect(
        page.getByRole("button", { name: "Expand map legend" }),
      ).toBeVisible();
      await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
      expect(await layerExists(page)).toBe(true);

      await page.getByTestId("swell-field-toggle").click();
      await expect(page.getByTestId("swell-layer-selector")).toHaveCount(0);
      expect(await layerExists(page)).toBe(false);

      await page.getByTestId("swell-field-toggle").click();
      await expect(
        page.getByRole("button", { name: "Expand map legend" }),
      ).toBeVisible();
      expect(await layerExists(page)).toBe(true);
    });

    test("switches layers without console errors", async ({ page }) => {
      await page.goto("/map");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);
      await page.getByRole("button", { name: "Expand map legend" }).click();
      await expect(page.getByTestId("swell-layer-selector")).toBeVisible();

      await page.getByTestId("swell-layer-wind").click();
      await expect(page.getByTestId("swell-layer-wind")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await page.getByTestId("swell-layer-s2").click();
      await expect(page.getByTestId("swell-layer-s2")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(await layerExists(page)).toBe(true);
    });

    test("keeps layer controls in the legend while the public forecast timeline stays map-contained", async ({ page }) => {
      await page.goto("/map?share=1");
      await page.waitForLoadState("load");
      await waitForMapInstance(page);
      await waitForMapIdle(page);

      const legend = page.getByTestId("map-condition-legend");
      const selector = page.getByTestId("swell-layer-selector");
      const timeline = page.getByTestId("swell-day-timeline");
      const mapContainer = page.getByTestId("map-container");

      await expect(legend).toBeVisible();
      await expect(selector).toHaveCount(0);
      await legend
        .getByRole("button", { name: "Expand map legend" })
        .press("Enter");
      await expect(selector).toBeVisible();
      await expect(timeline).toBeVisible();
      await expect(legend.getByTestId("swell-forecast-timeline")).toHaveCount(0);
      await expect(legend.getByTestId("swell-day-timeline")).toHaveCount(0);
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
      const mapContainerBox = await mapContainer.boundingBox();

      expect(legendBox).not.toBeNull();
      expect(selectorBox).not.toBeNull();
      expect(timelineBox).not.toBeNull();
      expect(mapContainerBox).not.toBeNull();

      expect(timelineBox!.x).toBeGreaterThanOrEqual(mapContainerBox!.x);
      expect(timelineBox!.x + timelineBox!.width).toBeLessThanOrEqual(
        mapContainerBox!.x + mapContainerBox!.width,
      );
      const fieldGuideBox = await page.locator("#map-field-guide-panel").boundingBox();
      expect(fieldGuideBox).not.toBeNull();
      const timelineOverlapsFieldGuide = !(
        timelineBox!.x + timelineBox!.width <= fieldGuideBox!.x
        || timelineBox!.x >= fieldGuideBox!.x + fieldGuideBox!.width
        || timelineBox!.y + timelineBox!.height <= fieldGuideBox!.y
        || timelineBox!.y >= fieldGuideBox!.y + fieldGuideBox!.height
      );
      expect(timelineOverlapsFieldGuide).toBe(false);
      const timelineOverlapsLegend = !(
        timelineBox!.x + timelineBox!.width <= legendBox!.x
        || timelineBox!.x >= legendBox!.x + legendBox!.width
        || timelineBox!.y + timelineBox!.height <= legendBox!.y
        || timelineBox!.y >= legendBox!.y + legendBox!.height
      );
      expect(timelineOverlapsLegend).toBe(false);

      const visibleLegendBox = legendBox!;
      const visibleSelectorBox = selectorBox!;

      expect(visibleSelectorBox.x).toBeGreaterThanOrEqual(visibleLegendBox.x);
      expect(visibleSelectorBox.y).toBeGreaterThanOrEqual(visibleLegendBox.y);
      expect(
        visibleSelectorBox.x + visibleSelectorBox.width
      ).toBeLessThanOrEqual(visibleLegendBox.x + visibleLegendBox.width);
      expect(
        visibleSelectorBox.y + visibleSelectorBox.height
      ).toBeLessThanOrEqual(visibleLegendBox.y + visibleLegendBox.height);
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
      await routeMapBeachCatalog(page2);
      await routeExpandableTimeline(page2);
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

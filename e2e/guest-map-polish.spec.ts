import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from "./utils/error-detection";

test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=metal"] } });

let localRateSequence = 0;

// Read-only live-data regression: no login, seeding, or application writes.
for (const viewport of [{ width: 1400, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`map polish ${viewport.width}px`, () => {
    test.use({ viewport });
    let errors: ErrorCapture;
    let localRateHeaders: Record<string, string> = {};
    test.beforeEach(async ({ page }, testInfo) => {
      // Isolate local test traffic; production rate limits are unchanged.
      const hostname = new URL(String(testInfo.project.use.baseURL)).hostname;
      localRateHeaders = ["localhost", "127.0.0.1"].includes(hostname)
        ? { "x-forwarded-for": `198.18.${process.pid % 256}.${++localRateSequence}` } : {};
      errors = setupErrorDetection(page);
      await page.route("**/api/**", (route) => ["GET", "HEAD"].includes(route.request().method())
        ? route.continue({ headers: { ...route.request().headers(), ...localRateHeaders } })
        : route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
    });
    test.afterEach(async ({ page }) => { await assertNoErrors(page, errors); });
    if (viewport.width === 1400) test("recovers a throttled forecast without leaving Mexico pins empty", async ({ page }) => {
      let throttled = false;
      let recovered = false;
      await page.route("**/api/forecasts/bulk?**", async (route) => {
        if (!throttled) {
          throttled = true;
          await route.fulfill({ status: 429, headers: { "Retry-After": "1" }, contentType: "application/json", body: '{"error":"Rate limited"}' });
          return;
        }
        const response = await route.fetch({ headers: { ...route.request().headers(), ...localRateHeaders } });
        recovered = response.status() === 200;
        await route.fulfill({ response });
      });
      await page.goto("/map?search=K-38");
      const pin = page.locator('[data-testid="beach-marker"][data-beach-id="77d286c5-87e9-4678-82d3-81d0125285fa"]');
      await expect(pin).toBeVisible({ timeout: 90000 });
      await expect(pin).not.toHaveAttribute("data-condition-summary", "UNKNOWN", { timeout: 90000 });
      await pin.getByRole("button").click();
      const callout = page.locator('[data-conditions-callout="true"]');
      await expect(callout.locator('[data-callout-banner="s1"]')).toBeVisible();
      await expect(page.getByText("Forecast extension unavailable", { exact: false })).toBeHidden();
      expect(throttled).toBe(true);
      expect(recovered).toBe(true);
      const canvas = await page.locator("canvas.mapboxgl-canvas").elementHandle();
      const before = Number(await callout.locator('[data-callout-banner="s1"]').getAttribute("data-screen-angle"));
      await page.evaluate(() => (window as any).__quiverMapInstance.rotateTo(90, { duration: 0 }));
      await expect.poll(async () => Number(await callout.locator('[data-callout-banner="s1"]').getAttribute("data-screen-angle"))).toBeCloseTo(before - 90, 0);
      expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
      await page.waitForFunction(() => (window as any).__quiverMapInstance.areTilesLoaded());
      await page.screenshot({ path: ".planning/evidence/map-polish/baja-recovery.png" });
    });
    if (viewport.width === 390) test("identifies historical water-quality evidence by sample date", async ({ page }) => {
      // County notices change; fix only this evidence payload, retaining live beach geometry.
      await page.route("**/api/beaches/nearby?**", async (route) => {
        const response = await route.fetch({ headers: { ...route.request().headers(), ...localRateHeaders } });
        expect(response.status()).toBe(200);
        const body = await response.json();
        const beach = body.data.find((item: { id: string }) => item.id === "d291411d-d331-4bf1-ad1a-302da3c69de0");
        if (beach) {
          beach.waterQualityHold = "advisory";
          beach.waterQualityEvidence = { source: "sample", sampleDate: "2026-08-11" };
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto("/map?search=La%20Jolla%20Shores");
      await expect(page.getByRole("slider", { name: "Forecast time" })).toBeVisible({ timeout: 90000 });
      const pin = page.locator('[data-testid="beach-marker"][data-beach-id="d291411d-d331-4bf1-ad1a-302da3c69de0"]');
      await expect(pin).toBeVisible({ timeout: 90000 });
      await pin.getByRole("button").click();
      const badge = page.locator('[data-callout-water-quality]');
      await expect(badge).toContainText("sample 2026-08-11");
      await expect(badge).not.toContainText("Advisory");
      await page.screenshot({ path: ".planning/evidence/map-polish/advisory-source.png" });
    });
    test("updates pin colors and arrows from cached hourly conditions without replacing markers", async ({ page }) => {
      const delMarId = "5e72b79d-a12d-4cd3-8da4-b7b92069efbf";
      let forecastRequests = 0;
      let loadedBeachCount = 0;
      await page.route("**/api/forecasts/bulk?**", async (route) => {
        forecastRequests += 1;
        const response = await route.fetch({ headers: { ...route.request().headers(), ...localRateHeaders } });
        expect(response.status()).toBe(200);
        const body = await response.json();
        const timeline = body.data.hourlySwellTimeline;
        if (timeline) {
          loadedBeachCount += Object.keys(timeline.partitionsByBeach).length;
          // Deterministic score change; real geometry, times, arrows, and all other scores.
          timeline.partitionsByBeach[delMarId]?.forEach((partition: { conditionScore: number } | null, index: number) => {
            if (partition) partition.conditionScore = index < 24 ? 75 : 30;
          });
        }
        await route.fulfill({ response, json: body });
      });
      await page.goto("/map");
      await expect.poll(() => loadedBeachCount, { timeout: 90000 }).toBeGreaterThan(20);
      const slider = page.getByRole("slider", { name: "Forecast time" });
      await expect(slider).toBeVisible({ timeout: 90000 });
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ center: [-117.265, 32.955], zoom: 13 }));
      const pin = page.locator(`[data-testid="beach-marker"][data-beach-id="${delMarId}"]`);
      await expect(pin).toHaveAttribute("data-condition-summary", "GOOD");
      const markerElement = await pin.elementHandle();
      const canvas = await page.locator("canvas.mapboxgl-canvas").elementHandle();
      await pin.getByRole("button").click();
      const card = page.locator('[data-conditions-callout="true"]');
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
      const requestsBefore = forecastRequests;
      const original = await card.getAttribute("data-forecast-at");
      await slider.fill("24");
      await expect(card).not.toHaveAttribute("data-forecast-at", original!);
      await expect(pin).toHaveAttribute("data-condition-summary", "MEH");
      await expect(pin.locator("[data-marker-visual]")).toHaveCSS("background-image", "linear-gradient(to right, rgb(51, 65, 85), rgb(71, 85, 105))");
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
      expect(await markerElement!.evaluate((element) => element.isConnected)).toBe(true);
      expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
      expect(forecastRequests).toBe(requestsBefore);
      await slider.fill("0");
      await expect(pin).toHaveAttribute("data-condition-summary", "GOOD");
      await page.screenshot({ path: `.planning/evidence/map-polish/unified-hourly-${viewport.width}.png` });
    });
    test("shows Today and the whole week without clipped labels", async ({ page }) => {
      await page.goto("/map?search=Osprey%20Point");
      const slider = page.getByRole("slider", { name: "Forecast time" });
      await expect(slider).toBeVisible({ timeout: 90000 });
      const days = page.getByTestId("timeline-day-layer").locator(":scope > div");
      const first = days.first();
      await expect.poll(() => days.count()).toBeGreaterThanOrEqual(7);
      const label = first.locator("span:visible").first();
      await expect(label).toHaveText("Today");
      await expect(page.getByTestId("timeline-day-layer")).not.toContainText("h left");
      const firstBox = (await label.boundingBox())!;
      const nextBox = (await days.nth(1).locator("span:visible").first().boundingBox())!;
      const trackBox = (await page.getByTestId("timeline-day-layer").boundingBox())!;
      expect(firstBox.x).toBeGreaterThanOrEqual(trackBox.x);
      expect(firstBox.x + firstBox.width).toBeLessThanOrEqual(nextBox.x);
      await page.getByTestId("swell-day-timeline").screenshot({ path: `.planning/evidence/map-polish/first-weekday-${viewport.width}.png` });
    });
    test("keeps pins compact and scales the selected circle with zoom", async ({ page }) => {
      await page.goto("/map?search=Osprey%20Point");
      await expect(page.getByRole("slider", { name: "Forecast time" })).toBeVisible({ timeout: 90000 });
      const pin = page.getByRole("button", { name: "View Osprey Point conditions", exact: true });
      await expect(pin).toBeVisible();
      await expect(pin.locator("[data-marker-visual]")).toHaveCSS("transform", "none");
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ zoom: 13 }));
      await pin.click();
      const card = page.locator('[data-conditions-callout="true"]');
      await expect(pin.locator("[data-marker-visual]")).toHaveCSS("transform", "none");
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
      await expect(card).toHaveCSS("pointer-events", "none");
      const content = await card.locator("[data-callout-content]").elementHandle();
      const ring = card.locator('circle[fill="none"]');
      await expect.poll(() => page.evaluate(() => (window as any).__quiverMapInstance.isMoving())).toBe(false);
      const ringWidth = (await ring.boundingBox())!.width;
      const link = card.locator("[data-callout-link]");
      const linkHeight = (await link.boundingBox())!.height;
      await expect(pin).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(pin).toHaveCSS("width", "44px");
      await expect.poll(async () => (await pin.locator("[data-marker-visual]").boundingBox())!.width).toBeLessThan(26);
      const marker = pin.locator("..");
      await expect(marker.getByTestId("selection-ring")).toHaveCSS("width", "30px");
      const canvas = await page.locator("canvas.mapboxgl-canvas").elementHandle();
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ zoom: 11 }));
      await expect.poll(async () => (await ring.boundingBox())!.width).toBeLessThan(ringWidth * 0.6);
      expect(await content!.evaluate((element) => element.isConnected)).toBe(true);
      expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
      expect((await link.boundingBox())!.height).toBeCloseTo(linkHeight, 0);
      expect((await pin.locator("[data-marker-visual]").boundingBox())!.width).toBeLessThan(26);
      await page.waitForFunction(() => (window as any).__quiverMapInstance.areTilesLoaded());
      await page.screenshot({ path: `.planning/evidence/map-polish/pin-zoom-${viewport.width}.png` });
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ zoom: 13 }));
      await expect.poll(async () => (await ring.boundingBox())!.width).toBeCloseTo(ringWidth, 0);
    });
    if (viewport.width === 1400) test("loads new-region pin colors beyond the first twenty beaches", async ({ page }) => {
      await page.goto("/map");
      await expect(page.getByRole("slider", { name: "Forecast time" })).toBeVisible({ timeout: 90000 });
      const canvas = page.locator("canvas.mapboxgl-canvas");
      const originalCanvas = await canvas.elementHandle();
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ center: [-117.63, 33.42], zoom: 9 }));
      const nearbyResponse = page.waitForResponse((response) => response.url().includes("/api/beaches/nearby?") && Number(new URL(response.url()).searchParams.get("lat")) > 33);
      const bulkResponse = page.waitForResponse(async (response) => {
        if (!response.url().includes("/api/forecasts/bulk?") || response.status() !== 200) return false;
        const ids = new URL(response.url()).searchParams.get("beachIds")?.split(",") ?? [];
        const region = (await (await nearbyResponse).json()).data as Array<{ id: string }>;
        return ids.includes(region[region.length - 1].id);
      });
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + 50, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height * 0.4 + 80, { steps: 12 });
      await page.mouse.up();
      const nearby = await nearbyResponse;
      expect(nearby.status()).toBe(200);
      const beaches = (await nearby.json()).data as Array<{ id: string }>;
      expect(beaches.length).toBeGreaterThan(20);
      const forecast = await bulkResponse;
      const timeline = (await forecast.json()).data.hourlySwellTimeline;
      const summaries: Record<string, string> = Object.fromEntries(Object.entries(timeline.partitionsByBeach).map(([id, values]) => {
        const score = (values as Array<{ conditionScore: number | null } | null>)[0]?.conditionScore;
        return [id, score == null ? "UNKNOWN" : score >= 80 ? "EPIC" : score >= 70 ? "GOOD" : score >= 55 ? "FAIR" : score >= 40 ? "RIDEABLE" : "MEH"];
      }));
      const laterIds = beaches.slice(20).map((beach) => beach.id).filter((id) => summaries[id] && summaries[id] !== "UNKNOWN");
      expect(laterIds.length).toBeGreaterThan(0);
      await expect.poll(() => page.locator(laterIds.map((id) => `[data-testid="beach-marker"][data-beach-id="${id}"]`).join(",")).count()).toBeGreaterThan(0);
      const checked: string[] = [];
      for (const id of laterIds) {
        const pin = page.locator(`[data-testid="beach-marker"][data-beach-id="${id}"]`);
        if (await pin.count() === 0) continue;
        await expect(pin).toHaveAttribute("data-condition-summary", summaries[id], { timeout: 90000 });
        const gradientStart: Record<string, string> = {
          EPIC: "rgb(138, 90, 0)", GOOD: "rgb(0, 91, 82)", FAIR: "rgb(138, 74, 18)",
          RIDEABLE: "rgb(71, 85, 105)", MEH: "rgb(51, 65, 85)",
        };
        const hold = await pin.getAttribute("data-water-quality-hold");
        const expectedColor = hold === "none" ? gradientStart[summaries[id]] : "rgb(153, 27, 27)";
        await expect.poll(() => pin.locator("[data-marker-visual]").evaluate((element) => getComputedStyle(element).backgroundImage), { message: `Hourly color for ${id}: ${summaries[id]}`, timeout: 90000 }).toContain(expectedColor);
        checked.push(id);
      }
      expect(checked.length).toBeGreaterThan(0);
      expect(await originalCanvas!.evaluate((element) => element.isConnected)).toBe(true);
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ zoom: 8 }));
      await expect.poll(async () => page.locator('[data-testid="beach-marker"]').evaluateAll((markers) => markers.filter((element) => getComputedStyle(element).visibility === "hidden").length)).toBeGreaterThan(0);
      const dots = await page.locator('[data-testid="beach-marker"] [data-marker-visual]').evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).visibility !== "hidden").map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }));
      expect(dots.length).toBeGreaterThan(1);
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        expect(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)).toBeGreaterThanOrEqual(23);
      }
      await page.waitForFunction(() => (window as any).__quiverMapInstance.areTilesLoaded());
      await page.screenshot({ path: ".planning/evidence/map-polish/region-colors.png" });
    });
    if (viewport.width === 390) test("native embed opens a sourced conditions card on one tap", async ({ page }) => {
      await page.goto("/embed/map?lat=32.728&lon=-117.258&zoom=13&timeline=hourly");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const pin = page.locator('[data-testid="beach-marker"][data-beach-id="c3b42f85-e650-445f-89b1-1debe661652e"]');
      await expect(pin).toBeVisible({ timeout: 90000 });
      await expect(pin).toHaveAttribute("role", "group");
      await pin.click();
      const card = page.locator('[data-conditions-callout="true"]');
      await expect(card).toContainText("Osprey Point");
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible({ timeout: 90000 });
      await page.screenshot({ path: ".planning/evidence/map-polish/native-embed.png" });
      await card.locator("[data-callout-name]").click();
      await expect(card).toHaveCount(0);
    });
    test("keeps selection and time aligned, clips land, and allows coastal travel", async ({ page }) => {
      const response = await page.goto("/map?search=Osprey%20Point");
      expect(response?.status()).toBe(200);
      // Hide only the local Next dev indicator, which covers mobile playback.
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const pin = page.locator('[data-testid="beach-marker"][data-beach-id="c3b42f85-e650-445f-89b1-1debe661652e"]');
      await expect(pin).toBeVisible({ timeout: 90000 });
      await expect(page.getByRole("slider", { name: "Forecast time" })).toBeVisible({ timeout: 90000 });
      await expect(page.getByTestId("swell-field-loading-note")).toBeHidden({ timeout: 90000 });
      await pin.click();
      const card = page.locator('[data-conditions-callout="true"]');
      await expect(card).toContainText("Osprey Point");
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
      await expect(page.getByText("Location is off. Search your break")).toBeHidden();
      const originalCard = await card.elementHandle();
      const canvasBeforePan = await page.locator("canvas.mapboxgl-canvas").elementHandle();
      const canvasBox = (await page.locator("canvas.mapboxgl-canvas").boundingBox())!;
      await page.mouse.move(canvasBox.x + 20, canvasBox.y + canvasBox.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 20, canvasBox.y + canvasBox.height * 0.45 + 55, { steps: 12 });
      await page.mouse.up();
      await expect(card.locator('[data-callout-banner="s1"]')).toBeVisible();
      expect(await canvasBeforePan!.evaluate((element) => element.isConnected)).toBe(true);
      expect(await originalCard!.evaluate((element) => element.isConnected)).toBe(true);
      const initialTime = await card.getAttribute("data-forecast-at");
      await page.getByRole("slider", { name: "Forecast time" }).fill("3");
      await expect(card).not.toHaveAttribute("data-forecast-at", initialTime!);
      expect(await originalCard!.evaluate((element) => element.isConnected)).toBe(true);
      await expect(card.locator('[data-callout-banner="s1"]')).toHaveAttribute("data-bearing", /\d/);
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path: `.planning/evidence/map-polish/selected-${viewport.width}.png` });
      await page.getByRole("button", { name: "Play forecast timeline" }).click();
      const selectedTime = await card.getAttribute("data-forecast-at");
      await expect(card).not.toHaveAttribute("data-forecast-at", selectedTime!);
      await page.getByRole("button", { name: "Pause forecast timeline" }).click();
      await expect(card).toBeVisible();
      await card.locator("[data-callout-name]").click();
      await expect(card).toHaveCount(0);
      // Clear search so a user pan also discovers beaches in the new viewport.
      await page.getByRole("button", { name: "Clear map search" }).click();
      await page.evaluate(() => {
        const map = (window as any).__quiverMapInstance;
        map.jumpTo({ center: [-117.63, 33.42], zoom: 11 });
      });
      await expect.poll(() => page.evaluate(() => (window as any).__quiverMapInstance.getCenter().lat)).toBeCloseTo(33.42, 2);
      expect(await page.evaluate(() => (window as any).__quiverMapInstance.getMaxBounds())).toBeNull();
      await page.screenshot({ path: `.planning/evidence/map-polish/north-${viewport.width}.png` });
      // Coastline check on a fixed camera: animation must change ocean pixels, never inland pixels.
      await page.evaluate(() => (window as any).__quiverMapInstance.jumpTo({ center: [-117.255, 32.74], zoom: 12 }));
      await page.waitForFunction(() => (window as any).__quiverMapInstance.areTilesLoaded());
      await expect(page.getByTestId("swell-field-loading-note")).toBeHidden({ timeout: 90000 });
      if (viewport.width > 1000) {
        const canvas = page.locator("canvas.mapboxgl-canvas");
        const points = await page.evaluate(() => {
          const map = (window as any).__quiverMapInstance;
          return { land: map.project([-117.235, 32.74]), water: map.project([-117.285, 32.74]) };
        });
        const first = PNG.sync.read(await canvas.screenshot());
        await page.evaluate(() => new Promise<void>((resolve) => (window as any).__quiverMapInstance.once("render", resolve)));
        const second = PNG.sync.read(await canvas.screenshot());
        function changes(point: { x: number; y: number }): number {
          let count = 0;
          for (let y = Math.round(point.y) - 25; y < point.y + 25; y++) for (let x = Math.round(point.x) - 25; x < point.x + 25; x++) {
            const i = (y * first.width + x) * 4;
            if (Math.abs(first.data[i] - second.data[i]) + Math.abs(first.data[i+1] - second.data[i+1]) + Math.abs(first.data[i+2] - second.data[i+2]) > 24) count++;
          }
          return count;
        }
        expect(changes(points.land)).toBe(0);
        expect(changes(points.water)).toBeGreaterThan(0);
      }
    });
  });
}

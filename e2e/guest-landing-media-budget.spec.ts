import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from "./utils/error-detection";

const HERO_POSTER_PATH = "/images/hero/quiver-landing-hero-poster.jpg";
const HERO_VIDEO_PATH = "/videos/quiver-landing-hero-720.mp4";
const WALKTHROUGH_VIDEO_PATH = "/videos/buoy-loop.mp4";
const SCREENSHOT_ROOT = "/images/app-screenshots/";
const VIDEO_ROOT = "/videos/";
// Desktop currently spends 4 (hero poster, hero video, walkthrough video,
// local-intel screenshot); mobile spends 3. Both landing videos autoplay, so
// they are first-load cost and must stay counted.
const LANDING_MEDIA_REQUEST_BUDGET = 6;
const ALLOWED_FIRST_LOAD_MEDIA = new Set([
  HERO_POSTER_PATH,
  HERO_VIDEO_PATH,
  WALKTHROUGH_VIDEO_PATH,
  "/images/app-screenshots/local-intel-720.webp",
]);

const MEDIA_VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

function toLandingMediaPath(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const assetPath =
    url.pathname === "/_next/image"
      ? url.searchParams.get("url")
      : url.pathname;

  if (!assetPath) return null;
  if (assetPath === HERO_POSTER_PATH) return assetPath;
  if (assetPath.startsWith(VIDEO_ROOT)) return assetPath;
  if (assetPath.startsWith(SCREENSHOT_ROOT)) return assetPath;
  return null;
}

function captureLandingMediaRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    const assetPath = toLandingMediaPath(request.url());
    if (assetPath) requests.push(assetPath);
  });
  return requests;
}

async function mockTelemetry(page: Page): Promise<void> {
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

for (const { name, viewport } of MEDIA_VIEWPORTS) {
  test.describe(`Guest landing media budget — ${name}`, () => {
    test.use({ viewport });

    let errorCapture: ErrorCapture;

    test.beforeEach(async ({ page }) => {
      errorCapture = setupErrorDetection(page);
      await mockTelemetry(page);
    });

    test.afterEach(async ({ page }) => {
      await assertNoErrors(page, errorCapture, {
        context: `Landing media budget ${name}`,
      });
    });

    test("keeps landing media within the documented request budget @smoke", async ({
      page,
    }) => {
      const mediaRequests = captureLandingMediaRequests(page);
      const media = page.getByTestId("field-guide-hero-video");
      const response = await page.goto("/", { waitUntil: "domcontentloaded" });

      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      // The hero starts on its own for viewers who allow motion, so there is
      // no play control and the element is present from first paint.
      await expect(media.locator("video")).toBeVisible();
      await expect(
        media.getByRole("button", { name: "Play demo" }),
      ).toHaveCount(0);
      await expect
        .poll(() =>
          [HERO_POSTER_PATH, HERO_VIDEO_PATH, WALKTHROUGH_VIDEO_PATH].every(
            (assetPath) => mediaRequests.includes(assetPath),
          ),
        )
        .toBe(true);

      const uniqueMedia = [...new Set(mediaRequests)];
      expect(uniqueMedia).toEqual(
        expect.arrayContaining([
          HERO_POSTER_PATH,
          HERO_VIDEO_PATH,
          WALKTHROUGH_VIDEO_PATH,
        ]),
      );
      expect(
        uniqueMedia.every((assetPath) =>
          ALLOWED_FIRST_LOAD_MEDIA.has(assetPath),
        ),
      ).toBe(true);
      // Budget distinct assets, not raw requests. A local `next start` answers
      // each video with range requests and fetches it twice, where a CDN serves
      // it once, so the raw count swings with the environment and sat exactly on
      // the limit. Distinct assets is the cost this guard is actually about.
      expect(uniqueMedia.length).toBeLessThanOrEqual(LANDING_MEDIA_REQUEST_BUDGET);
    });
  });
}

test.describe("Guest landing hero media safety gates", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await mockTelemetry(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Landing hero media safety gates",
    });
  });

  test("does not request autoplay video with reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const mediaRequests = captureLandingMediaRequests(page);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await expect(
      page.getByTestId("field-guide-hero-video").getByRole("button", {
        name: "Play demo",
      }),
    ).toBeVisible();
    expect(mediaRequests).not.toContain(HERO_VIDEO_PATH);
  });

  test("does not request autoplay video when Save-Data is enabled", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "4g" },
      });
    });
    const mediaRequests = captureLandingMediaRequests(page);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await expect(
      page.getByTestId("field-guide-hero-video").getByRole("button", {
        name: "Play demo",
      }),
    ).toBeVisible();
    expect(mediaRequests).not.toContain(HERO_VIDEO_PATH);
  });
});

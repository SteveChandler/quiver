import { test, expect } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

test.describe("Guest cam funnel analytics", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Guest cam funnel analytics",
    });
  });

  for (const route of [
    {
      path: "/cams",
      pageName: "cams",
      surface: "cams-directory",
      sourceGroup: "cams-directory",
      camFamily: "cams-directory",
    },
    {
      path: "/surf-cams/san-diego",
      pageName: "surf_cams",
      surface: "surf-cams-seo",
      sourceGroup: "surf-cams-seo",
      camFamily: "surf-cams-seo",
    },
  ] as const) {
    test(`${route.path} emits cam page_view metadata`, async ({ page }) => {
      const eventsCaptured: any[] = [];
      await page.route("**/_next/image?**", async (requestRoute) => {
        await requestRoute.fulfill({
          status: 200,
          contentType: "image/png",
          body: ONE_PIXEL_PNG,
        });
      });
      await page.route("**/api/events", async (requestRoute) => {
        const request = requestRoute.request();
        if (request.method() === "POST") {
          try {
            eventsCaptured.push(JSON.parse(request.postData() || "{}"));
          } catch {}
        }
        await requestRoute.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto(route.path);
      await page.waitForLoadState("load");

      await expect
        .poll(() => eventsCaptured, { timeout: 5_000 })
        .toContainEqual(
          expect.objectContaining({
            eventType: "page_view",
            metadata: expect.objectContaining({
              page: route.pageName,
              pathname: route.path,
              surface: route.surface,
              source_group: route.sourceGroup,
              cam_family: route.camFamily,
              platform: "web",
            }),
          })
        );
    });
  }
});

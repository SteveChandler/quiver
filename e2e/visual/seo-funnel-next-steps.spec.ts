import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "../utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const SEO_FUNNEL_ROUTES = [
  {
    slug: "water-temp",
    path: "/water-temp/huntington-beach",
    expectedLink: /live Huntington Beach spots/i,
  },
  {
    slug: "best-time",
    path: "/best-time-to-surf/westport",
    expectedLink: /live Westport spots/i,
  },
  {
    slug: "state-hub",
    path: "/beaches/usa/ca",
    expectedLink: /California surf cities/i,
  },
] as const;

async function expectNonOverlappingLinks(section: Locator): Promise<void> {
  const links = section.getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(3);

  const boxes = [];
  for (let i = 0; i < Math.min(count, 4); i += 1) {
    const link = links.nth(i);
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();

    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(80);
    expect(box!.height).toBeGreaterThan(20);
    boxes.push(box!);
  }

  for (let i = 1; i < boxes.length; i += 1) {
    const previous = boxes[i - 1];
    const current = boxes[i];
    const verticalGap = current.y - (previous.y + previous.height);
    const sameRow = Math.abs(current.y - previous.y) < 4;

    expect(sameRow || verticalGap >= -2).toBe(true);
  }
}

async function attachSectionScreenshot(
  page: Page,
  section: Locator,
  name: string
): Promise<void> {
  await section.scrollIntoViewIfNeeded();
  const screenshot = await section.screenshot({ animations: "disabled" });
  expect(screenshot.length).toBeGreaterThan(5_000);

  await test.info().attach(name, {
    body: screenshot,
    contentType: "image/png",
  });

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
}

test.describe("SEO funnel next steps visual validation", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "SEO funnel next steps visual validation",
    });
  });

  for (const viewport of VIEWPORTS) {
    for (const route of SEO_FUNNEL_ROUTES) {
      test(`${route.slug} renders scannable next steps on ${viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(route.path);
        await page.waitForLoadState("load");

        const section = page.getByTestId("seo-funnel-next-steps");
        await expect(section).toBeVisible({ timeout: 15_000 });
        await expect(section.getByRole("link", { name: route.expectedLink })).toBeVisible();

        const box = await section.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(viewport.name === "mobile" ? 320 : 900);
        expect(box!.height).toBeGreaterThan(140);

        await expectNonOverlappingLinks(section);
        await attachSectionScreenshot(
          page,
          section,
          `${route.slug}-${viewport.name}.png`
        );
      });
    }
  }

  test("homepage emits a page_view event for /", async ({ page }) => {
    const eventsCaptured: unknown[] = [];
    await page.route("**/api/events", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        eventsCaptured.push(JSON.parse(request.postData() || "{}"));
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("load");

    await expect
      .poll(() => eventsCaptured, { timeout: 5_000 })
      .toContainEqual(
        expect.objectContaining({
          eventType: "page_view",
          metadata: expect.objectContaining({
            page: "landing",
            pathname: "/",
          }),
        })
      );
  });
});

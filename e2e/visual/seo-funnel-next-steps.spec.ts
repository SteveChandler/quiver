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

type NextStepsSurface = "seo-funnel" | "utility-handoff";

interface SeoFunnelRoute {
  slug: string;
  path: string;
  expectedLink: RegExp;
  surface: NextStepsSurface;
  sectionName?: RegExp;
}

const SEO_FUNNEL_ROUTES = [
  {
    slug: "water-temp",
    path: "/water-temp/huntington-beach",
    expectedLink: /Open live Huntington Beach conditions/i,
    surface: "utility-handoff",
    sectionName: /Use water temperature to pick gear/i,
  },
  {
    slug: "best-time",
    path: "/best-time-to-surf/huntington-beach",
    expectedLink: /Find the best current Huntington Beach window/i,
    surface: "seo-funnel",
  },
  {
    slug: "state-hub",
    path: "/beaches/usa/ca",
    expectedLink: /California surf cities/i,
    surface: "seo-funnel",
  },
  {
    slug: "city-guide",
    path: "/beaches/usa/ca/huntington-beach",
    expectedLink: /Find the best surf window/i,
    surface: "seo-funnel",
  },
  {
    slug: "generic-intent-state",
    path: "/beginner/ca",
    expectedLink: /California surf cities/i,
    surface: "seo-funnel",
  },
] as const satisfies readonly SeoFunnelRoute[];

async function expectPaperTheme(page: Page, section: Locator): Promise<void> {
  const pageRoot = page.locator(".seo-paper-page").first();
  await expect(pageRoot).toBeVisible();

  const pageStyles = await pageRoot.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundImage: styles.backgroundImage,
      color: styles.color,
    };
  });

  expect(pageStyles.backgroundImage).toContain("gradient");
  expect(pageStyles.color).toBe("rgb(17, 16, 13)");

  const firstCard = section.getByRole("link").first();
  const cardStyles = await firstCard.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderTopColor,
    };
  });

  expect(cardStyles.backgroundColor).toContain("251, 246, 232");
  expect(cardStyles.borderColor).not.toBe("rgb(64, 76, 146)");
}

async function expectUtilityHandoffTheme(page: Page, section: Locator): Promise<void> {
  const pageRoot = page.locator(".seo-paper-page").first();
  await expect(pageRoot).toBeVisible();

  const sectionStyles = await section.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderTopColor,
      color: styles.color,
    };
  });

  expect(sectionStyles.backgroundColor).toContain("251, 246, 232");
  expect(sectionStyles.borderColor).not.toBe("rgb(64, 76, 146)");
  expect(sectionStyles.color).toBe("rgb(17, 16, 13)");
}

function getNextStepsSection(page: Page, route: SeoFunnelRoute): Locator {
  if (route.surface === "utility-handoff") {
    if (!route.sectionName) {
      throw new Error(`Missing utility handoff section name for ${route.slug}`);
    }
    return page.getByRole("region", { name: route.sectionName });
  }

  return page.getByTestId("seo-funnel-next-steps").first();
}

async function expectRouteTheme(
  page: Page,
  section: Locator,
  route: SeoFunnelRoute
): Promise<void> {
  if (route.surface === "utility-handoff") {
    await expectUtilityHandoffTheme(page, section);
    return;
  }

  await expectPaperTheme(page, section);
}

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
      test(`${route.slug} renders scannable next steps on ${viewport.name} @requires-data`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(route.path);
        await page.waitForLoadState("load");

        const section = getNextStepsSection(page, route);
        await expect(section).toBeVisible({ timeout: 15_000 });
        await expect(section.getByRole("link", { name: route.expectedLink })).toBeVisible();

        const box = await section.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(viewport.name === "mobile" ? 320 : 900);
        expect(box!.height).toBeGreaterThan(140);

        await expectNonOverlappingLinks(section);
        await expectRouteTheme(page, section, route);
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

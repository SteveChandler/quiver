/**
 * Beginner community-search launch coverage.
 *
 * @project guest
 */

import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const ROUTES = {
  beginner: "/beginner/huntington-beach",
  paddling: "/learn/surf-paddling-for-beginners",
  usOpen: "/us-open-of-surfing-forecast",
} as const;

async function gotoPublicPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} should return 200`).toBe(200);
  await page.waitForLoadState("load");
}

async function expectCanonicalPath(page: Page, expectedPath: string) {
  const href = await page
    .locator('link[rel="canonical"]')
    .first()
    .getAttribute("href");

  expect(href).toBeTruthy();
  expect(new URL(href!, page.url()).pathname).toBe(expectedPath);
}

async function expectValidJsonLd(page: Page): Promise<void> {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();

  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    expect(() => JSON.parse(script)).not.toThrow();
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
  }
}

test.describe("Beginner community SEO pages", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Beginner community SEO pages",
    });
  });

  test("Huntington Beach answers the beginner decision first and keeps the alert CTA", async ({
    page,
  }) => {
    await gotoPublicPage(page, ROUTES.beginner);

    await expect(
      page.getByRole("heading", {
        name: "Beginner Surf Spots in Huntington Beach",
        level: 1,
      }),
    ).toBeVisible();
    const decision = page.getByRole("region", {
      name: /beginner session call for huntington beach/i,
    });
    await expect(
      decision.getByRole("heading", {
        name: "Can a beginner surf here today?",
      }),
    ).toBeVisible();
    await expect(decision).toContainText(/YES|MAYBE|NO/);
    await expect(decision).toContainText(/Wave size/);
    await expect(decision).toContainText(/Wind/);
    await expect(decision).toContainText(/Tide/);
    await expect(decision).toContainText(/Time window/);
    await expect(page.getByTestId("alert-capture-cta")).toBeVisible();

    await expectCanonicalPath(page, ROUTES.beginner);
    await expectValidJsonLd(page);
    await expectNoHorizontalOverflow(page);
  });

  test("paddling guide renders its difficulty insert and beginner routes", async ({
    page,
  }) => {
    await gotoPublicPage(page, ROUTES.paddling);

    await expect(
      page.getByRole("heading", {
        name: "Surf Paddling for Beginners: Technique & Paddle-Out Guide",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Paddling Difficulty Near You Today",
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/beginner/huntington-beach"]').first(),
    ).toBeVisible();

    await expectCanonicalPath(page, ROUTES.paddling);
    await expectValidJsonLd(page);
    await expectNoHorizontalOverflow(page);
  });

  test("US Open utility exposes Huntington conditions and sitemap ownership", async ({
    page,
    request,
  }) => {
    await gotoPublicPage(page, ROUTES.usOpen);

    await expect(
      page.getByRole("heading", {
        name: "US Open of Surfing Forecast",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Huntington Beach conditions",
        level: 2,
      }),
    ).toBeVisible();
    for (const label of [
      "Waves",
      "Wind",
      "Tide",
      "Water temperature",
      "Watch window",
    ]) {
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: /check beginner conditions/i }),
    ).toHaveAttribute("href", ROUTES.beginner);

    const hrefs = await page.locator("a[href]").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
    expect(hrefs.join(" ")).not.toMatch(/cloud-?9|siargao/i);

    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBe(200);
    expect(await sitemapResponse.text()).toContain(
      `${ROUTES.usOpen}</loc>`,
    );

    await expectCanonicalPath(page, ROUTES.usOpen);
    await expectValidJsonLd(page);
    await expectNoHorizontalOverflow(page);
  });
});

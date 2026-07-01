import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const VIEWPORTS = [
  { name: "360px", width: 360, height: 844 },
  { name: "390px", width: 390, height: 844 },
  { name: "412px", width: 412, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

interface HorizontalOverflowReport {
  hasHorizontalOverflow: boolean;
  innerWidth: number;
  scrollWidth: number;
  offenders: Array<{
    className: string;
    left: number;
    right: number;
    tag: string;
    testId: string;
    text: string;
    width: number;
  }>;
}

async function getHorizontalOverflowReport(
  page: Page
): Promise<HorizontalOverflowReport> {
  return page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className:
            typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid") ?? "",
          text: (element.textContent ?? "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 120),
          width: Math.round(rect.width),
        };
      })
      .filter(
        (element) =>
          element.width > 0 &&
          (element.right > innerWidth + 1 || element.left < -1)
      )
      .slice(0, 10);

    return {
      hasHorizontalOverflow: scrollWidth > innerWidth + 1,
      innerWidth,
      scrollWidth,
      offenders,
    };
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  let report = await getHorizontalOverflowReport(page);

  for (let attempt = 0; attempt < 5 && report.hasHorizontalOverflow; attempt += 1) {
    await page.waitForLoadState("networkidle", { timeout: 500 }).catch(() => {});
    report = await getHorizontalOverflowReport(page);
  }

  expect(
    report.hasHorizontalOverflow,
    `Horizontal overflow report: ${JSON.stringify(report, null, 2)}`
  ).toBe(false);
}

async function openPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {
    // Dynamic forecast pages can keep assets pending; visible assertions below
    // prove the route rendered without waiting on every late resource.
  });

  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);
}

async function expectCanonicalPath(page: Page, expectedPath: string): Promise<void> {
  const href = await page.locator('link[rel="canonical"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  const canonical = new URL(href!, page.url());
  expect(canonical.pathname).toBe(expectedPath);
  expect(canonical.search).toBe("");
}

async function expectJsonLd(page: Page): Promise<void> {
  const count = await page.locator('script[type="application/ld+json"]').count();
  expect(count).toBeGreaterThan(0);
}

test.describe("Phase 20 guest Session Intelligence app links and QA", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Phase 20 guest Session Intelligence app links and QA",
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`validates app-link fallback at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await openPage(page, "/app/spot/la-jolla-shores?window=phase20-smoke");
      await expect(
        page.getByRole("heading", {
          name: "La Jolla Shores is ready in Quiver.",
        })
      ).toBeVisible();
      await expect(page.getByText("Window: phase20-smoke")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Open in the App Store" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Continue on web" })
      ).toHaveAttribute("href", "/beach/la-jolla-shores");
      await expectNoHorizontalOverflow(page);
    });

    test(`validates forecast Session Intelligence surface at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await openPage(page, "/forecast");
      await expectCanonicalPath(page, "/forecast");
      await expectJsonLd(page);
      await expect(
        page.getByRole("heading", { name: /San Diego/i }).first()
      ).toBeVisible();
      await expect(page.getByTestId("regional-best-surf-windows")).toBeVisible();
      await expect(page.getByText(/best windows this week/i).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`validates forecast accuracy schema at ${viewport.name} @requires-data`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await openPage(page, "/forecast-accuracy");
      await expectCanonicalPath(page, "/forecast-accuracy");
      await expectJsonLd(page);
      await expect(
        page.getByRole("heading", { name: "Forecast accuracy receipts." })
      ).toBeVisible();
      await expect(page.getByText(/NOAA baseline/i).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`validates best-time intent handoff at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await openPage(page, "/best-time-to-surf/la-jolla");
      await expectCanonicalPath(page, "/best-time-to-surf/la-jolla");
      await expectJsonLd(page);
      await expect(
        page.getByRole("heading", { name: /best time to surf la jolla/i })
      ).toBeVisible();
      const handoff = page.getByRole("region", {
        name: /turn la jolla's season guide into today's surf call/i,
      });
      await expect(handoff).toBeVisible();
      await expect(
        handoff.getByRole("link", { name: /open live .* conditions/i })
      ).toBeVisible();
      await expect(handoff.locator('a[href="/forecast"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

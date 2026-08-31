import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
}

async function openCheckedPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("load");
  await expectCanonicalPath(page, path);
  await expectJsonLd(page);
  await expectNoHorizontalOverflow(page);
}

async function expectCanonicalPath(page: Page, expectedPath: string): Promise<void> {
  const href = await page.locator('link[rel="canonical"]').first().getAttribute("href");
  expect(href).toBeTruthy();

  const canonical = new URL(href!, page.url());
  expect(canonical.pathname).toBe(expectedPath);
}

async function expectJsonLd(page: Page): Promise<void> {
  const scriptCount = await page
    .locator('script[type="application/ld+json"]')
    .count();
  expect(scriptCount).toBeGreaterThan(0);
}

async function expectHandoffLinks(
  region: Locator,
  expectedHrefs: string[]
): Promise<void> {
  const links = region.getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(3);

  for (const href of expectedHrefs) {
    await expect(region.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
}

test.describe("Phase 18 guest SEO-safe Session Intelligence rollout", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Phase 18 guest SEO-safe Session Intelligence rollout",
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`sampled routes stay public and crawlable on ${viewport.name} @requires-data`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await openCheckedPage(page, "/longboard/san-diego");
      await expect(
        page.getByRole("heading", {
          name: /today's longboard plan in san diego/i,
        })
      ).toBeVisible();
      await expect(page.getByText(/best window/i).first()).toBeVisible();
      await expect(
        page.getByText(/sign in to reveal exact windows/i)
      ).toHaveCount(0);
      const genericHandoff = page.getByRole("region", {
        name: /turn this guide into today's surf call/i,
      });
      await expect(genericHandoff).toBeVisible();
      await expectHandoffLinks(genericHandoff, [
        "/ca/san-diego",
        "/tide/san-diego",
        "/best-time-to-surf/san-diego",
        "/forecast",
      ]);

      await openCheckedPage(page, "/beginner/huntington-beach");
      const beginnerDecision = page.getByRole("region", {
        name: /beginner session call for huntington beach/i,
      });
      await expect(beginnerDecision).toBeVisible();
      await expect(beginnerDecision).toContainText(/check the tide/i);
      await expectHandoffLinks(beginnerDecision, [
        "/ca/huntington-beach",
        "/tide/huntington-beach",
        "/best-time-to-surf/huntington-beach",
      ]);

      await openCheckedPage(page, "/water-temp/huntington-beach");
      await expect(
        page.getByRole("heading", { name: /water temperature/i }).first()
      ).toBeVisible();
      const waterTempHandoff = page.getByRole("region", {
        name: /use water temperature to pick gear/i,
      });
      await expect(waterTempHandoff).toBeVisible();
      await expect(waterTempHandoff).toContainText(/wetsuit/i);
      await expect(
        waterTempHandoff.getByRole("heading", {
          name: /use water temperature to pick gear/i,
        })
      ).not.toContainText(/surf report/i);
      await expectHandoffLinks(waterTempHandoff, [
        "/ca/huntington-beach",
        "/tide/huntington-beach",
        "/best-time-to-surf/huntington-beach",
        "/forecast",
      ]);

      await openCheckedPage(page, "/tide/san-diego");
      await expect(page.getByRole("heading", { name: /tide/i }).first()).toBeVisible();
      const tideHandoff = page.getByRole("region", {
        name: /turn the tide chart into a surf call/i,
      });
      await expect(tideHandoff).toBeVisible();
      await expectHandoffLinks(tideHandoff, [
        "/ca/san-diego",
        "/water-temp/san-diego",
        "/best-time-to-surf/san-diego",
        "/forecast",
      ]);

      await openCheckedPage(page, "/dawn-patrol/san-diego");
      await expect(page.getByText(/first light/i).first()).toBeVisible();
      const dawnHandoff = page.getByRole("region", {
        name: /pair first light with live conditions/i,
      });
      await expect(dawnHandoff).toBeVisible();
      await expectHandoffLinks(dawnHandoff, [
        "/ca/san-diego",
        "/tide/san-diego",
        "/best-time-to-surf/san-diego",
        "/forecast",
      ]);

      await openCheckedPage(page, "/best-time-to-surf/la-jolla");
      await expect(
        page.getByRole("heading", { name: /best time to surf la jolla/i })
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: /surf score by month/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /monthly breakdown/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /open live/i }).first()).toBeVisible();
      await expect(page.locator('a[href="/forecast"]').first()).toBeVisible();

      await openCheckedPage(
        page,
        "/ca/malibu/malibu-surfrider-first-point-malibu-ca"
      );
      await expect(
        page.getByRole("heading", {
          name: "Malibu Surfrider (First Point)",
          exact: true,
        })
      ).toBeVisible();

      await expect(page.getByTestId("session-intelligence-pilot")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /best surf windows at/i })).toHaveCount(0);
      await expect(page.locator('a[href="/surf-report/malibu-today"]')).toHaveCount(0);
    });
  }
});

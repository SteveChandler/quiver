/**
 * Smoke coverage for updated public SEO surfaces.
 *
 * @project guest
 */

import { test, expect, type Page } from "@playwright/test";

import { learnArticles } from "../lib/data/learn-articles";
import { getSeoFunnelPageByTypeAndSlug } from "../lib/seo/funnel-pages";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const UPDATED_LEARN_SLUGS = [
  "how-to-read-surf-conditions",
  "swell-period-explained",
  "best-surf-conditions-for-beginners",
  "offshore-vs-onshore-wind-surfing",
  "how-accurate-are-surf-forecasts",
  "best-time-of-day-to-surf",
  "why-waves-better-in-morning",
  "is-it-safe-to-surf-after-rain",
  "how-do-tides-work",
] as const;

const UPDATED_SURF_REPORT_SLUGS = [
  "scripps-pier-today",
  "belmar-today",
  "tourmaline-today",
  "newport-beach-today",
  "malibu-today",
] as const;

const UPDATED_BEST_TIME_PAGES = [
  {
    path: "/best-time-to-surf/la-jolla",
    title: "Best Time to Surf La Jolla: Shores, Scripps & Wind",
    h1: "Best Time to Surf La Jolla Today",
    surfReportLabel: "Open today's Scripps Pier surf report",
    surfReportHref: "/surf-report/scripps-pier-today",
  },
  {
    path: "/best-time-to-surf/newport-beach",
    title: "Best Time to Surf Newport Beach: Season & Today",
    h1: "Best Time to Surf Newport Beach Today",
    surfReportLabel: "Open today's Newport Beach surf report",
    surfReportHref: "/surf-report/newport-beach-today",
  },
  {
    path: "/best-time-to-surf/malibu",
    title: "Best Time to Surf Malibu: Tide, Season & Crowd",
    h1: "Best Time to Surf Malibu Today",
    surfReportLabel: "Open today's Malibu surf report",
    surfReportHref: "/surf-report/malibu-today",
  },
] as const;

async function gotoPublicPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} should load`).toBeLessThan(400);
  await page.waitForLoadState("load");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Updated SEO public surfaces", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Updated SEO public surfaces",
    });
  });

  test("/vs/surfline targets alternative intent without free positioning", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/vs/surfline");

    await expect(page).toHaveTitle(/Surfline Alternative: Quiver vs Surfline/);
    await expect(
      page.getByRole("heading", {
        name: "Surfline Alternative: Quiver vs Surfline",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText("Included").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\bfree\b/i);
  });

  for (const slug of UPDATED_SURF_REPORT_SLUGS) {
    const seoPage = getSeoFunnelPageByTypeAndSlug("surf-report-today", slug);

    test(`/surf-report/${slug} renders condition-page SEO framing`, async ({
      page,
    }) => {
      expect(seoPage, `${slug} SEO config should exist`).toBeTruthy();

      await gotoPublicPage(page, `/surf-report/${slug}`);

      await expect(page).toHaveTitle(new RegExp(escapeRegExp(seoPage!.title)));
      await expect(
        page.getByRole("heading", { name: seoPage!.h1, level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: `${seoPage!.locationName} conditions right now`,
          level: 2,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Should you surf today?",
          level: 2,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "When this spot is worth it", level: 2 }),
      ).toBeVisible();
    });
  }

  for (const bestTimePage of UPDATED_BEST_TIME_PAGES) {
    test(`${bestTimePage.path} renders refreshed CTR framing and surf-report owner link`, async ({
      page,
    }) => {
      await gotoPublicPage(page, bestTimePage.path);

      await expect(page).toHaveTitle(new RegExp(escapeRegExp(bestTimePage.title)));
      await expect(
        page.getByRole("heading", { name: bestTimePage.h1, level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: bestTimePage.surfReportLabel }).first(),
      ).toHaveAttribute("href", bestTimePage.surfReportHref);
    });
  }

  for (const slug of UPDATED_LEARN_SLUGS) {
    const article = learnArticles.find((item) => item.slug === slug);

    test(`/learn/${slug} renders updated zero-click article title`, async ({
      page,
    }) => {
      expect(article, `${slug} article should exist`).toBeTruthy();

      await gotoPublicPage(page, `/learn/${slug}`);

      await expect(page).toHaveTitle(new RegExp(escapeRegExp(article!.title)));
      await expect(
        page.getByRole("heading", { name: article!.title, level: 1 }),
      ).toBeVisible();
      await expect(page.getByTestId("learn-article-zine-surface")).toBeVisible();
    });
  }
});

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
  "groundswell-vs-wind-swell",
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
  "la-jolla-today",
  "belmar-today",
  "tourmaline-today",
  "newport-beach-today",
  "malibu-today",
] as const;

const UPDATED_BEST_TIME_PAGES = [
  {
    path: "/best-time-to-surf/la-jolla",
    title: "La Jolla Surf Report Today: Tide, Wind & Swell",
    h1: "Best La Jolla surf window today: tide and conditions",
    surfReportLabel: "Open today's La Jolla surf report",
    surfReportHref: "/surf-report/la-jolla-today",
  },
  {
    path: "/best-time-to-surf/newport-beach",
    title: "Best Newport Beach surf window today: tide & wind",
    h1: "Best Newport Beach surf window today: tide and conditions",
    surfReportLabel: "Open today's Newport Beach surf report",
    surfReportHref: "/surf-report/newport-beach-today",
  },
  {
    path: "/best-time-to-surf/malibu",
    title: "Best Malibu surf window today: tide & wind",
    h1: "Best Malibu surf window today: tide and conditions",
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

  test("/vs/surfline/free targets the free-alternative intent", async ({ page }) => {
    await gotoPublicPage(page, "/vs/surfline/free");
    await expect(page).toHaveTitle(/Free Surfline Alternative/i);
    await expect(page.locator("h1")).toContainText(/free surfline alternative/i);
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/\bfree\b/i);
    expect(body).toMatch(/live cams/i);
  });

  test("/free-surf-reports targets free surf report intent", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/free-surf-reports");

    await expect(page).toHaveTitle(/Free Surf Reports, Forecasts & Conditions/);
    await expect(
      page.getByRole("heading", { name: "Free Surf Reports", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("free-surf-reports-zine-surface")).toBeVisible();
    await expect(page.getByText("279+ beaches").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Check the forecast/i }),
    ).toHaveAttribute("href", "/forecast");
  });

  test("/best-surf-forecast-app renders the source-backed comparison", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/best-surf-forecast-app");

    await expect(page).toHaveTitle(/Best Surf Forecast App by Surf Job in 2026/);
    await expect(
      page.getByRole("heading", {
        name: "Best Surf Forecast App by Surf Job in 2026",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByTestId("best-surf-forecast-app-zine-surface"),
    ).toBeVisible();
    await expect(
      page.getByText("Affiliation disclosure: Quiver is our app."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Surf Captain FAQ" }),
    ).toHaveAttribute("href", "https://surfcaptain.com/faq");
    await expect(
      page.getByRole("link", { name: /Compare Quiver vs Surfline/i }),
    ).toHaveAttribute("href", "/vs/surfline");
    await expect(
      page.getByRole("link", { name: /Read the forecast accuracy method/i }),
    ).toHaveAttribute("href", "/forecast-accuracy");
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
      const openingCopy = page.locator("h1 + p");
      await expect(openingCopy).toContainText(/best surf window/i);
      await expect(openingCopy).toContainText(/tide/i);
      await expect(openingCopy).toContainText(/wind/i);
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

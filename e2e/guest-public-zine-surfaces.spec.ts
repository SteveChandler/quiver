/**
 * Public zine surface checks for learn and regional forecast pages.
 *
 * @project guest
 */

import { test, expect, type Page } from "@playwright/test";

import { learnArticles } from "../lib/data/learn-articles";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const REQUESTED_ARTICLE_SLUGS = [
  "beginner-breaks-santa-cruz",
  "swell-period-explained",
  "offshore-vs-onshore-wind-surfing",
] as const;

async function gotoPublicPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} should load`).toBeLessThan(400);
  await page.waitForLoadState("load");
}

test.describe("Public zine surfaces", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Public zine surfaces",
    });
  });

  test("learn hub uses zine shell and links every learn child", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/learn");

    await expect(page.getByTestId("learn-zine-surface")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Learn to Surf Smarter", level: 1 }),
    ).toBeVisible();
    await expect(page.locator("[data-zine-sticker]").first()).toBeVisible();

    for (const article of learnArticles) {
      await expect(
        page.locator(`a[href="/learn/${article.slug}"]`).first(),
        `learn hub should link ${article.slug}`,
      ).toBeVisible();
    }
  });

  for (const slug of REQUESTED_ARTICLE_SLUGS) {
    const article = learnArticles.find((item) => item.slug === slug);

    test(`learn article ${slug} uses zine article shell`, async ({ page }) => {
      expect(article, `${slug} should exist in learnArticles`).toBeTruthy();

      await gotoPublicPage(page, `/learn/${slug}`);

      await expect(
        page.getByTestId("learn-article-zine-surface"),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: article!.title, level: 1 }),
      ).toBeVisible();
      await expect(page.locator("[data-zine-sticker]").first()).toBeVisible();
      await expect(page.getByTestId("inline-signup-cta")).toBeVisible();
    });
  }

  test("Santa Cruz regional forecast uses zine shell and keeps forecast contract", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/forecast/santa-cruz");

    await expect(page.getByTestId("forecast-zine-surface")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Santa Cruz.*Surf Forecast/i,
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/7-day outlook.*Updated hourly/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Beach Conditions/i, level: 2 }),
    ).toBeVisible();
    await expect(page.locator("[data-zine-sticker]").first()).toBeVisible();
  });

  test("cams hub uses zine shell and links live cam regions", async ({
    page,
  }) => {
    await gotoPublicPage(page, "/cams");

    await expect(page.getByTestId("cams-zine-surface")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Live Surf Cams", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Southern California/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Hawaii/i }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("cam-guide-links")
        .getByRole("link", { name: /San Diego surf cams/i }),
    ).toHaveAttribute("href", "/surf-cams/san-diego");
  });

  test("Southern California cams region uses zine shell", async ({ page }) => {
    await gotoPublicPage(page, "/cams/southern-california");

    await expect(page.getByTestId("cams-region-zine-surface")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Southern California Surf Cams/i,
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "All regions" })).toBeVisible();
    await expect(page.locator('a[href^="/ca/"]').first()).toBeVisible();
  });
});

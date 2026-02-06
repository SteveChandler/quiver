/**
 * E2E Tests for Beginner Page Redesign
 *
 * Tests the beginner-specific page layout with editorial content,
 * live conditions, and modular components.
 *
 * Test Coverage:
 * - Hero section with conditions badge
 * - Right Now conditions grid
 * - Curated spot list with editorial
 * - What to Expect editorial section
 * - Seasonal guide
 * - Safety essentials
 * - Gear & Lessons
 * - FAQ accordion
 * - SEO structured data (FAQSchema, Breadcrumbs)
 * - Continue exploring links
 */

import { test, expect } from "@playwright/test";

const PAGE_LOAD_TIMEOUT = 15000;

test.describe("Beginner page - San Diego", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
  });

  test("should render hero with H1 and beginner count", async ({ page }) => {
    const hero = page.locator("[data-testid='beginner-hero']");
    await expect(hero).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    const h1 = hero.locator("h1");
    await expect(h1).toContainText(/Beginner Surf Spots in San Diego/i);

    // Should show beach count
    await expect(hero).toContainText(/beginner-friendly/i);
  });

  test("should display conditions badge when data available", async ({
    page,
  }) => {
    const hero = page.locator("[data-testid='beginner-hero']");
    await expect(hero).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    // Conditions badge may or may not be visible depending on forecast data
    // If visible, it should have the expected structure
    const badge = hero.locator("text=/Great for Beginners|Fair for Beginners|Challenging Today/i");
    const badgeCount = await badge.count();

    if (badgeCount > 0) {
      await expect(badge.first()).toBeVisible();
    }
  });

  test("should render right now conditions when available", async ({
    page,
  }) => {
    const section = page.locator("[data-testid='right-now-conditions']");
    const sectionCount = await section.count();

    if (sectionCount > 0) {
      await expect(section).toBeVisible();
      await expect(section.locator("h2")).toContainText(/Right Now/i);

      // Should show at least one metric
      await expect(section.locator("text=/ft|mph|Calm/i").first()).toBeVisible();
    }
  });

  test("should render beginner spot list with beaches", async ({ page }) => {
    const section = page.locator("[data-testid='beginner-spot-list']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(
      /Best Beginner Breaks/i
    );

    // Should have at least one beach card
    const spotCards = section.locator(
      "div.rounded-xl.border"
    );
    await expect(spotCards.first()).toBeVisible();

    // First spot should have a name link
    const firstSpotLink = spotCards.first().locator("a");
    await expect(firstSpotLink.first()).toBeVisible();
  });

  test("should render seasonal guide section", async ({ page }) => {
    const section = page.locator("[data-testid='seasonal-guide']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(
      /Best Months for Beginner/i
    );

    // Should have 4 season cards
    const seasonCards = section.locator(
      "text=/Spring|Summer|Fall|Winter/"
    );
    await expect(seasonCards).toHaveCount(4);
  });

  test("should render safety essentials with 4 tips", async ({ page }) => {
    const section = page.locator("[data-testid='safety-essentials']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(/Safety Tips/i);

    // Should have 4 safety tip cards
    const tipCards = section.locator("h3");
    await expect(tipCards).toHaveCount(4);
  });

  test("should render gear and lessons section", async ({ page }) => {
    const section = page.locator("[data-testid='gear-and-lessons']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(/Gear/i);

    // Board guide and wetsuit guide
    await expect(section.locator("text=/Board Guide/i")).toBeVisible();
    await expect(section.locator("text=/Wetsuit Guide/i")).toBeVisible();
  });

  test("should render FAQ section with expandable items", async ({ page }) => {
    const section = page.locator("[data-testid='beginner-faq']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(
      /Frequently Asked Questions/i
    );

    // Should have FAQ items
    const faqItems = section.locator("details");
    const count = await faqItems.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Click to expand first FAQ
    await faqItems.first().locator("summary").click();
    const answer = faqItems.first().locator("div");
    await expect(answer).toBeVisible();
  });

  test("should render session gallery placeholder", async ({ page }) => {
    const section = page.locator("[data-testid='session-gallery']");
    await expect(section).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(section.locator("h2")).toContainText(/Recent Beginner/i);
  });

  test("should have continue exploring links", async ({ page }) => {
    const continueSection = page.locator("text=/Continue exploring/i");
    await expect(continueSection).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    // Should have links to tide, water-temp, and least-crowded pages
    await expect(page.locator("a[href*='/tide/san-diego']")).toBeVisible();
    await expect(
      page.locator("a[href*='/water-temp/san-diego']")
    ).toBeVisible();
    await expect(
      page.locator("a[href*='/least-crowded/san-diego']")
    ).toBeVisible();
  });

  test("should have breadcrumb navigation", async ({ page }) => {
    const breadcrumb = page.locator("nav[aria-label='breadcrumb']");
    await expect(breadcrumb).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    await expect(breadcrumb.locator("text=/Back to San Diego/i")).toBeVisible();
    await expect(
      breadcrumb.locator("text=/Beginner Spots/i")
    ).toBeVisible();
  });

  test("should include FAQSchema structured data", async ({ page }) => {
    const faqScript = page.locator(
      'script[type="application/ld+json"]'
    );
    const scripts = await faqScript.allTextContents();
    const hasFaqSchema = scripts.some((text) =>
      text.includes("FAQPage")
    );
    expect(hasFaqSchema).toBe(true);
  });

  test("should include BreadcrumbList structured data", async ({ page }) => {
    const scripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const hasBreadcrumb = scripts.some((text) =>
      text.includes("BreadcrumbList")
    );
    expect(hasBreadcrumb).toBe(true);
  });
});

test.describe("Beginner page - SEO metadata", () => {
  test("should have correct title and meta description", async ({ page }) => {
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    const title = await page.title();
    expect(title.toLowerCase()).toContain("beginner");
    expect(title.toLowerCase()).toContain("san diego");

    const metaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(metaDesc?.toLowerCase()).toContain("beginner");
  });
});

test.describe("Beginner page - Mobile responsive", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("should render properly on mobile", async ({ page }) => {
    await page.goto("/beginner/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    const hero = page.locator("[data-testid='beginner-hero']");
    await expect(hero).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    const h1 = hero.locator("h1");
    await expect(h1).toBeVisible();

    // Spot list should be visible
    const spotList = page.locator("[data-testid='beginner-spot-list']");
    await expect(spotList).toBeVisible();
  });
});

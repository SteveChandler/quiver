/**
 * E2E tests for Forecast Hub Landing Page
 *
 * Tests the main forecast index page at /forecast that displays
 * regional forecast cards and navigation to detailed forecasts.
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad, dismissOnboardingWizard } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";
import { TIMEOUTS } from "./fixtures/test-data";

test.describe("Forecast Hub Landing Page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto("/forecast");
    await waitForPageLoad(page);
    await dismissOnboardingWizard(page);
  });

  test("should load and display page title", async ({ page }) => {
    // Check hero heading
    await expect(
      page.getByRole("heading", { name: "Surf Forecast", level: 1 })
    ).toBeVisible();

    // Check subtitle
    await expect(
      page.getByText(/7-day forecasts for every region/i)
    ).toBeVisible();
  });

  test("should display today's date", async ({ page }) => {
    // Check that the date element is visible
    const dateElement = page.locator("time");
    await expect(dateElement).toBeVisible();

    // Verify it has a datetime attribute (ISO format)
    const datetime = await dateElement.getAttribute("datetime");
    expect(datetime).toBeTruthy();
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test("should display regional forecast cards grouped by region", async ({ page }) => {
    // Wait for cards to load
    await waitForPageLoad(page);

    // Check section heading
    await expect(
      page.getByRole("heading", { name: /Choose Your Region/i })
    ).toBeVisible();

    // Check that group headings are visible
    for (const group of ["California", "Pacific", "East Coast", "International"]) {
      await expect(
        page.getByRole("heading", { name: group, level: 3 })
      ).toBeVisible();
    }

    // Check that at least one regional card is visible
    // Cards should link to /forecast/[region]
    const cards = page.locator('a[href^="/forecast/"]');
    const cardCount = await cards.count();

    // Should have multiple region cards (at least Southern California, Puerto Rico, etc.)
    expect(cardCount).toBeGreaterThan(0);

    // Verify first card has expected structure
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
  });

  test("should display best conditions section when data available", async ({
    page,
  }) => {
    // This section may not always be visible (depends on forecast data)
    // The heading varies: "Your Local Forecast" (with location) or "Best Conditions Today" (without)
    const localForecast = page.getByText(/Your Local Forecast/i);
    const bestConditions = page.getByText(/Best Conditions Today/i);

    const localVisible = await localForecast.isVisible().catch(() => false);
    const globalVisible = await bestConditions.isVisible().catch(() => false);

    if (localVisible || globalVisible) {
      // Should have a link to a forecast region
      const regionLink = page.locator('a[href^="/forecast/"]').first();
      await expect(regionLink).toBeVisible();
    }
  });

  test("should display regional surf guides section", async ({ page }) => {
    // Check section heading
    await expect(
      page.getByRole("heading", { name: /Regional Surf Guides/i })
    ).toBeVisible();

    // Check that guide links are present
    const guideLinks = page.locator('a[href^="/guides/surfing-"]');
    const guideCount = await guideLinks.count();

    expect(guideCount).toBeGreaterThan(0);

    // Verify first guide link structure
    const firstGuide = guideLinks.first();
    await expect(firstGuide).toBeVisible();
    await expect(firstGuide).toContainText(/Guide/i);
  });

  test("should have SEO metadata", async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/Surf Forecast.*Quiver/i);

    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    const description = await metaDescription.getAttribute("content");
    expect(description).toBeTruthy();
    expect(description).toMatch(/forecast/i);

    // No errors during page load
    await assertNoErrors(page, errorCapture, { context: "SEO metadata check" });
  });

  test("should have structured data", async ({ page }) => {
    // Check for JSON-LD structured data
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();

    // Should have at least breadcrumb and WebPage schema
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify WebPage schema
    const scripts = await jsonLd.all();
    let foundWebPage = false;

    for (const script of scripts) {
      const content = await script.textContent();
      if (content && content.includes('"@type":"WebPage"')) {
        foundWebPage = true;
        const schema = JSON.parse(content);
        expect(schema["@context"]).toBe("https://schema.org");
        expect(schema["@type"]).toBe("WebPage");
        expect(schema.name).toBeTruthy();
        expect(schema.url).toContain("/forecast");
      }
    }

    expect(foundWebPage).toBe(true);
  });

  test("should navigate to regional forecast page", async ({ page }) => {
    // Click first regional card
    const firstCard = page.locator('a[href^="/forecast/"]').first();
    await expect(firstCard).toBeVisible({ timeout: TIMEOUTS.medium });
    const href = await firstCard.getAttribute("href");

    await firstCard.click();
    await waitForPageLoad(page);

    // Should navigate to regional forecast page
    await page.waitForURL((url) => url.href.includes(href!), {
      timeout: TIMEOUTS.medium,
    });
    expect(page.url()).toContain(href!);

    // No errors after navigation
    await assertNoErrors(page, errorCapture, { context: "Regional forecast navigation" });
  });

  test("should navigate to surf guide page", async ({ page }) => {
    // Scroll to guides section
    await page
      .getByRole("heading", { name: /Regional Surf Guides/i })
      .scrollIntoViewIfNeeded();

    // Click first guide link
    const firstGuide = page.locator('a[href^="/guides/surfing-"]').first();
    await expect(firstGuide).toBeVisible({ timeout: TIMEOUTS.medium });
    const href = await firstGuide.getAttribute("href");

    await firstGuide.click();
    await waitForPageLoad(page);

    // Should navigate to guide page
    await page.waitForURL((url) => url.href.includes("/guides/surfing-"), {
      timeout: TIMEOUTS.medium,
    });
    expect(page.url()).toContain(href!);

    // No errors after navigation
    await assertNoErrors(page, errorCapture, { context: "Surf guide navigation" });
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await waitForPageLoad(page);

    // Check hero is visible
    await expect(
      page.getByRole("heading", { name: "Surf Forecast", level: 1 })
    ).toBeVisible();

    // Check cards are stacked vertically (grid should be 1 column on mobile)
    const cards = page.locator('a[href^="/forecast/"]');
    const firstCard = cards.first();
    const secondCard = cards.nth(1);

    await expect(firstCard).toBeVisible();

    // Get positions to verify vertical stacking
    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    if (firstBox && secondBox) {
      // Second card should be below first card (not side-by-side)
      expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
    }
  });

  test("should have accessible navigation", async ({ page }) => {
    // Check heading hierarchy
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1); // Should only have one h1

    // Check links have proper text (only visible links in main content)
    const mainLinks = page.locator("main a").locator("visible=true");
    const linkCount = await mainLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Sample first few links to ensure they have text or aria-label
    const samplesToCheck = Math.min(linkCount, 5);
    for (let i = 0; i < samplesToCheck; i++) {
      const link = mainLinks.nth(i);
      const text = (await link.textContent()) || "";
      const ariaLabel = (await link.getAttribute("aria-label")) || "";

      // Links should have either text content or aria-label
      expect(text.trim() || ariaLabel.trim()).toBeTruthy();
    }

    // No errors during accessibility check
    await assertNoErrors(page, errorCapture, { context: "Accessibility check" });
  });

  test("should display CTA section", async ({ page }) => {
    // Scroll to CTA
    await page
      .getByRole("heading", { name: /Track Your Sessions & Spots/i })
      .scrollIntoViewIfNeeded();

    // Check CTA heading
    await expect(
      page.getByRole("heading", { name: /Track Your Sessions & Spots/i })
    ).toBeVisible();

    // Check CTA description
    await expect(
      page.getByText(/Sign up to log sessions/i)
    ).toBeVisible();

    // Check CTA button/link
    const ctaButton = page.getByRole("link", { name: /Sign Up for Free/i });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute("href", "/auth/sign-up");
  });
});

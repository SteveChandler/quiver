/**
 * E2E Tests for Intent State and City Routes
 *
 * Tests the /[intent]/[state]/ and /[intent]/[state]/[city]/ routes.
 * These routes provide intent-specific surf spot pages organized by state and city.
 *
 * Note: City routes redirect to /beaches/[intent]/[state]/[city]/
 *
 * Test Coverage:
 * - State pages load correctly with valid intents
 * - City pages load correctly (via redirect) with valid intents and states
 * - 404 handling for invalid intents and states
 * - Content structure verification
 */

import { test, expect } from "@playwright/test";

const PAGE_LOAD_TIMEOUT = 10000;

test.describe("Intent State Routes - /[intent]/[state]/", () => {
  test("should load California beginner state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page).not.toHaveURL(/404/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/California/i);
    await expect(heading).toContainText(/beginner/i);
  });

  test("should load Hawaii tide state page", async ({ page }) => {
    await page.goto("/tide/hi", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page).not.toHaveURL(/404/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Hawaii/i);
  });

  test("should load Oregon longboard state page", async ({ page }) => {
    await page.goto("/longboard/or", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page).not.toHaveURL(/404/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Oregon/i);
  });

  test("should return 404 for invalid intent", async ({ page }) => {
    const response = await page.goto("/invalid-intent/ca");
    expect(response?.status()).toBe(404);
  });

  test("should return 404 for invalid state", async ({ page }) => {
    const response = await page.goto("/beginner/zz");
    expect(response?.status()).toBe(404);
  });

  test("should return 404 for non-surf state", async ({ page }) => {
    // North Dakota is not in the surf state map and returns 404
    const response = await page.goto("/beginner/nd");
    expect(response?.status()).toBe(404);
  });

  test("should display spot count on state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Should show spot count text
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/\d+\s+spot/i);
  });

  test("should display focus points section", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for "What to focus on" section
    const focusSection = page.getByRole("heading", { name: /what to focus on/i });
    await expect(focusSection).toBeVisible();

    // Should have list of focus points
    const focusPoints = page.locator("ul li");
    await expect(focusPoints.first()).toBeVisible();
  });

  test("should not 404 when surf state has no beaches for intent", async ({ page }) => {
    // This test verifies empty state handling exists
    // Using dawn-patrol which may have fewer matches
    const response = await page.goto("/dawn-patrol/or", { timeout: PAGE_LOAD_TIMEOUT });
    expect(response?.status()).toBe(200);
    // Page should either have beaches or show empty state, not 404
    const hasContent = await page.locator("h1").isVisible();
    expect(hasContent).toBe(true);
  });
});

test.describe("Intent City Routes - /[intent]/[state]/[city]/", () => {
  test("should load San Diego beginner city page", async ({ page }) => {
    // Note: This may redirect to /beaches/beginner/ca/san-diego
    await page.goto("/beginner/ca/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    await expect(page).not.toHaveURL(/404/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    // Page title should contain San Diego
    await expect(heading).toContainText(/San Diego/i);
  });

  test("should handle invalid intent in city route", async ({ page }) => {
    // Invalid intent may redirect and show "Location Not Found" page
    await page.goto("/invalid-intent/ca/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    // Should show location not found or 404 content
    const pageContent = await page.textContent("body");
    const isNotFound = pageContent?.toLowerCase().includes("not found") ||
                       pageContent?.toLowerCase().includes("404");
    expect(isNotFound).toBe(true);
  });

  test("should handle invalid state in city route", async ({ page }) => {
    // Invalid state may redirect and show "Location Not Found" page
    await page.goto("/beginner/zz/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    // Should show location not found or 404 content
    const pageContent = await page.textContent("body");
    const isNotFound = pageContent?.toLowerCase().includes("not found") ||
                       pageContent?.toLowerCase().includes("404");
    expect(isNotFound).toBe(true);
  });

  test("should handle nonexistent city gracefully", async ({ page }) => {
    // Navigate to a nonexistent city - may redirect and show "Location Not Found"
    await page.goto("/beginner/ca/nonexistent-city-xyz", { timeout: PAGE_LOAD_TIMEOUT });

    // Should show location not found or 404 content
    const pageContent = await page.textContent("body");
    const isNotFound = pageContent?.toLowerCase().includes("not found") ||
                       pageContent?.toLowerCase().includes("404");
    expect(isNotFound).toBe(true);
  });

  test("should have breadcrumb navigation", async ({ page }) => {
    await page.goto("/beginner/ca/san-diego", { timeout: PAGE_LOAD_TIMEOUT });
    // Look for breadcrumb navigation
    const breadcrumb = page.getByRole("navigation", { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible();
  });
});

test.describe("Intent Routes - Multiple Intents", () => {
  test("should work for all intents with same state", async ({ page }) => {
    const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

    for (const intent of intents) {
      await page.goto(`/${intent}/ca`, { timeout: PAGE_LOAD_TIMEOUT });

      // Should not 404
      await expect(page).not.toHaveURL(/404/);

      // Should have heading
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();

      // Should mention California
      await expect(heading).toContainText(/California/i);
    }
  });

  test("should have different headings for different intents", async ({ page }) => {
    // Load beginner page
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });
    const beginnerHeading = await page.locator("h1").textContent();

    // Load tide page
    await page.goto("/tide/ca", { timeout: PAGE_LOAD_TIMEOUT });
    const tideHeading = await page.locator("h1").textContent();

    // Headings should be different (different intent labels)
    expect(beginnerHeading).not.toBe(tideHeading);
  });
});

test.describe("Intent Routes - SEO", () => {
  test("should have correct page title for state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    const title = await page.title();
    expect(title).toContain("California");
    expect(title.toLowerCase()).toContain("beginner");
  });

  test("should have correct page title for city page", async ({ page }) => {
    await page.goto("/beginner/ca/san-diego", { timeout: PAGE_LOAD_TIMEOUT });

    const title = await page.title();
    expect(title).toContain("San Diego");
  });

  test("should have meta description", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content");

    expect(metaDescription).toBeTruthy();
    expect(metaDescription?.toLowerCase()).toContain("california");
  });

  test("should have proper heading hierarchy on state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Should have exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Should have h2 headings for sections
    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(0);
  });

  test("should have structured data on state page", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Look for JSON-LD structured data
    const structuredData = page.locator('script[type="application/ld+json"]');
    await expect(structuredData.first()).toBeAttached();
  });
});

test.describe("Intent Routes - Accessibility", () => {
  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("should have accessible links", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // All links should have accessible text or aria-label
    const links = await page.getByRole("link").all();
    for (const link of links.slice(0, 10)) {
      // Check first 10 links - accept text, aria-label, or title
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");
      const title = await link.getAttribute("title");
      const hasAccessibleName = (text?.trim().length || 0) > 0 || !!ariaLabel || !!title;
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("should have navigation landmarks", async ({ page }) => {
    await page.goto("/beginner/ca", { timeout: PAGE_LOAD_TIMEOUT });

    // Should have navigation landmark
    const nav = page.getByRole("navigation");
    await expect(nav.first()).toBeVisible();
  });
});

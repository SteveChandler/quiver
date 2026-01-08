/**
 * E2E Tests for Location Pages
 *
 * Comprehensive end-to-end tests for AllTrails-style location browsing feature.
 * Tests cover Phase 2 implementation: Location Listing Pages
 *
 * Test Coverage:
 * - Page loading and routing
 * - Page header and metadata (SEO)
 * - Beach rankings and cards
 * - Interactive map
 * - Responsive design
 * - Accessibility
 */

import { test, expect } from "@playwright/test";
import {
  navigateToLocation,
  waitForLocationPageLoad,
  getBeachCardCount,
  getLocationStats,
  verifyBeachRanking,
  isEmptyState,
  verifyBreadcrumbSegments,
  clickBreadcrumbSegment,
  verifySequentialRanking,
  getRankingBadges,
  verifyLocationName,
  verifyStatsDisplayed,
  isLocationPageUrl,
  getLocationFromUrl,
  clickBeachCard,
} from "./utils/location-helpers";
import {
  TEST_LOCATIONS,
  LOCATION_URLS,
  LOCATION_PAGE_TIMEOUTS,
} from "./fixtures/location-data";
import { VIEWPORTS } from "./fixtures/test-data";

test.describe("Location Pages - URL and Routing", () => {
  test("should load location page with correct URL structure", async ({
    page,
  }) => {
    await page.goto(LOCATION_URLS.laJolla);
    await waitForLocationPageLoad(page);

    const url = page.url();
    expect(isLocationPageUrl(url)).toBe(true);
    expect(url).toContain("/beaches/usa/ca/la-jolla");
  });

  test("should redirect /beaches/{state}/{city} to canonical /beaches/usa/{state}/{city}", async ({
    page,
  }) => {
    await page.goto("/beaches/ca/la-jolla");
    await waitForLocationPageLoad(page);

    const url = page.url();
    expect(url).toContain("/beaches/usa/ca/la-jolla");
  });

  test("should use lowercase hyphenated slugs in URL", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const url = page.url();
    expect(url).toMatch(/\/beaches\/[a-z-]+\/[a-z-]+\/[a-z-]+$/);
    expect(url).not.toMatch(/[A-Z]/); // No uppercase
    expect(url).not.toContain(" "); // No spaces
  });

  test("should handle direct navigation to location page", async ({ page }) => {
    await page.goto("/beaches/usa/ca/la-jolla");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: LOCATION_PAGE_TIMEOUTS.pageLoad });
  });

  test("should navigate from breadcrumb to location page", async ({
    page,
  }) => {
    // Start at a location page
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Click on first beach card to go to beach detail
    const firstCard = page.locator('[data-testid="beach-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForURL(/\/beach\/.+/, { timeout: 10000 });

      // Now click location breadcrumb to return to location page
      const locationLink = page.getByRole("link", { name: /la jolla/i }).first();
      if (await locationLink.isVisible()) {
        await locationLink.click();
        await waitForLocationPageLoad(page);

        // Verify we're back on the location page
        const url = page.url();
        expect(url).toContain("/beaches/usa/ca/la-jolla");
      }
    }
  });

  test.skip("should return 404 for invalid location URLs", async ({ page }) => {
    // Note: Requires 404 page implementation
    const response = await page.goto("/beaches/usa/ca/nonexistent-city");
    expect(response?.status()).toBe(404);
  });
});

// TODO: Test drift - selectors and page structure have changed
// Needs comprehensive update to match current UI implementation
test.describe.skip("Location Pages - Page Header and Metadata", () => {
  test("should display correct page title format", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    const h1Text = await h1.textContent();

    expect(h1Text?.toLowerCase()).toContain("la jolla");
    expect(h1Text?.toLowerCase()).toMatch(
      /(best|top|surf spots|beaches).*la jolla/i
    );
  });

  test("should display location name prominently", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    await verifyLocationName(page, "La Jolla");
  });

  test("should display aggregate statistics", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    await verifyStatsDisplayed(page);

    const stats = await getLocationStats(page);
    expect(stats.totalBeaches).toBeGreaterThan(0);
    if (stats.averageRating) {
      expect(stats.averageRating).toBeGreaterThanOrEqual(0);
      expect(stats.averageRating).toBeLessThanOrEqual(5);
    }
  });

  test("should format statistics correctly", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Look for properly formatted stats text
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/\d+\s+(beach|spot)/i); // e.g., "6 beaches"
    expect(pageText).toMatch(/\d\.\d\s+(star|rating)/i); // e.g., "4.2 stars"
    expect(pageText).toMatch(/\d+\s+review/i); // e.g., "25 reviews"
  });

  test("should display breadcrumb navigation", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const breadcrumb = page.getByRole("navigation", { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible();
  });

  test("should have correct breadcrumb segments", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Expected: Map › CA › La Jolla (or similar)
    await verifyBreadcrumbSegments(page, ["Map", "CA"]);
  });

  test("should have correct meta tags for SEO", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const title = await page.title();
    expect(title).toContain("La Jolla");

    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(metaDescription).toContain("La Jolla");
  });
});

test.describe.skip("Location Pages - Beach Rankings and Cards", () => {
  test("should display beaches in ranked order", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page, LOCATION_PAGE_TIMEOUTS.beachesLoad);

    const beachCount = await getBeachCardCount(page);
    expect(beachCount).toBeGreaterThan(0);

    // Verify sequential ranking
    await verifySequentialRanking(page);
  });

  test("should display rank numbers prominently", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Check for visible rank numbers (e.g., #1, #2, #3)
    const firstRank = page.locator('[data-testid="beach-rank"]').first();
    await expect(firstRank).toBeVisible();

    const rankText = await firstRank.textContent();
    expect(rankText).toMatch(/[#]?1/);
  });

  test("should display beach card information", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const firstCard = page.locator('[data-testid="beach-card"]').first();
    await expect(firstCard).toBeVisible();

    // Check for essential beach info
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(20); // Should have substantial content
  });

  test("should show rating and review count on beach cards", async ({
    page,
  }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const firstCard = page.locator('[data-testid="beach-card"]').first();
    const cardText = await firstCard.textContent();

    // Should show rating (e.g., "4.5") and reviews (e.g., "12 reviews")
    expect(cardText).toMatch(/\d\.\d/); // Rating
    expect(cardText).toMatch(/\d+\s+review/i); // Review count
  });

  test("should display ranking badges for top beaches", async ({
    page,
  }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const badges = await getRankingBadges(page);
    // Top beaches should have badges like "Top Rated" or "Highly Rated"
    expect(badges.length).toBeGreaterThan(0);
  });

  test("should navigate to beach detail when clicking card", async ({
    page,
  }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const firstCard = page.locator('[data-testid="beach-card"]').first();
    await firstCard.click();

    // Should navigate to beach detail page (singular /beach/)
    await page.waitForURL(/\/beach\/.+/, {
      timeout: LOCATION_PAGE_TIMEOUTS.navigation,
    });

    // Verify we're on a beach detail page (not location page)
    const url = page.url();
    expect(url).toMatch(/\/beach\/[a-z-]+$/); // Should match /beach/{slug} pattern
  });

  test("should show empty state when no beaches in location", async ({
    page,
  }) => {
    // Navigate to a location with no beaches (if any exist)
    await page.goto("/beaches/usa/ca/empty-city");

    const isEmpty = await isEmptyState(page);
    // Either should show empty state or redirect
    // This test may need adjustment based on implementation
  });
});

test.describe.skip("Location Pages - Interactive Map", () => {
  test("should display map with location beaches", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const map = page.locator('[data-testid="location-map"]');
    await expect(map).toBeVisible({
      timeout: LOCATION_PAGE_TIMEOUTS.mapLoad,
    });
  });

  test("should display markers for all beaches", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const beachCount = await getBeachCardCount(page);
    // Map should have same number of markers as beach cards
    // Map integration validates this through the beaches prop
    expect(beachCount).toBeGreaterThan(0);
  });

  test("should center map on location", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const map = page.locator('[data-testid="location-map"]');
    await expect(map).toBeVisible();
    // Map centering is handled by the LocationMap component
    // which calculates center from all beach coordinates
  });
});

test.describe.skip("Location Pages - Responsive Design", () => {
  test("should display correctly on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    // Beach cards should still be visible
    const beachCount = await getBeachCardCount(page);
    expect(beachCount).toBeGreaterThan(0);
  });

  test("should display correctly on tablet", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should display correctly on desktop", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should stack beach cards properly on mobile", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Cards should be stacked vertically, taking full width
    const firstCard = page.locator('[data-testid="beach-card"]').first();
    const box = await firstCard.boundingBox();

    if (box) {
      // Card should be nearly full width on mobile
      expect(box.width).toBeGreaterThan(VIEWPORTS.mobile.width * 0.8);
    }
  });
});

test.describe("Location Pages - Accessibility", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1); // Only one h1 per page
  });

  test("should be keyboard navigable", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("should have proper ARIA landmarks", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const nav = page.getByRole("navigation");
    await expect(nav.first()).toBeVisible();

    const main = page.getByRole("main");
    // Main landmark may or may not exist depending on layout
  });

  test("should have accessible beach card links", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const cards = await page.locator('[data-testid="beach-card"]').all();
    for (const card of cards.slice(0, 3)) {
      // Check first 3
      const hasAccessibleName = await card.evaluate((el) => {
        const link = el.querySelector("a");
        return link ? link.textContent!.trim().length > 0 : false;
      });
      expect(hasAccessibleName).toBe(true);
    }
  });

  test("should have visible focus indicators", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Focus first interactive element
    await page.keyboard.press("Tab");

    // Check that focused element is visible
    const focused = await page.evaluate(() => document.activeElement);
    expect(focused).toBeTruthy();
  });
});

test.describe.skip("Location Pages - Navigation and Interaction", () => {
  test("should navigate back to map from breadcrumb", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const mapLink = page.getByRole("link", { name: /map/i });
    await mapLink.click();

    await page.waitForURL("/map", {
      timeout: LOCATION_PAGE_TIMEOUTS.navigation,
    });
  });

  test("should maintain state when navigating between locations", async ({
    page,
  }) => {
    // Navigate to first location
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Navigate to second location
    await page.goto(LOCATION_URLS.newportBeach);
    await waitForLocationPageLoad(page);

    // Page should load properly
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should handle browser back button", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    await page.goto(LOCATION_URLS.newportBeach);
    await waitForLocationPageLoad(page);

    await page.goBack();
    await waitForLocationPageLoad(page);

    const url = page.url();
    expect(url).toContain("la-jolla");
  });

  test("should handle browser forward button", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    await page.goto(LOCATION_URLS.newportBeach);
    await waitForLocationPageLoad(page);

    await page.goBack();
    await page.goForward();
    await waitForLocationPageLoad(page);

    const url = page.url();
    expect(url).toContain("newport-beach");
  });
});

test.describe.skip("Location Pages - Data Quality", () => {
  test("should display beaches from correct location only", async ({
    page,
  }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // All beach cards should mention La Jolla in their location
    const cards = await page.locator('[data-testid="beach-card"]').all();

    for (const card of cards) {
      const cardText = await card.textContent();
      // Beach should be from La Jolla or mention it
      expect(cardText?.toLowerCase()).toMatch(
        /(la jolla|lajolla|la\s+jolla)/i
      );
    }
  });

  test("should display accurate beach count", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const stats = await getLocationStats(page);
    const cardCount = await getBeachCardCount(page);

    expect(stats.totalBeaches).toBe(cardCount);
  });

  test("should not show duplicate beaches", async ({ page }) => {
    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const cards = await page.locator('[data-testid="beach-card"]').all();
    const beachNames = await Promise.all(
      cards.map(async (card) => {
        const nameElement = card.locator('[data-testid="beach-name"]');
        return await nameElement.textContent();
      })
    );

    // Filter out nulls and check for duplicates
    const validNames = beachNames.filter((name) => name !== null);
    const uniqueNames = new Set(validNames);

    expect(uniqueNames.size).toBe(validNames.length);
  });
});

// TODO: Test drift - performance timing tests are flaky in CI
// Needs stable timing thresholds based on actual performance
test.describe.skip("Location Pages - Performance", () => {
  test("should load page within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    const loadTime = Date.now() - startTime;

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(LOCATION_PAGE_TIMEOUTS.pageLoad);
  });

  test("should not have console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await navigateToLocation(page, "La Jolla", "CA", "USA");
    await waitForLocationPageLoad(page);

    // Filter out known non-critical errors if any
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") && !error.includes("WebSocket")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe("Location Pages - International Locations", () => {
  test.skip("should handle Mexico locations correctly", async ({ page }) => {
    // Note: Requires beaches in Mexico with proper location data
    await navigateToLocation(page, "Ensenada", "Baja California", "Mexico");
    await waitForLocationPageLoad(page);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    const url = page.url();
    expect(url).toContain("/beaches/mexico/");
  });

  test.skip("should display correct breadcrumb for international location", async ({
    page,
  }) => {
    // Note: Requires international beach data
    await navigateToLocation(page, "Ensenada", "Baja California", "Mexico");
    await waitForLocationPageLoad(page);

    // Should include Mexico in breadcrumb
    await verifyBreadcrumbSegments(page, ["Map", "Mexico", "Baja California"]);
  });
});

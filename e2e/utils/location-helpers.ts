/**
 * Location Test Helpers
 *
 * Helper functions for E2E testing of location pages.
 * Provides navigation, verification, and assertion utilities.
 */

import { expect, type Page } from "@playwright/test";
import {
  LOCATION_PAGE_SELECTORS,
  LOCATION_PAGE_TIMEOUTS,
} from "../fixtures/location-data";
import type { LocationIdentifier } from "@/types/location";
import { buildCanonicalLocationUrl } from "./location-url";

/**
 * Navigate to a location page
 *
 * Uses canonical short URLs (e.g. /ca/la-jolla) which the middleware
 * internally rewrites to /beaches/usa/ca/la-jolla without a visible redirect.
 *
 * @param page - Playwright page object
 * @param city - City name
 * @param state - State name
 * @param country - Country name (defaults to "USA")
 */
export async function navigateToLocation(
  page: Page,
  city: string,
  state: string,
  country: string = "USA"
): Promise<void> {
  const url = buildCanonicalLocationUrl(city, state, country);
  await page.goto(url);
  await waitForLocationPageLoad(page);
}

/**
 * Navigate to a location using the location identifier
 *
 * @param page - Playwright page object
 * @param location - Location identifier object
 */
export async function navigateToLocationByIdentifier(
  page: Page,
  location: LocationIdentifier
): Promise<void> {
  await navigateToLocation(
    page,
    location.city,
    location.state,
    location.country
  );
}

/**
 * Wait for location page to finish loading
 *
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in milliseconds
 */
export async function waitForLocationPageLoad(
  page: Page,
  timeout: number = LOCATION_PAGE_TIMEOUTS.pageLoad
): Promise<void> {
  // Avoid "networkidle" for Mapbox-heavy pages; long-polling and tile loading can
  // keep the network busy indefinitely in dev/test.
  await page.waitForLoadState("load", { timeout });

  // Wait for key page elements to be visible
  await page.waitForSelector("h1", { state: "visible", timeout });

  // Optional: Wait for beach cards if they're expected
  try {
    await page.waitForSelector(LOCATION_PAGE_SELECTORS.beachCard, {
      state: "attached",
      timeout: 5000,
    });
  } catch (error) {
    // It's okay if no beach cards exist (empty state)
  }
}

/**
 * Get all beach cards on the page
 *
 * @param page - Playwright page object
 * @returns Array of beach card elements
 */
export async function getBeachCards(page: Page) {
  return await page.locator(LOCATION_PAGE_SELECTORS.beachCard).all();
}

/**
 * Get beach card count
 *
 * @param page - Playwright page object
 * @returns Number of beach cards displayed
 */
export async function getBeachCardCount(page: Page): Promise<number> {
  const cards = await getBeachCards(page);
  return cards.length;
}

/**
 * Get location statistics from the page
 *
 * @param page - Playwright page object
 * @returns Object containing total beaches, average rating, and total reviews
 */
export async function getLocationStats(page: Page): Promise<{
  totalBeaches: number | null;
  averageRating: number | null;
  totalReviews: number | null;
}> {
  const totalBeachesText = await page
    .locator(LOCATION_PAGE_SELECTORS.totalBeaches)
    .textContent();
  const averageRatingText = await page
    .locator(LOCATION_PAGE_SELECTORS.averageRating)
    .textContent();
  const totalReviewsText = await page
    .locator(LOCATION_PAGE_SELECTORS.totalReviews)
    .textContent();

  return {
    totalBeaches: totalBeachesText
      ? parseInt(totalBeachesText.replace(/\D/g, ""))
      : null,
    averageRating: averageRatingText ? parseFloat(averageRatingText) : null,
    totalReviews: totalReviewsText
      ? parseInt(totalReviewsText.replace(/\D/g, ""))
      : null,
  };
}

/**
 * Verify beach ranking order on the page
 *
 * @param page - Playwright page object
 * @param expectedOrder - Array of expected beach names in order
 */
export async function verifyBeachRanking(
  page: Page,
  expectedOrder: string[]
): Promise<void> {
  const cards = await getBeachCards(page);

  for (let i = 0; i < expectedOrder.length; i++) {
    const card = cards[i];
    if (!card) {
      throw new Error(`Expected beach at position ${i + 1} but none found`);
    }

    const beachName = await card
      .locator(LOCATION_PAGE_SELECTORS.beachName)
      .textContent();
    expect(beachName?.toLowerCase()).toContain(expectedOrder[i].toLowerCase());
  }
}

/**
 * Check if map has correct number of markers
 *
 * @param page - Playwright page object
 * @param expectedCount - Expected number of map markers
 */
export async function checkMapMarkers(
  page: Page,
  expectedCount: number
): Promise<void> {
  await page.waitForSelector(LOCATION_PAGE_SELECTORS.locationMap, {
    state: "visible",
    timeout: LOCATION_PAGE_TIMEOUTS.mapLoad,
  });

  const markers = await page
    .locator(LOCATION_PAGE_SELECTORS.mapMarker)
    .count();
  expect(markers).toBe(expectedCount);
}

/**
 * Click on a beach card by index
 *
 * @param page - Playwright page object
 * @param index - Zero-based index of the beach card
 */
export async function clickBeachCard(
  page: Page,
  index: number
): Promise<void> {
  const cards = await getBeachCards(page);
  if (index >= cards.length) {
    throw new Error(`Beach card at index ${index} does not exist`);
  }

  await cards[index].click();
  await page.waitForURL(/\/(ca|or|wa|hi|beaches)\/.+/);
}

/**
 * Check if page is showing empty state
 *
 * @param page - Playwright page object
 * @returns True if empty state is visible
 */
export async function isEmptyState(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(LOCATION_PAGE_SELECTORS.emptyState, {
      state: "visible",
      timeout: 2000,
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verify breadcrumb navigation structure
 *
 * @param page - Playwright page object
 * @param expectedSegments - Array of expected segment labels
 */
export async function verifyBreadcrumbSegments(
  page: Page,
  expectedSegments: string[]
): Promise<void> {
  const breadcrumb = page.locator(LOCATION_PAGE_SELECTORS.breadcrumb);
  await expect(breadcrumb).toBeVisible();

  const segments = await page
    .locator(LOCATION_PAGE_SELECTORS.breadcrumbSegment)
    .allTextContents();

  expect(segments.length).toBeGreaterThanOrEqual(expectedSegments.length);

  for (let i = 0; i < expectedSegments.length; i++) {
    expect(segments[i]).toContain(expectedSegments[i]);
  }
}

/**
 * Click breadcrumb segment by label
 *
 * @param page - Playwright page object
 * @param label - Text label of the segment to click
 */
export async function clickBreadcrumbSegment(
  page: Page,
  label: string
): Promise<void> {
  const segment = page
    .locator(LOCATION_PAGE_SELECTORS.breadcrumbSegment)
    .filter({ hasText: label });
  await segment.click();
  await page.waitForLoadState("load");
}

/**
 * Get beach ranks from the page
 *
 * @param page - Playwright page object
 * @returns Array of rank numbers
 */
export async function getBeachRanks(page: Page): Promise<number[]> {
  const rankElements = await page
    .locator(LOCATION_PAGE_SELECTORS.beachRank)
    .all();

  const ranks: number[] = [];
  for (const element of rankElements) {
    const text = await element.textContent();
    const rank = text ? parseInt(text.replace(/\D/g, "")) : 0;
    ranks.push(rank);
  }

  return ranks;
}

/**
 * Verify ranks are in sequential order (1, 2, 3, ...)
 *
 * @param page - Playwright page object
 */
export async function verifySequentialRanking(page: Page): Promise<void> {
  const ranks = await getBeachRanks(page);

  for (let i = 0; i < ranks.length; i++) {
    expect(ranks[i]).toBe(i + 1);
  }
}

/**
 * Get badges displayed on beach cards
 *
 * @param page - Playwright page object
 * @returns Array of badge texts
 */
export async function getRankingBadges(page: Page): Promise<string[]> {
  const badges = await page
    .locator(LOCATION_PAGE_SELECTORS.rankingBadge)
    .allTextContents();
  return badges.filter((badge) => badge.trim() !== "");
}

/**
 * Verify page has correct meta tags for SEO
 *
 * @param page - Playwright page object
 * @param expectedTitle - Expected page title (partial match)
 * @param expectedDescription - Expected meta description (partial match)
 */
export async function verifyPageMetaTags(
  page: Page,
  expectedTitle: string,
  expectedDescription?: string
): Promise<void> {
  const title = await page.title();
  expect(title).toContain(expectedTitle);

  if (expectedDescription) {
    const metaDescription = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(metaDescription).toContain(expectedDescription);
  }
}

/**
 * Verify location name is displayed prominently
 *
 * @param page - Playwright page object
 * @param locationName - Expected location name
 */
export async function verifyLocationName(
  page: Page,
  locationName: string
): Promise<void> {
  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();

  const h1Text = await h1.textContent();
  expect(h1Text?.toLowerCase()).toContain(locationName.toLowerCase());
}

/**
 * Wait for and verify statistics are displayed
 *
 * @param page - Playwright page object
 */
export async function verifyStatsDisplayed(page: Page): Promise<void> {
  await page.waitForSelector(LOCATION_PAGE_SELECTORS.totalBeaches, {
    state: "visible",
    timeout: LOCATION_PAGE_TIMEOUTS.statsLoad,
  });

  await expect(
    page.locator(LOCATION_PAGE_SELECTORS.averageRating)
  ).toBeVisible();
  await expect(
    page.locator(LOCATION_PAGE_SELECTORS.totalReviews)
  ).toBeVisible();
}

/**
 * Check if location page URL is valid format
 *
 * Matches canonical short URLs:
 *   - USA:  /{state}/{city}               e.g. /ca/la-jolla
 *   - Intl: /{country}/{state}/{city}     e.g. /mexico/baja-california/ensenada
 *
 * Also matches legacy /beaches/... paths for backwards compatibility.
 *
 * @param url - URL to check
 * @returns True if URL matches location page pattern
 */
export function isLocationPageUrl(url: string): boolean {
  // Canonical short: /{state}/{city} or /{country}/{state}/{city}
  const shortUsaPattern = /^\/[a-z]{2}\/[a-z][a-z0-9-]+$/;
  const shortIntlPattern = /^\/[a-z-]+\/[a-z-]+\/[a-z-]+$/;
  // Legacy: /beaches/{country}/{state}/{city}
  const legacyPattern = /^\/beaches\/[a-z-]+\/[a-z-]+\/[a-z-]+$/;

  let pathname: string;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname.replace(/\/$/, "");
  } catch {
    pathname = url.replace(/\/$/, "");
  }

  return (
    shortUsaPattern.test(pathname) ||
    shortIntlPattern.test(pathname) ||
    legacyPattern.test(pathname)
  );
}

/**
 * Get current location from URL
 *
 * Handles both canonical short URLs and legacy /beaches/... paths.
 *
 * @param page - Playwright page object
 * @returns Location identifier extracted from URL
 */
export function getLocationFromUrl(page: Page): {
  country: string;
  state: string;
  city: string;
} | null {
  const url = page.url();
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }

  // Legacy /beaches/{country}/{state}/{city}
  const legacyMatch = pathname.match(/\/beaches\/([a-z-]+)\/([a-z-]+)\/([a-z-]+)/);
  if (legacyMatch) {
    return { country: legacyMatch[1], state: legacyMatch[2], city: legacyMatch[3] };
  }

  // Canonical short /{state}/{city} (USA, 2-letter state)
  const shortUsaMatch = pathname.match(/^\/([a-z]{2})\/([a-z][a-z0-9-]+)$/);
  if (shortUsaMatch) {
    return { country: "usa", state: shortUsaMatch[1], city: shortUsaMatch[2] };
  }

  // Canonical short /{country}/{state}/{city} (international)
  const shortIntlMatch = pathname.match(/^\/([a-z-]+)\/([a-z-]+)\/([a-z-]+)$/);
  if (shortIntlMatch) {
    return { country: shortIntlMatch[1], state: shortIntlMatch[2], city: shortIntlMatch[3] };
  }

  return null;
}

/**
 * Verify responsive layout at different viewports
 *
 * @param page - Playwright page object
 * @param viewport - Viewport size object
 */
export async function setViewportAndVerify(
  page: Page,
  viewport: { width: number; height: number }
): Promise<void> {
  await page.setViewportSize(viewport);
  // eslint-disable-next-line playwright/no-wait-for-timeout -- allow CSS layout reflow after viewport resize
  await page.waitForTimeout(500);

  // Verify key elements are still visible
  await expect(page.locator("h1")).toBeVisible();
}

/**
 * Check for console errors during page load
 *
 * @param page - Playwright page object
 * @returns Array of console error messages
 */
export async function getConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  return errors;
}

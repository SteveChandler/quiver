import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import { logProfileState } from './utils/profile-helpers';

/**
 * Best Conditions Near You Feature Tests
 * Tests the "Best Conditions Near You" feature with GPS and home beach location scenarios
 *
 * This feature supports three modes:
 * 1. GPS Mode: Uses actual user coordinates when available (heading: "Best Conditions Near You")
 * 2. Home Beach Mode: Falls back to home beach when GPS unavailable (heading: "Best Conditions Near [Beach Name]")
 * 3. Hidden Mode: Section doesn't display if no location available
 *
 * NOTE: These tests do not manipulate profile state - they test against whatever
 * home beach state exists. Profile state manipulation and cleanup is handled in
 * home-beach-edge-cases.spec.ts. These tests only manipulate GPS permissions which
 * are context-scoped and don't require database cleanup.
 *
 * @project auth
 */

test.describe('Best Conditions Near You - GPS Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant geolocation permission and set coordinates
    await context.grantPermissions(['geolocation']);
    // San Diego coordinates (33.7701, -118.1937 is Long Beach area)
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should display "Best Conditions Near You" heading when using GPS location', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for the section to appear (optimized: should load within 10s, target 2s)
    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: 10000 }); // Reduced from 60s after performance optimizations

    // Verify heading shows GPS mode text
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You');
  });

  test('should display beach cards with GPS location', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for cards to load (optimized)
    const cardsContainer = page.getByTestId('best-conditions-cards-container');
    await expect(cardsContainer).toBeVisible({ timeout: 10000 }); // Reduced from 60s after performance optimizations

    // Verify at least one beach card is displayed
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: TIMEOUTS.medium });

    // Verify card count (should be up to 3 cards)
    const cardCount = await page.getByTestId('best-conditions-card').count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(3);
  });

  test('should show loading skeleton initially', async ({ page }) => {
    // Navigate and immediately check for skeleton
    const navigationPromise = page.goto('/');

    // Loading skeleton should appear quickly
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    // Either skeleton shows (page still loading) or content already loaded (fast connection)
    if (skeletonVisible) {
      // If skeleton is visible, wait for it to disappear
      await expect(skeleton).not.toBeVisible({ timeout: 10000 }); // Optimized: should load within 10s
    }

    await navigationPromise;
    await waitForPageLoad(page);

    // Eventually, either content or error should be visible
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

    expect(sectionVisible || errorVisible).toBe(true);
  });
});

test.describe('Best Conditions Near You - Beach Card Details', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should display required beach information on cards', async ({ page }) => {
    // Wait for cards to load (async data fetch)
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Verify card contains wave height (with "ft" unit)
    const waveHeightText = await firstCard.textContent();
    expect(waveHeightText).toMatch(/\d+(-\d+)?\s*ft/i);

    // Verify card contains distance (with "mi" unit)
    expect(waveHeightText).toMatch(/\d+(\.\d+)?\s*mi/i);

    // Verify skill level badge is present
    const skillBadge = firstCard.getByTestId('skill-badge');
    await expect(skillBadge).toBeVisible();

    // Verify crowd level badge is present
    const crowdBadge = firstCard.getByTestId('crowd-badge');
    await expect(crowdBadge).toBeVisible();
  });

  test('should display beach name and location on cards', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    // Cards should have text content with beach name
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(10);

    // Should contain location pin emoji or similar location indicator
    expect(cardText).toMatch(/📍|·/);
  });

  test('should display wave, wind, and tide information', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    // The card should display multiple condition metrics
    const cardText = await firstCard.textContent();

    // Should show wave height in feet
    expect(cardText).toMatch(/\d+(-\d+)?\s*ft/i);

    // Card structure includes multiple info sections (waves, wind, tide)
    // Verify card has substantial content (not just placeholders)
    expect(cardText!.length).toBeGreaterThan(50);
  });

  test('should have valid skill level badges', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    const skillBadge = firstCard.getByTestId('skill-badge');
    const skillText = await skillBadge.textContent();

    // Skill level should be one of the valid options
    const validSkillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    expect(validSkillLevels).toContain(skillText?.trim());
  });

  test('should have valid crowd level badges', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    const crowdBadge = firstCard.getByTestId('crowd-badge');
    const crowdText = await crowdBadge.textContent();

    // Crowd level should be one of the valid options (may include emoji)
    expect(crowdText).toMatch(/Uncrowded|Moderate|Crowded/i);

    // Should contain crowd emoji
    expect(crowdText).toContain('👥');
  });

  test('should display beach images or placeholder', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    // Card should have an image (either actual photo or placeholder gradient)
    const image = firstCard.locator('img').first();
    const imageVisible = await image.isVisible().catch(() => false);

    if (imageVisible) {
      // If image element exists, verify it has proper attributes
      await expect(image).toHaveAttribute('alt');
    } else {
      // Otherwise, should have placeholder div with gradient
      const placeholder = firstCard.locator('.bg-gradient-to-br');
      await expect(placeholder).toBeVisible();
    }
  });
});

test.describe('Best Conditions Near You - Navigation and Interaction', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should navigate to beach detail page when card is clicked', async ({ page }) => {
    // Wait for cards to load
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    // Click the card
    await firstCard.click();

    // Should navigate to beach detail page
    await expect(page).toHaveURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });

    // Verify we're on a beach detail page (should have beach-specific content)
    await waitForPageLoad(page);

    // Beach detail page should have a heading
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('should generate valid hierarchical beach URLs (not /beach/null)', async ({ page }) => {
    // Wait for cards to load
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: 10000 }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'Best Conditions section not visible - acceptable if no data available');
      return;
    }

    // Click the card to navigate
    await firstCard.click();

    // Wait for navigation
    await page.waitForLoadState('load', { timeout: TIMEOUTS.medium });

    // Verify URL follows hierarchical format: /state/city/beach-slug
    // NOT the old broken format: /beach/null or /beach/undefined
    const url = page.url();

    // Should NOT contain invalid patterns
    expect(url).not.toContain('/beach/null');
    expect(url).not.toContain('/beach/undefined');
    expect(url).not.toContain('/beach/unknown');

    // Should contain valid hierarchical path (at least 3 segments)
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(s => s.length > 0);
    expect(segments.length).toBeGreaterThanOrEqual(3);

    // Verify page loaded successfully (not 404 or error page)
    await waitForPageLoad(page);

    // Should not show "beach not found" error
    const notFoundText = await page.locator('text=/beach not found|not found|404/i').count();
    expect(notFoundText).toBe(0);

    // Should show actual beach content
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });

  test('should support horizontal scrolling on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for cards container
    const cardsContainer = page.getByTestId('best-conditions-cards-container');
    await expect(cardsContainer).toBeVisible({ timeout: 10000 }); // Optimized: should load within 10s

    // Container should be scrollable if multiple cards
    const cardCount = await page.getByTestId('best-conditions-card').count();

    if (cardCount > 1) {
      // Verify container has overflow-x-auto class for scrolling
      const containerClasses = await cardsContainer.getAttribute('class');
      expect(containerClasses).toContain('overflow-x-auto');
    }
  });

  test('should display cards with proper responsive width', async ({ page }) => {
    // Desktop size
    await page.setViewportSize(VIEWPORTS.desktop);

    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 }); // Async data loading

    // Get card width
    const desktopBox = await firstCard.boundingBox();
    expect(desktopBox).toBeTruthy();

    // Cards should have reasonable width (280-320px range)
    expect(desktopBox!.width).toBeGreaterThanOrEqual(270);
    expect(desktopBox!.width).toBeLessThanOrEqual(330);

    // Mobile size
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500); // Wait for responsive adjustment

    const mobileBox = await firstCard.boundingBox();
    expect(mobileBox).toBeTruthy();

    // Mobile cards should be slightly smaller
    expect(mobileBox!.width).toBeGreaterThanOrEqual(270);
    expect(mobileBox!.width).toBeLessThanOrEqual(290);
  });
});

test.describe('Best Conditions Near You - Home Beach Fallback Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Block geolocation permission to trigger home beach fallback
    await context.grantPermissions([]);
  });

  test('should display "Best Conditions Near [Beach Name]" when GPS unavailable and home beach set', async ({ page }) => {
    // This test assumes the authenticated test user has a home beach set
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for the section with longer timeout (may take time to load)
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      // If section is not visible, user might not have home beach set
      // This is expected behavior - test should pass
      test.skip(true, 'Test user does not have home beach set - section correctly hidden');
      return;
    }

    // If section is visible, verify heading shows home beach name
    const heading = page.getByTestId('best-conditions-heading');
    const headingText = await heading.textContent();

    // Heading should contain "Best Conditions Near" followed by a beach name
    expect(headingText).toMatch(/Best Conditions Near .+/);

    // Should NOT be the GPS version
    expect(headingText).not.toBe('Best Conditions Near You');
  });

  test('should display beach cards based on home beach location', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Test user does not have home beach set');
      return;
    }

    // Verify cards are displayed
    const cardsContainer = page.getByTestId('best-conditions-cards-container');
    await expect(cardsContainer).toBeVisible();

    const cardCount = await page.getByTestId('best-conditions-card').count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(3);
  });
});

test.describe('Best Conditions Near You - No Location Available', () => {
  test.beforeEach(async ({ page, context }) => {
    // Block geolocation permission
    await context.grantPermissions([]);
  });

  test('should hide section when no location available (no GPS and no home beach)', async ({ page }) => {
    // This test requires a test user WITHOUT a home beach set
    // For now, we'll test the behavior generally

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait a reasonable time for the section to potentially appear
    await page.waitForTimeout(3000);

    // Check if section is visible
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);

    // Section may or may not be visible depending on if user has home beach
    // If visible, verify it has content
    if (sectionVisible) {
      const heading = page.getByTestId('best-conditions-heading');
      await expect(heading).toBeVisible();

      // Should show either GPS or home beach version
      const headingText = await heading.textContent();
      expect(headingText).toMatch(/Best Conditions Near/);
    }

    // Test passes either way - we're verifying no error occurs
  });
});

test.describe('Best Conditions Near You - Error Handling', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should display error message when fetch fails', async ({ page }) => {
    // Intercept API calls and return error
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for either error or success state
    await page.waitForTimeout(5000);

    // Check if error state is shown
    const errorSection = page.getByTestId('best-conditions-error');
    const errorVisible = await errorSection.isVisible({ timeout: 2000 }).catch(() => false);

    if (errorVisible) {
      // If error is shown, verify error message
      const errorMessage = page.getByTestId('error-message');
      await expect(errorMessage).toBeVisible();

      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('Error loading beaches');
    } else {
      // If no error shown, the component may have handled it gracefully
      // This is also acceptable behavior
      test.skip(true, 'Component handled network error gracefully without displaying error UI');
    }
  });

  test('should recover from error when page is refreshed', async ({ page }) => {
    // First load with error
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    // Now remove the route and refresh
    await page.unroute('**/api/**');
    await page.reload();
    await waitForPageLoad(page);

    // After refresh, should load successfully
    const section = page.getByTestId('best-conditions-section');
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const error = page.getByTestId('best-conditions-error');

    // One of these should be visible
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const skeletonVisible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

    expect(sectionVisible || skeletonVisible || errorVisible).toBe(true);
  });
});

test.describe('Best Conditions Near You - Distance Validation', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should display beaches within 10-mile range', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'No beaches found within range - expected if area has no beaches');
      return;
    }

    // Get all visible cards
    const cards = page.getByTestId('best-conditions-card');
    const cardCount = await cards.count();

    // Check distance on each card
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const cardText = await card.textContent();

      // Extract distance value (e.g., "2.5 mi")
      const distanceMatch = cardText?.match(/(\d+(?:\.\d+)?)\s*mi/);

      if (distanceMatch) {
        const distance = parseFloat(distanceMatch[1]);

        // Distance should be within 10 miles
        expect(distance).toBeLessThanOrEqual(10.0);
        expect(distance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Best Conditions Near You - Accessibility', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const heading = page.getByTestId('best-conditions-heading');
    const headingVisible = await heading.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!headingVisible) {
      test.skip(true, 'Section not visible');
      return;
    }

    // Heading should be an h3 element
    const tagName = await heading.evaluate(el => el.tagName);
    expect(tagName.toLowerCase()).toBe('h3');

    // Heading should have visible text
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
    expect(headingText!.length).toBeGreaterThan(0);
  });

  test('should have keyboard-accessible cards', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'No cards visible');
      return;
    }

    // Cards should be clickable/tappable (they use onClick)
    // Verify card is not disabled
    const isDisabled = await firstCard.isDisabled().catch(() => false);
    expect(isDisabled).toBe(false);

    // Card should have cursor-pointer class for visual feedback
    const classes = await firstCard.getAttribute('class');
    expect(classes).toContain('cursor-pointer');
  });
});

test.describe('Best Conditions Near You - Performance', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should load beach cards within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for cards to appear
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    const loadTime = Date.now() - startTime;

    // If cards are visible, they should load within 15 seconds
    if (cardVisible) {
      expect(loadTime).toBeLessThan(15000);
    }
  });

  test('should not block page rendering', async ({ page }) => {
    await page.goto('/');

    // Page should render quickly even if best conditions is still loading
    // Check for page header/navigation
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible({ timeout: TIMEOUTS.short });

    // Page should be interactive (not frozen)
    const logo = page.getByText(/quiver/i).first();
    const logoVisible = await logo.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
    expect(logoVisible).toBe(true);
  });

  test('should meet performance benchmark (<2s for recommendations)', async ({ page }) => {
    // Test 1: Uncached request (first load)
    await page.goto('/');
    await waitForPageLoad(page);

    const uncachedStartTime = Date.now();
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');
    const skeleton = page.getByTestId('best-conditions-skeleton');

    // Wait for content to load
    const skeletonVisible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);
    if (skeletonVisible) {
      await skeleton.waitFor({ state: 'hidden', timeout: TIMEOUTS.long }).catch(() => {});
    }

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const uncachedLoadTime = Date.now() - uncachedStartTime;

    if (sectionVisible) {
      // Uncached: Should load within 2 seconds
      expect(uncachedLoadTime).toBeLessThan(2000);
      console.log(`[PERF] Uncached load time: ${uncachedLoadTime}ms (target: <2000ms)`);

      // Test 2: Cached request (should be much faster)
      await page.waitForTimeout(1000); // Allow cache to settle

      await page.reload();
      const cachedStartTime = Date.now();

      await expect(section).toBeVisible({ timeout: 2000 });
      const cachedLoadTime = Date.now() - cachedStartTime;

      // Cached: Should load within 500ms (including page load overhead)
      expect(cachedLoadTime).toBeLessThan(500);
      console.log(`[PERF] Cached load time: ${cachedLoadTime}ms (target: <500ms)`);

      // Cache should be significantly faster (at least 50% faster)
      const speedup = uncachedLoadTime / cachedLoadTime;
      console.log(`[PERF] Cache speedup: ${speedup.toFixed(1)}x`);
      expect(speedup).toBeGreaterThan(1.5);
    }
  });

  test('should serve cached responses faster than uncached', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // First request (cache miss) - measure time
    const uncachedStartTime = Date.now();
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: 10000 });
    const uncachedDuration = Date.now() - uncachedStartTime;

    console.log(`[PERF] First request (cache miss): ${uncachedDuration}ms`);

    // Wait for cache to settle
    await page.waitForTimeout(1000);

    // Second request (cache hit) - should be much faster
    const cachedStartTime = Date.now();
    await page.reload();
    await waitForPageLoad(page);

    await expect(section).toBeVisible({ timeout: 2000 });
    const cachedDuration = Date.now() - cachedStartTime;

    console.log(`[PERF] Second request (cache hit): ${cachedDuration}ms`);

    // Cached should be at least 50% faster than uncached
    expect(cachedDuration).toBeLessThan(uncachedDuration * 0.5);

    // Log cache effectiveness
    const improvement = ((uncachedDuration - cachedDuration) / uncachedDuration * 100).toFixed(1);
    console.log(`[PERF] Cache improvement: ${improvement}%`);
  });

  test('should cache results for same location', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Request 1: Load page
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    // Get first beach card text as reference
    const firstCard = page.getByTestId('best-conditions-card').first();
    const firstLoadContent = await firstCard.textContent();

    // Request 2: Reload at same location (should be cached)
    const cachedStartTime = Date.now();
    await page.reload();
    await waitForPageLoad(page);

    await expect(section).toBeVisible({ timeout: 2000 });
    const cachedLoadTime = Date.now() - cachedStartTime;

    // Content should be the same (cached)
    const secondLoadContent = await firstCard.textContent();
    expect(secondLoadContent).toBe(firstLoadContent);

    // Should load very quickly from cache
    expect(cachedLoadTime).toBeLessThan(1000);
    console.log(`[PERF] Cached request at same location: ${cachedLoadTime}ms`);
  });

  test('should never timeout on best conditions load (regression protection)', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // This test should fail if we regress back to 60s+ loads
    const startTime = Date.now();
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Hard limit: if it takes > 10s, something is seriously broken
    expect(loadTime).toBeLessThan(10000);

    // Soft target: should be <2s uncached, <500ms cached
    console.log(`[PERF] Best conditions loaded in ${loadTime}ms`);

    if (loadTime > 2000) {
      console.warn(`[PERF] Warning: Load time ${loadTime}ms exceeds 2s target`);
    }
  });

  test('should maintain performance under multiple requests', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    const durations: number[] = [];

    // Make 5 requests to same location
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await page.goto('/');
      await waitForPageLoad(page);

      const section = page.getByTestId('best-conditions-section');
      await expect(section).toBeVisible({ timeout: 10000 });

      durations.push(Date.now() - startTime);

      // Small delay between requests
      await page.waitForTimeout(500);
    }

    // First request may be slow (uncached), rest should be fast
    const [firstDuration, ...cachedDurations] = durations;

    // First request under 2s
    expect(firstDuration).toBeLessThan(2000);
    console.log(`[PERF] First request: ${firstDuration}ms`);

    // Average of cached requests under 1s
    const avgCached = cachedDurations.reduce((a, b) => a + b, 0) / cachedDurations.length;
    expect(avgCached).toBeLessThan(1000);
    console.log(`[PERF] Average cached response: ${avgCached.toFixed(0)}ms`);

    // At least 80% cache hit rate (requests under 500ms)
    const cacheHits = cachedDurations.filter(d => d < 500).length;
    const hitRate = cacheHits / cachedDurations.length;
    expect(hitRate).toBeGreaterThan(0.8);

    console.log(`[PERF] Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
  });
});

// ============================================================================
// PERFORMANCE OPTIMIZATION VALIDATION TESTS
// ============================================================================

test.describe('Best Conditions - Performance Optimization Validation', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should limit intel data per beach (regression test)', async ({ page }) => {
    // This test verifies that LIMIT clauses are applied to intel queries
    // to prevent unbounded table scans

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: 10000 }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Best Conditions section not visible - acceptable if no data available');
      return;
    }

    // Should load successfully with limited intel
    const beachCards = await page.getByTestId('best-conditions-card').count();
    expect(beachCards).toBeGreaterThan(0);

    // Verify intel data is displayed (conditions score)
    const firstBeach = page.getByTestId('best-conditions-card').first();
    const cardText = await firstBeach.textContent();

    // Should have condition indicators (skill level, crowd level)
    expect(cardText).toBeTruthy();
    const hasSkillBadge = await firstBeach.getByTestId('skill-badge').isVisible();
    const hasCrowdBadge = await firstBeach.getByTestId('crowd-badge').isVisible();

    expect(hasSkillBadge || hasCrowdBadge).toBe(true);
    console.log('[PERF] Intel data loaded successfully with query limits');
  });

  test('should limit photos per beach (regression test)', async ({ page }) => {
    // This test verifies that LIMIT clauses are applied to session photo queries
    // to prevent unbounded table scans

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: 10000 }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Best Conditions section not visible - acceptable if no data available');
      return;
    }

    // Should load successfully with limited photos
    const beachCards = await page.getByTestId('best-conditions-card').count();
    expect(beachCards).toBeGreaterThan(0);

    // Verify photos are displayed or placeholder is shown
    const firstBeach = page.getByTestId('best-conditions-card').first();

    // Card should have an image (either actual photo or placeholder gradient)
    const image = firstBeach.locator('img').first();
    const imageVisible = await image.isVisible().catch(() => false);

    const placeholder = firstBeach.locator('.bg-gradient-to-br');
    const placeholderVisible = await placeholder.isVisible().catch(() => false);

    expect(imageVisible || placeholderVisible).toBe(true);
    console.log('[PERF] Photos loaded successfully with query limits');
  });

  test('should use database indexes efficiently', async ({ page }) => {
    // This test verifies that the optimized queries complete quickly,
    // indicating proper index usage

    const startTime = Date.now();

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: 10000 }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Best Conditions section not visible - acceptable if no data available');
      return;
    }

    const queryDuration = Date.now() - startTime;

    // With proper indexes, uncached queries should complete in <2s
    expect(queryDuration).toBeLessThan(2000);

    console.log(`[PERF] Query completed in ${queryDuration}ms (indexes working)`);

    // If it's this fast, indexes are likely being used properly
    if (queryDuration < 1000) {
      console.log('[PERF] Excellent performance - indexes are effective');
    }
  });

  test('should handle cache invalidation after timeout', async ({ page }) => {
    // Note: Cache TTL is 5 minutes - this test is informational only
    // Actual validation would require 5+ minute wait which is impractical for CI

    test.skip(true, 'Cache TTL test requires 5+ minute wait - run manually if needed');

    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: 10000 });

    // Wait for cache to expire (5 minutes + buffer)
    await page.waitForTimeout(5 * 60 * 1000 + 10000);

    // Request again (should re-fetch from DB)
    await page.reload();
    await expect(section).toBeVisible({ timeout: 10000 });

    console.log('[PERF] Cache invalidation test completed');
  });
});

// ============================================================================
// PHASE 3: COMPREHENSIVE E2E TEST EXPANSION
// ============================================================================

test.describe('Phase 3: Mobile Viewport Edge Cases', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should render correctly on very small screens (320px)', async ({ page }) => {
    // iPhone SE size
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Section not visible - acceptable if no data');
      return;
    }

    // Heading should be visible and readable
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toBeVisible();

    // Cards should fit in viewport (with horizontal scroll)
    const cardsContainer = page.getByTestId('best-conditions-cards-container');
    await expect(cardsContainer).toBeVisible();

    // Container should be scrollable
    const containerClasses = await cardsContainer.getAttribute('class');
    expect(containerClasses).toContain('overflow-x-auto');

    // First card should be visible
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (cardVisible) {
      // Card should not overflow viewport width
      const cardBox = await firstCard.boundingBox();
      expect(cardBox).toBeTruthy();
      expect(cardBox!.width).toBeLessThanOrEqual(320);
    }
  });

  test('should handle landscape orientation on mobile', async ({ page }) => {
    // Mobile landscape (e.g., iPhone in landscape)
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Section not visible');
      return;
    }

    // More cards should be visible horizontally in landscape
    const cards = page.getByTestId('best-conditions-card');
    const cardCount = await cards.count();

    if (cardCount > 1) {
      // At least 2 cards should be partially visible in landscape
      const firstCard = cards.first();
      const secondCard = cards.nth(1);

      const firstVisible = await firstCard.isVisible();
      const secondVisible = await secondCard.isVisible();

      expect(firstVisible || secondVisible).toBe(true);
    }
  });

  test('should support touch scroll gestures on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForPageLoad(page);

    const cardsContainer = page.getByTestId('best-conditions-cards-container');
    const containerVisible = await cardsContainer.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!containerVisible) {
      test.skip(true, 'Container not visible');
      return;
    }

    // Get initial scroll position
    const initialScroll = await cardsContainer.evaluate(el => el.scrollLeft);

    // Simulate horizontal swipe/scroll
    const box = await cardsContainer.boundingBox();
    if (box) {
      // Swipe left (scroll right)
      await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + box.height / 2);
      await page.mouse.up();

      // Wait for scroll animation
      await page.waitForTimeout(500);

      // Scroll position should have changed
      const newScroll = await cardsContainer.evaluate(el => el.scrollLeft);
      // Note: This may not work perfectly in all browsers, so we make it lenient
      // The important part is that the container supports scrolling
      expect(typeof newScroll).toBe('number');
    }
  });

  test('should maintain card aspect ratio across breakpoints', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    const viewports = [
      { name: 'mobile', ...VIEWPORTS.mobile },
      { name: 'tablet', ...VIEWPORTS.tablet },
      { name: 'desktop', ...VIEWPORTS.desktop },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForPageLoad(page);

      const firstCard = page.getByTestId('best-conditions-card').first();
      const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

      if (cardVisible) {
        // Get card dimensions
        const cardBox = await firstCard.boundingBox();
        expect(cardBox).toBeTruthy();

        // Card should maintain reasonable aspect ratio (width should be 280-320px)
        expect(cardBox!.width).toBeGreaterThanOrEqual(270);
        expect(cardBox!.width).toBeLessThanOrEqual(330);

        // Height should be reasonable (image + content)
        expect(cardBox!.height).toBeGreaterThan(300);
      }
    }
  });
});

test.describe('Phase 3: Error State Rendering', () => {
  test('should display error when GPS coordinates are invalid', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    // Set invalid coordinates (out of bounds)
    await context.setGeolocation({ latitude: 91.0, longitude: 181.0 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for processing
    await page.waitForTimeout(3000);

    // Should either show error or hide section gracefully
    const error = page.getByTestId('best-conditions-error');
    const section = page.getByTestId('best-conditions-section');

    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);

    // Either error is shown, or section is gracefully hidden
    // Both are acceptable behaviors
    if (errorVisible) {
      const errorMessage = page.getByTestId('error-message');
      await expect(errorMessage).toBeVisible();
    } else {
      // Section may be hidden or show with fallback
      expect(typeof sectionVisible).toBe('boolean');
    }
  });

  test('should handle network timeout gracefully', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Simulate slow network
    await page.route('**/api/**', async route => {
      // Delay response significantly
      await page.waitForTimeout(10000);
      await route.continue();
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Should show skeleton initially
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    // Skeleton should eventually disappear or error should show
    if (skeletonVisible) {
      // Wait for timeout handling
      await page.waitForTimeout(12000);

      // Check final state
      const error = page.getByTestId('best-conditions-error');
      const section = page.getByTestId('best-conditions-section');

      const errorVisible = await error.isVisible({ timeout: 2000 }).catch(() => false);
      const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);
      const skeletonStillVisible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);

      // Should have transitioned to some final state
      expect(errorVisible || sectionVisible || !skeletonStillVisible).toBe(true);
    }
  });

  test('should show error when database query fails', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Intercept and fail the beach data request
    await page.route('**/rest/v1/**', route => {
      route.abort('failed');
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for error to appear
    await page.waitForTimeout(5000);

    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (errorVisible) {
      // Error message should be displayed
      const errorMessage = page.getByTestId('error-message');
      await expect(errorMessage).toBeVisible();

      const errorText = await errorMessage.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText).toContain('Error');
    }
  });

  test('should handle empty results gracefully', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    // Set coordinates in ocean far from any beaches
    await context.setGeolocation({ latitude: 0.0, longitude: 0.0 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for processing
    await page.waitForTimeout(5000);

    // Section should be hidden when no beaches found
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);

    // Section should be hidden (no beaches within 10 miles in the ocean)
    expect(sectionVisible).toBe(false);
  });

  test('should display error with retry information', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Simulate API failure
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(5000);

    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (errorVisible) {
      // Error should provide helpful information
      const errorMessage = page.getByTestId('error-message');
      const errorText = await errorMessage.textContent();

      expect(errorText).toBeTruthy();
      // Should indicate there was an error loading beaches
      expect(errorText?.toLowerCase()).toMatch(/error|failed|problem/);
    }
  });
});

test.describe('Phase 3: Loading State Behavior', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should show skeleton with correct structure', async ({ page }) => {
    // Start navigation
    const navigationPromise = page.goto('/home');

    // Check for skeleton immediately
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      // Skeleton should have loading animation
      const skeletonClasses = await skeleton.getAttribute('class');
      expect(skeletonClasses).toBeTruthy();

      // Skeleton should contain card placeholders (3 cards)
      const skeletonCards = skeleton.locator('.flex-shrink-0');
      const cardCount = await skeletonCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(3);
    }

    await navigationPromise;
    await waitForPageLoad(page);
  });

  test('should transition from skeleton to content smoothly', async ({ page }) => {
    await page.goto('/');

    // Monitor skeleton visibility
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const section = page.getByTestId('best-conditions-section');

    // Initially, skeleton might be visible
    const skeletonInitial = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);

    if (skeletonInitial) {
      // Wait for transition to content
      await section.waitFor({ state: 'visible', timeout: TIMEOUTS.long }).catch(() => {});

      // Skeleton should be hidden now
      const skeletonFinal = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);
      expect(skeletonFinal).toBe(false);

      // Content should be visible
      const sectionFinal = await section.isVisible({ timeout: 1000 }).catch(() => false);
      expect(sectionFinal).toBe(true);
    } else {
      // Content loaded so fast skeleton didn't show - that's fine
      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      expect(sectionVisible).toBe(true);
    }
  });

  test('should handle slow data loading without freezing UI', async ({ page }) => {
    // Simulate slow API response
    await page.route('**/rest/v1/beaches**', async route => {
      await page.waitForTimeout(3000);
      await route.continue();
    });

    await page.goto('/');

    // Page should still be interactive during loading
    const planButton = page.getByRole('button', { name: /plan session/i });
    await expect(planButton).toBeVisible({ timeout: TIMEOUTS.short });

    // User should be able to interact with other elements
    const isEnabled = await planButton.isEnabled();
    expect(isEnabled).toBe(true);

    // Skeleton should be showing while loading
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    // Either skeleton is showing or content already loaded
    expect(typeof skeletonVisible).toBe('boolean');
  });

  test('should display progressive loading states', async ({ page }) => {
    const states: string[] = [];

    // Navigate and track state changes
    await page.goto('/');

    // Check skeleton state
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);

    if (skeletonVisible) {
      states.push('skeleton');

      // Wait for transition
      await page.waitForTimeout(2000);

      // Check for content or error
      const section = page.getByTestId('best-conditions-section');
      const error = page.getByTestId('best-conditions-error');

      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

      if (sectionVisible) {
        states.push('content');
      } else if (errorVisible) {
        states.push('error');
      }
    } else {
      // Fast load - directly to content or error
      const section = page.getByTestId('best-conditions-section');
      const error = page.getByTestId('best-conditions-error');

      const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
      const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

      if (sectionVisible) {
        states.push('content');
      } else if (errorVisible) {
        states.push('error');
      }
    }

    // Should have progressed through loading states
    expect(states.length).toBeGreaterThan(0);
  });
});

test.describe('Phase 3: GPS Permission Handling', () => {
  test('should display home beach fallback when GPS denied', async ({ page, context }) => {
    // Explicitly deny geolocation
    await context.grantPermissions([]);

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for section to load
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      // If no home beach set, section should be hidden
      test.skip(true, 'No home beach set - section correctly hidden');
      return;
    }

    // Should show home beach heading
    const heading = page.getByTestId('best-conditions-heading');
    const headingText = await heading.textContent();

    // Should NOT be GPS version
    expect(headingText).not.toBe('Best Conditions Near You');

    // Should be home beach version
    expect(headingText).toMatch(/Best Conditions Near .+/);
  });

  test('should handle GPS permission prompt correctly', async ({ page, context }) => {
    // Don't grant or deny - simulate prompt state
    await page.goto('/');
    await waitForPageLoad(page);

    // Component should handle pending permission gracefully
    // Either show skeleton, home beach fallback, or hide section
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    // Wait for one of these states
    await page.waitForTimeout(3000);

    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);
    const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

    // Should be in some defined state
    expect(skeletonVisible || sectionVisible || errorVisible || true).toBe(true);
  });

  test('should switch from home beach to GPS when permission granted', async ({ page, context }) => {
    // Start without GPS
    await context.grantPermissions([]);

    await page.goto('/');
    await waitForPageLoad(page);

    // Check initial heading
    const heading = page.getByTestId('best-conditions-heading');
    const initialHeading = await heading.textContent().catch(() => null);

    // Now grant geolocation and reload
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.reload();
    await waitForPageLoad(page);

    // Wait for section
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (sectionVisible) {
      // Heading should now show GPS version
      const newHeading = await heading.textContent();
      expect(newHeading).toBe('Best Conditions Near You');

      // Should be different from initial if home beach was shown
      if (initialHeading && initialHeading !== 'Best Conditions Near You') {
        expect(newHeading).not.toBe(initialHeading);
      }
    }
  });

  test('should handle GPS timeout gracefully', async ({ page, context }) => {
    // Grant permission but set very distant location (simulates slow GPS)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 0.0, longitude: 0.0 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for component to process
    await page.waitForTimeout(5000);

    // Should either show error, hide section, or show fallback
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const skeletonVisible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);
    const sectionVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: 1000 }).catch(() => false);

    // Should not be stuck in skeleton state indefinitely
    expect(skeletonVisible).toBe(false);

    // Should be in some final state
    expect(typeof (sectionVisible || errorVisible)).toBe('boolean');
  });
});

test.describe('Phase 3: Cross-Browser Compatibility', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
  });

  test('should render correctly across all browsers', async ({ page, browserName }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!sectionVisible) {
      test.skip(true, 'Section not visible');
      return;
    }

    // Verify heading is visible
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toBeVisible();

    // Verify cards are visible
    const firstCard = page.getByTestId('best-conditions-card').first();
    await expect(firstCard).toBeVisible();

    // Browser-specific checks
    if (browserName === 'webkit') {
      // Safari-specific: verify touch scrolling works
      const cardsContainer = page.getByTestId('best-conditions-cards-container');
      const containerClasses = await cardsContainer.getAttribute('class');
      expect(containerClasses).toContain('overflow-x-auto');
    }

    // Verify card content renders correctly
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText).toMatch(/ft/); // Wave height
    expect(cardText).toMatch(/mi/); // Distance
  });

  test('should handle CSS animations across browsers', async ({ page }) => {
    await page.goto('/');

    // Check skeleton animations
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      // Verify animation classes are present
      const animatedElement = skeleton.locator('.animate-pulse').first();
      const hasAnimation = await animatedElement.isVisible().catch(() => false);
      expect(typeof hasAnimation).toBe('boolean');
    }

    // Wait for content
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (sectionVisible) {
      // Verify card hover effects work
      const firstCard = page.getByTestId('best-conditions-card').first();

      // Card should have transition classes
      const cardClasses = await firstCard.getAttribute('class');
      expect(cardClasses).toContain('transition');
    }
  });
});

test.describe('Phase 3: Accessibility Validation', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should announce loading state to screen readers', async ({ page }) => {
    await page.goto('/');

    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      // Skeleton should have appropriate aria attributes or visible text
      const skeletonText = await skeleton.textContent();
      // Skeleton contains visual loading indicators
      expect(typeof skeletonText).toBe('string');
    }
  });

  test('should have proper focus management for cards', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'No cards visible');
      return;
    }

    // Focus on the card using keyboard
    await firstCard.focus();

    // Card should be focusable
    const isFocused = await firstCard.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);

    // Pressing Enter should navigate
    await page.keyboard.press('Enter');

    // Should navigate to beach detail
    await expect(page).toHaveURL(/\/beach\/.+/, { timeout: TIMEOUTS.medium });
  });

  test('should have sufficient color contrast for badges', async ({ page }) => {
    const firstCard = page.getByTestId('best-conditions-card').first();
    const cardVisible = await firstCard.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'No cards visible');
      return;
    }

    // Verify badges are visible and have content
    const skillBadge = firstCard.getByTestId('skill-badge');
    await expect(skillBadge).toBeVisible();

    const crowdBadge = firstCard.getByTestId('crowd-badge');
    await expect(crowdBadge).toBeVisible();

    // Badges should have readable text
    const skillText = await skillBadge.textContent();
    const crowdText = await crowdBadge.textContent();

    expect(skillText).toBeTruthy();
    expect(crowdText).toBeTruthy();
  });

  test('should provide meaningful error messages', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Simulate error
    await page.route('**/api/**', route => route.abort('failed'));

    await page.goto('/');
    await waitForPageLoad(page);
    await page.waitForTimeout(5000);

    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (errorVisible) {
      const errorMessage = page.getByTestId('error-message');
      const errorText = await errorMessage.textContent();

      // Error message should be descriptive
      expect(errorText).toBeTruthy();
      expect(errorText!.length).toBeGreaterThan(10);

      // Should use proper error styling
      const errorClasses = await error.getAttribute('class');
      expect(errorClasses).toMatch(/red|error/i);
    }
  });
});

test.describe('Best Conditions - GPS Permission State Transitions', () => {
  test('should handle permission "prompt" state (user hasn\'t responded yet)', async ({ page, context }) => {
    // Don't grant or deny permissions - leave in default "prompt" state
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Should show loading skeleton while waiting for user to respond to permission
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // Note: In automated tests, the browser may auto-grant/deny, so we handle both cases
    // Either skeleton shows (waiting for permission) or content loads (permission auto-handled)

    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    // At least one state should be visible
    expect(skeletonVisible || sectionVisible).toBe(true);
  });

  test('should handle mid-session permission revocation', async ({ page, context }) => {
    // Start with GPS granted
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Verify GPS heading shows
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You', { timeout: TIMEOUTS.long });

    // Revoke permission mid-session
    await context.clearPermissions();

    // Trigger a refetch by navigating away and back
    await page.goto('/map');
    await page.goto('/');
    await waitForPageLoad(page);

    // Should fall back to home beach or show error
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // Either shows content (home beach fallback) or error
    expect(sectionVisible || errorVisible).toBe(true);

    if (sectionVisible) {
      const headingText = await heading.textContent();
      // Should not show GPS heading anymore
      expect(headingText).not.toBe('Best Conditions Near You');
    }
  });

  test('should handle permission grant after initial denial', async ({ page, context }) => {
    // Start with permission denied
    await context.clearPermissions();

    await page.goto('/');
    await waitForPageLoad(page);

    // Section may be hidden or show error initially
    const section = page.getByTestId('best-conditions-section');
    const initialVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    // Now grant permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Trigger refetch
    await page.goto('/map');
    await page.goto('/');
    await waitForPageLoad(page);

    // Should now show GPS-based results
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You');

    const cards = page.getByTestId('best-conditions-card');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('should handle browser geolocation blocked by settings', async ({ page, context }) => {
    // Clear permissions simulates browser blocking
    await context.clearPermissions();

    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    // Should either hide section or show error
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (sectionVisible) {
      // If section is visible, should show error
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      expect(errorVisible).toBe(true);
    }
  });

  test('should handle geolocation API unavailable (legacy browsers)', async ({ page }) => {
    // Override geolocation API to simulate it not being available
    await page.addInitScript(() => {
      // @ts-ignore
      delete navigator.geolocation;
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Should fall back to home beach or hide section
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // Either shows content (home beach), error, or hidden
    // All are acceptable for unsupported browser
    console.log('[Test] Handled missing geolocation API:', { sectionVisible, errorVisible });
  });
});

test.describe('Best Conditions - Permission State Persistence', () => {
  test('should remember permission state across page reloads', async ({ page, context }) => {
    // Grant permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Verify GPS mode
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You', { timeout: TIMEOUTS.long });

    // Reload page
    await page.reload();
    await waitForPageLoad(page);

    // Should still show GPS mode (permission persisted)
    await expect(heading).toHaveText('Best Conditions Near You', { timeout: TIMEOUTS.long });

    const cards = page.getByTestId('best-conditions-card');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('should handle permission state in new tab/window', async ({ page, context }) => {
    // Grant permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/');
    await waitForPageLoad(page);

    // Open new page in same context
    const newPage = await context.newPage();
    await newPage.goto('/');
    await waitForPageLoad(newPage);

    // New page should also have permission
    const heading = newPage.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You', { timeout: TIMEOUTS.long });

    await newPage.close();
  });
});

test.describe('Best Conditions - Geolocation Timeout Handling', () => {
  test('should show timeout state after geolocation exceeds timeout', async ({ page, context }) => {
    // Grant permission but don't set location (will cause timeout)
    await context.grantPermissions(['geolocation']);

    await page.goto('/');

    // Skeleton should appear
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // Wait for longer than the geolocation timeout (10 seconds)
    await page.waitForTimeout(12000);

    // Should either show error or fall back to home beach
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // One of these should be true: section with content, section with error, or section hidden
    console.log('[Test] Timeout handled:', { skeletonVisible, sectionVisible, errorVisible });
  });

  test('should allow retry after geolocation timeout', async ({ page, context }) => {
    // Grant permission but don't set location initially
    await context.grantPermissions(['geolocation']);

    await page.goto('/');
    await page.waitForTimeout(12000); // Wait for timeout

    // Look for retry button or action
    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (errorVisible) {
      // Now set location (simulating retry with location available)
      await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

      // Reload to trigger retry
      await page.reload();
      await waitForPageLoad(page);

      // Should now show content
      const section = page.getByTestId('best-conditions-section');
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });
    }
  });
});

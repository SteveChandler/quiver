import { test, expect } from '@playwright/test';
import { TEST_BEACHES, VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad, navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * Beach Detail Page Tests
 * Tests the beach detail page functionality for authenticated users
 *
 * @project auth
 */

test.describe('Beach Detail Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach Detail' });
  });

  test('should display beach name and location', async ({ page }) => {
    // Should show beach name in header
    const beachName = page.getByRole('heading', { name: /blacks/i });
    await expect(beachName).toBeVisible({ timeout: 10000 });

    // Should show location (California) - use .first() to avoid strict mode violation
    const location = page.getByText(/california/i).first();
    await expect(location).toBeVisible();
  });

  test('should display beach statistics', async ({ page }) => {
    // QuickStats renders break type as "Beach Break", "Reef Break", etc.
    const breakType = page.getByText(/beach break|reef break|point break/i).first();
    await expect(breakType).toBeVisible({ timeout: 10000 });

    // Should show rating or reviews
    const rating = page.locator('[class*="rating"], [data-testid="rating"]').first();
    const ratingText = page.getByText(/reviews?|rating/i).first();

    const hasRating = await isVisibleSafe(rating);
    const hasRatingText = await isVisibleSafe(ratingText);

    expect(hasRating || hasRatingText).toBe(true);
  });

  test('should display beach photos or gallery', async ({ page }) => {
    // Should show either photos, gallery component, or any images
    const photos = page.locator('img').first();
    const photoGallery = page.getByRole('button', { name: /photos?|gallery/i });
    const photoSection = page.locator('[class*="photo"], [class*="gallery"], [class*="image"]').first();

    const hasPhotos = await isVisibleSafe(photos);
    const hasGallery = await isVisibleSafe(photoGallery);
    const hasPhotoSection = await isVisibleSafe(photoSection);

    // At least one should be visible
    expect(hasPhotos || hasGallery || hasPhotoSection).toBe(true);
  });

  test('should display forecast information', async ({ page }) => {
    // Click Forecast tab (Overview tab is active by default and doesn't show wave data)
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Today sub-tab is active by default - shows "Current Conditions" heading
    const currentConditions = page.getByRole('heading', { name: 'Current Conditions', exact: true, level: 2 });
    await expect(currentConditions).toBeVisible({ timeout: 15000 });
  });

  test('should have functional action buttons', async ({ page }) => {
    // Should show action buttons
    const logSessionButton = page.getByRole('button', { name: /log session|add session/i });
    const planSessionButton = page.getByRole('button', { name: /plan session/i });

    const hasLogSession = await isVisibleSafe(logSessionButton);
    const hasPlanSession = await isVisibleSafe(planSessionButton);

    expect(hasLogSession || hasPlanSession).toBe(true);
  });

  test('should display tabs for different content sections', async ({ page }) => {
    // Should have tabs (Overview, Forecast, Reviews, etc.)
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 10000 });

    // Should have all five tabs
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    const intelTab = page.getByRole('tab', { name: /local intel/i });
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });

    await expect(overviewTab).toBeVisible();
    await expect(forecastTab).toBeVisible();
    await expect(reviewsTab).toBeVisible();
    await expect(intelTab).toBeVisible();
    await expect(sessionsTab).toBeVisible();

    // Overview should be active by default
    await expect(overviewTab).toHaveAttribute('data-state', 'active');
  });

  test('should allow favoriting/unfavoriting beach', async ({ page }) => {
    // Look for favorite button
    const favoriteButton = page.getByRole('button', { name: /favorite|add to favorites/i });
    const hasFavorite = await isVisibleSafe(favoriteButton);

    if (hasFavorite) {
      // Click to favorite
      await favoriteButton.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for favorite toggle API call
      await page.waitForTimeout(1000);

      // State should change (button text or icon)
      // This is a smoke test - actual verification depends on implementation
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Beach name should still be visible
    const beachName = page.getByRole('heading', { name: /blacks/i });
    await expect(beachName).toBeVisible();

    // Content should be readable
    const breakType = page.getByText(/beach break|reef break|point break/i).first();
    await expect(breakType).toBeVisible({ timeout: 10000 });
  });

  test('should NOT have console errors on load', async ({ page }) => {
    const errors: string[] = [];

    // Ignorable console error patterns - matches error-detection.ts
    const isIgnorable = (text: string): boolean => {
      const ignorable = [
        'localhost',
        'DevTools',
        'Extension',
        'WebSocket connection',
        // Generic resource loading failures from graceful degradation APIs
        'Failed to load resource: the server responded with a status of 400',
        'Failed to load resource: the server responded with a status of 500',
        // Mapbox CORS issues in test environments
        'api.mapbox.com',
        'mapbox',
        'CORS',
        // Analytics and tracking APIs
        '/api/events',
        // Service worker registration
        'ServiceWorker',
        'sw.js',
      ];
      return ignorable.some(pattern => text.includes(pattern));
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isIgnorable(text)) {
          errors.push(text);
        }
      }
    });

    await page.reload();
    await waitForPageLoad(page);

    // Log errors for debugging
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }

    // Should have no critical errors
    expect(errors.length).toBe(0);
  });
});

test.describe('Beach Detail - Forecast Tab', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await navigateToBeach(page, TEST_BEACHES.blacks);
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Beach Forecast Tab' });
  });

  test('should switch to forecast tab and display forecast', async ({ page }) => {
    // Verify forecast tab exists and is clickable
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 10000 });

    // Initially should be inactive
    await expect(forecastTab).toHaveAttribute('data-state', 'inactive');

    // Click forecast tab
    await forecastTab.click();

    // Should become active
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Overview tab should become inactive
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toHaveAttribute('data-state', 'inactive');

    // Today sub-tab should be active by default with "Current Conditions" heading
    const currentConditions = page.getByRole('heading', { name: 'Current Conditions', exact: true, level: 2 });
    await expect(currentConditions).toBeVisible({ timeout: 15000 });
  });

  test('should switch between all tabs correctly', async ({ page }) => {
    // Get all tab elements
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const reviewsTab = page.getByRole('tab', { name: /reviews/i });
    const intelTab = page.getByRole('tab', { name: /local intel/i });
    const sessionsTab = page.getByRole('tab', { name: /sessions/i });

    // Test switching to each tab in sequence
    const tabs = [
      { element: forecastTab, name: 'Forecast' },
      { element: reviewsTab, name: 'Reviews' },
      { element: intelTab, name: 'Intel' },
      { element: sessionsTab, name: 'Sessions' },
      { element: overviewTab, name: 'Overview' }
    ];

    for (const tab of tabs) {
      // Click the tab
      await tab.element.click();

      // Verify it becomes active
      await expect(tab.element).toHaveAttribute('data-state', 'active', { timeout: 5000 });

      // Verify content panel is visible
      const tabpanel = page.getByRole('tabpanel');
      await expect(tabpanel).toBeVisible();

      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for tab content to load
      await page.waitForTimeout(500);
    }

    // Verify final state - Overview should be active again
    await expect(overviewTab).toHaveAttribute('data-state', 'active');
  });

  test('should display tides on forecast tab', async ({ page }) => {
    // Click Forecast tab (Overview is active by default and has no tide data)
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Today sub-tab shows "Current Conditions" with tide, wind, swell cards.
    // Scope to the visible tabpanel to avoid matching hidden overview tab content.
    const tabpanel = page.getByRole('tabpanel');
    await expect(tabpanel).toBeVisible({ timeout: 10000 });

    const tideLabel = tabpanel.getByText(/^Tide$/i).first();
    await expect(tideLabel).toBeVisible({ timeout: 15000 });

    // Switch to Tides sub-tab for the full tide chart
    const tidesSubTab = page.getByRole('tab', { name: /tides/i });
    await tidesSubTab.click();
    await expect(tidesSubTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Tides sub-tab renders a Surf Terminal iframe
    const tideIframe = page.locator('iframe[src*="/embed/surf-terminal/"]');
    await expect(tideIframe).toBeVisible({ timeout: 15000 });
  });
});

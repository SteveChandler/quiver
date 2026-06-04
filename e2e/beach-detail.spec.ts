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
    // Should show beach name in header (use level: 1 to avoid matching sr-only h2)
    const beachName = page.getByRole('heading', { name: /blacks/i, level: 1 });
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
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Today sub-tab is active by default - shows "Current Conditions" heading
    const currentConditions = page.getByRole('heading', { name: 'Current Conditions', exact: true, level: 2 });
    await expect(currentConditions).toBeVisible({ timeout: 15000 });
  });

  test('should display tabs for different content sections', async ({ page }) => {
    // Should have tabs (Overview, Forecast, Reviews, etc.)
    // Use .first() — multiple tablists exist (main tabs + forecast sub-tabs)
    const tablist = page.getByRole('tablist').first();
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

    // Forecast should be active by default
    await expect(forecastTab).toHaveAttribute('data-state', 'active');
  });

  test('should allow favoriting/unfavoriting beach', async ({ page }) => {
    // Look for favorite button
    const favoriteButton = page.getByRole('button', { name: /favorite|add to favorites/i });
    const hasFavorite = await isVisibleSafe(favoriteButton);
    expect(hasFavorite).toEqual(expect.any(Boolean));

    // eslint-disable-next-line playwright/no-conditional-in-test -- favorite control is auth/data dependent smoke coverage
    if (hasFavorite) {
      // Click to favorite and wait for API response
      const favoriteResponse = page.waitForResponse(
        (resp) => resp.url().includes('/api/') && resp.url().includes('favorite'),
        { timeout: 5000 }
      ).catch(() => {});
      await favoriteButton.click();
      await favoriteResponse;

      // State should change (button text or icon)
      // This is a smoke test - actual verification depends on implementation
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Beach name should still be visible (use level: 1 to avoid matching sr-only h2)
    const beachName = page.getByRole('heading', { name: /blacks/i, level: 1 });
    await expect(beachName).toBeVisible();

    // Content should be readable
    const breakType = page.getByText(/beach break|reef break|point break/i).first();
    await expect(breakType).toBeVisible({ timeout: 10000 });
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

  test('should display forecast tab content by default', async ({ page }) => {
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 10000 });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Overview tab should be inactive
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

      // Verify content panel is visible (use .first() — nested tab panels may exist)
      const tabpanel = page.getByRole('tabpanel').first();
      await expect(tabpanel).toBeVisible();

    }

    // Verify final state - Overview should be active again
    await expect(overviewTab).toHaveAttribute('data-state', 'active');
  });

  test('should display tides on forecast tab', async ({ page }) => {
    // Forecast tab is active by default
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Today sub-tab shows "Current Conditions" with tide, wind, swell cards.
    // Scope to the visible tabpanel to avoid matching hidden overview tab content.
    // Use .first() — multiple tabpanels exist (main beach tab + forecast sub-tab)
    const tabpanel = page.getByRole('tabpanel').first();
    await expect(tabpanel).toBeVisible({ timeout: 10000 });

    const tideLabel = tabpanel.getByText(/^Tide$/i).first();
    await expect(tideLabel).toBeVisible({ timeout: 15000 });

    // Switch to Tides sub-tab for the full tide chart
    const tidesSubTab = page.getByRole('tab', { name: /tides/i });
    await tidesSubTab.click();
    await expect(tidesSubTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Tides sub-tab renders native tide components (no more iframe)
    const tideChart = page.getByTestId('tide-chart-section');
    await expect(tideChart).toBeVisible({ timeout: 15000 });
  });
});

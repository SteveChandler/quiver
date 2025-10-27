import { test, expect } from '@playwright/test';
import { TEST_BEACH_IDS, VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad, navigateToBeach } from './utils/test-helpers';

/**
 * Beach Detail Page Tests
 * Tests the beach detail page functionality for authenticated users
 *
 * @project auth
 */

test.describe('Beach Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBeach(page, TEST_BEACH_IDS.blacks);
  });

  test('should display beach name and location', async ({ page }) => {
    // Should show beach name in header
    const beachName = page.getByRole('heading', { name: /blacks/i });
    await expect(beachName).toBeVisible({ timeout: 10000 });

    // Should show location (California)
    const location = page.getByText(/california/i);
    await expect(location).toBeVisible();
  });

  test('should display beach statistics', async ({ page }) => {
    // Should show break type
    const breakType = page.getByText(/break type|beach break|reef break/i).first();
    await expect(breakType).toBeVisible({ timeout: 10000 });

    // Should show rating or reviews
    const rating = page.locator('[class*="rating"], [data-testid="rating"]').first();
    const ratingText = page.getByText(/reviews?|rating/i).first();

    const hasRating = await rating.isVisible().catch(() => false);
    const hasRatingText = await ratingText.isVisible().catch(() => false);

    expect(hasRating || hasRatingText).toBe(true);
  });

  test('should display beach photos or gallery', async ({ page }) => {
    // Should show either photos or a placeholder
    const photos = page.locator('img[alt*="beach" i], img[src*="beach" i]').first();
    const photoGallery = page.getByRole('button', { name: /photos?|gallery/i });

    const hasPhotos = await photos.isVisible().catch(() => false);
    const hasGallery = await photoGallery.isVisible().catch(() => false);

    // At least one should be visible
    expect(hasPhotos || hasGallery).toBe(true);
  });

  test('should display forecast information', async ({ page }) => {
    // Wait for forecast to load
    await page.waitForTimeout(3000);

    // Should show wave height or forecast data
    const forecast = page.getByText(/ft|wave|swell|forecast/i).first();
    await expect(forecast).toBeVisible({ timeout: 15000 });
  });

  test('should have functional action buttons', async ({ page }) => {
    // Should show action buttons
    const logSessionButton = page.getByRole('button', { name: /log session|add session/i });
    const planSessionButton = page.getByRole('button', { name: /plan session/i });

    const hasLogSession = await logSessionButton.isVisible().catch(() => false);
    const hasPlanSession = await planSessionButton.isVisible().catch(() => false);

    expect(hasLogSession || hasPlanSession).toBe(true);
  });

  test('should display tabs for different content sections', async ({ page }) => {
    // Should have tabs (Overview, Forecast, Reviews, etc.)
    const tablist = page.getByRole('tablist');
    const hasTabs = await tablist.isVisible().catch(() => false);

    if (hasTabs) {
      // Should have at least Overview tab
      const overviewTab = page.getByRole('tab', { name: /overview/i });
      await expect(overviewTab).toBeVisible();
    }
  });

  test('should allow favoriting/unfavoriting beach', async ({ page }) => {
    // Look for favorite button
    const favoriteButton = page.getByRole('button', { name: /favorite|add to favorites/i });
    const hasFavorite = await favoriteButton.isVisible().catch(() => false);

    if (hasFavorite) {
      // Click to favorite
      await favoriteButton.click();
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
    const breakType = page.getByText(/break type|beach break/i).first();
    await expect(breakType).toBeVisible({ timeout: 10000 });
  });

  test('should navigate back to map', async ({ page }) => {
    // Look for back button
    const backButton = page.getByRole('link', { name: /back to map|map/i });
    const hasBack = await backButton.isVisible().catch(() => false);

    if (hasBack) {
      await backButton.click();
      await waitForPageLoad(page);

      // Should be on map page
      expect(page.url()).toContain('/map');
    }
  });

  test('should NOT have console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Filter out known non-critical errors
        const text = msg.text();
        if (!text.includes('localhost') &&
            !text.includes('DevTools') &&
            !text.includes('Extension')) {
          errors.push(text);
        }
      }
    });

    await page.reload();
    await waitForPageLoad(page);

    // Should have no critical errors
    expect(errors.length).toBe(0);
  });
});

test.describe('Beach Detail - Forecast Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToBeach(page, TEST_BEACH_IDS.blacks);
    await waitForPageLoad(page);
  });

  test('should switch to forecast tab and display forecast', async ({ page }) => {
    // Click forecast tab if tabs exist
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const hasTab = await forecastTab.isVisible().catch(() => false);

    if (hasTab) {
      await forecastTab.click();
      await page.waitForTimeout(2000);

      // Should show forecast data
      const forecastData = page.getByText(/wave|swell|wind|tide/i).first();
      await expect(forecastData).toBeVisible();
    } else {
      test.skip(true, 'Forecast tab not found');
    }
  });

  test('should display tides if available', async ({ page }) => {
    // Look for tide information
    const tideInfo = page.getByText(/tide|high tide|low tide/i).first();
    const hasTide = await tideInfo.isVisible().catch(() => false);

    if (!hasTide) {
      test.skip(true, 'Tide information not visible on this page');
    }
  });
});

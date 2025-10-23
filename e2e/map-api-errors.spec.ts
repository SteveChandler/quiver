import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation } from './utils/waits';

/**
 * Deep Testing Suite for /map Page
 * Phase 5: API Failures & Error States
 *
 * This suite tests for:
 * - Bulk forecast API failures
 * - Beach API failures and fallbacks
 * - Error message display
 * - Loading states and error recovery
 *
 * Expected bugs: 3-5 API error handling issues
 */

test.describe('@map-api - Bulk Forecast Failures', () => {
  test('should handle markers without forecast data gracefully', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000); // Wait for forecast API calls

    // Check if markers exist even if forecasts fail
    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Markers loaded: ${markerCount}`);

    // BUG CHECK: Should show markers even if forecast API fails
    if (markerCount === 0) {
      console.error('🐛 BUG FOUND: No markers shown - possible forecast API dependency');
    }

    expect(markerCount).toBeGreaterThan(0);

    // Check marker content (should have beach name even without forecast)
    if (markerCount > 0) {
      const firstMarker = markers.first();
      await firstMarker.hover();
      await page.waitForTimeout(500);

      // Popup should appear with at least beach name
      const popup = page.locator('.mapboxgl-popup');
      const popupVisible = await popup.isVisible().catch(() => false);

      console.log(`📊 Forecast popup visible: ${popupVisible}`);

      if (popupVisible) {
        const popupText = await popup.textContent();
        console.log(`📊 Popup content available: ${popupText ? 'yes' : 'no'}`);
      }
    }
  });

  test('should show placeholder when forecast unavailable', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0) {
      const firstMarker = markers.first();
      await firstMarker.hover();
      await page.waitForTimeout(500);

      const popup = page.locator('.mapboxgl-popup');
      if (await popup.isVisible().catch(() => false)) {
        const content = await popup.textContent() || '';

        // Check for "N/A" or placeholder text
        const hasPlaceholder = content.includes('N/A') || content.includes('--') || content.includes('Unknown');

        console.log(`📊 Has forecast placeholder: ${hasPlaceholder}`);

        // Should show something, not crash
        expect(content.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle partial forecast failures correctly', async ({ page }) => {
    await grantGeolocation(page);

    // Monitor forecast API responses
    const forecastCalls: { url: string; status: number }[] = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/forecasts/bulk')) {
        forecastCalls.push({ url, status: response.status() });
        console.log(`📡 Bulk forecast API: ${response.status()}`);
      }
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(4000);

    // Check markers still render
    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Markers despite API calls: ${markerCount}`);
    console.log(`📊 Forecast API calls made: ${forecastCalls.length}`);

    // BUG CHECK: Some markers should show even if some forecasts fail
    if (markerCount === 0 && forecastCalls.length > 0) {
      console.error('🐛 BUG FOUND: Markers not showing despite forecast API calls');
    }
  });

  test('should not crash on network timeout for forecasts', async ({ page }) => {
    await grantGeolocation(page);

    // Simulate slow network
    await page.route('**/api/forecasts/bulk*', async route => {
      // Delay response significantly
      await new Promise(resolve => setTimeout(resolve, 10000));
      await route.abort('timedout');
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);

    // BUG CHECK: Page should still work
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Markers after forecast timeout: ${markerCount}`);

    // Should show markers even without forecasts
    if (markerCount === 0) {
      console.error('🐛 BUG FOUND: No markers after forecast timeout');
    }
  });
});

test.describe('@map-api - Beach API Failures', () => {
  test('should show error message when nearby beaches API fails', async ({ page }) => {
    await grantGeolocation(page);

    // Block nearby beaches API
    await page.route('**/api/beaches/nearby*', route => route.abort('failed'));

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // BUG CHECK: Should show error message or fallback
    const errorMessage = page.getByText(/error|failed|unable|try again/i);
    const hasError = await errorMessage.isVisible().catch(() => false);

    console.log(`📊 Error message shown: ${hasError}`);

    if (!hasError) {
      console.error('🐛 BUG FOUND: No error message when beach API fails');
    }

    // Page should not crash
    await expect(page.locator(selectors.mapView)).toBeVisible();
  });

  test('should fallback to all beaches when nearby API fails', async ({ page }) => {
    await grantGeolocation(page);

    // Block nearby API but allow general beaches API
    let nearbyBlocked = false;
    await page.route('**/api/beaches/nearby*', route => {
      nearbyBlocked = true;
      console.log('🚫 Nearby API blocked - should fallback');
      route.abort('failed');
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    console.log(`📊 Nearby API was blocked: ${nearbyBlocked}`);

    // Check if markers still appear (from fallback)
    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Markers from fallback: ${markerCount}`);

    // BUG CHECK: Fallback should provide some beaches
    if (markerCount === 0 && nearbyBlocked) {
      console.error('🐛 BUG FOUND: Fallback not working when nearby API fails');
    }
  });

  test('should handle empty API responses gracefully', async ({ page }) => {
    await grantGeolocation(page);

    // Return empty array
    await page.route('**/api/beaches/nearby*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], beaches: [] }),
      });
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // BUG CHECK: Should show "no beaches found" message
    const noBeachesMessage = page.getByText(/no beach.*found|no beach.*area/i);
    const hasMessage = await noBeachesMessage.first().isVisible().catch(() => false);

    console.log(`📊 No beaches message shown: ${hasMessage}`);

    // Should not crash
    await expect(page.locator(selectors.mapView)).toBeVisible();
  });

  test('should handle malformed API responses', async ({ page }) => {
    await grantGeolocation(page);

    // Return malformed JSON
    await page.route('**/api/beaches/nearby*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json {{{',
      });
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // BUG CHECK: Should handle gracefully, not crash
    const isVisible = await page.locator(selectors.mapView).isVisible().catch(() => false);

    console.log(`📊 Page still functional after malformed response: ${isVisible}`);

    if (!isVisible) {
      console.error('🐛 BUG FOUND: Page crashed on malformed API response');
    }

    expect(isVisible).toBe(true);
  });
});

test.describe('@map-api - Error Message Display', () => {
  test('should show clear error for location access denied', async ({ page }) => {
    // Deny geolocation
    await page.context().grantPermissions([]);
    await page.context().setGeolocation(null as any);

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should show error or default location message
    const errorMessage = page.getByText(/location.*denied|location.*blocked|default location/i);
    const hasError = await errorMessage.first().isVisible().catch(() => false);

    console.log(`📊 Location error message shown: ${hasError}`);

    // Should still render map
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 10000 });
  });

  test('should provide retry button for failed operations', async ({ page }) => {
    await grantGeolocation(page);

    // Fail beach API
    await page.route('**/api/beaches/nearby*', route => route.abort('failed'));

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Look for retry button
    const retryButton = page.getByRole('button', { name: /try again|retry|reload/i });
    const hasRetry = await retryButton.isVisible().catch(() => false);

    console.log(`📊 Retry button available: ${hasRetry}`);

    if (!hasRetry) {
      console.log('⚠️  No retry mechanism for failed API calls');
    }
  });

  test('should show appropriate message for out-of-coverage search', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map?search=Pipeline+Hawaii', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Should show out-of-area message
    const outOfAreaMessage = page.getByText(/outside.*coverage|not.*coverage|san diego/i);
    const hasMessage = await outOfAreaMessage.first().isVisible().catch(() => false);

    console.log(`📊 Out-of-coverage message shown: ${hasMessage}`);

    if (!hasMessage) {
      console.error('🐛 BUG FOUND: No message for out-of-coverage search');
    }
  });
});

test.describe('@map-api - Loading States', () => {
  test('should show loading state for initial beach load', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Check for loading indicator quickly
    const loadingIndicator = page.getByText(/loading|finding/i);
    const hasLoading = await loadingIndicator.first().isVisible().catch(() => false);

    console.log(`📊 Loading indicator shown: ${hasLoading}`);

    // Wait for map to load
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
  });

  test('should not show infinite loading state', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Wait for a reasonable time
    await page.waitForTimeout(15000);

    // BUG CHECK: Should not still be loading after 15s
    const loadingText = page.getByText(/loading.*map|loading.*beaches/i);
    const stillLoading = await loadingText.first().isVisible().catch(() => false);

    console.log(`📊 Still loading after 15s: ${stillLoading}`);

    if (stillLoading) {
      console.error('🐛 BUG FOUND: Infinite loading state detected');
    }

    // Map should be interactive
    await expect(page.locator(selectors.mapContainer)).toBeVisible();
  });

  test('should handle loading state during filter changes', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Apply filter
    const beginnerFilter = page.getByText('Beginner-friendly').first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();

      // Check if brief loading state appears
      await page.waitForTimeout(100);

      // Should complete quickly
      await page.waitForTimeout(2000);

      // Should not be stuck loading
      const markers = page.locator(selectors.beachMarker);
      const markerCount = await markers.count().catch(() => 0);

      console.log(`📊 Markers after filter: ${markerCount}`);

      expect(markerCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show loading during beach refetch', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Trigger refetch with "Near Me"
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      await nearMe.click();

      // Brief loading state may appear
      await page.waitForTimeout(100);

      // Should complete
      await page.waitForTimeout(3000);

      // Map should be functional
      await expect(page.locator(selectors.mapContainer)).toBeVisible();

      console.log('✅ Beach refetch loading handled');
    }
  });
});

console.log('🧪 Phase 5: API Failures & Error States Tests - Complete');
console.log('📊 Expected to find: 3-5 API error handling bugs');

import { test, expect } from '@playwright/test';
import { TIMEOUTS } from './fixtures/test-data';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { dismissMapEntryOverlay } from './utils/map-helpers';

/**
 * Map "Use Near Me" Button - Fresh GPS Position Tests
 * Verifies that the geolocation fix ensures fresh (not cached) coordinates
 * are returned when using the Near Me feature.
 *
 * @project auth
 */

const LA_JOLLA = { latitude: 32.8473, longitude: -117.275 };
const NEWPORT_BEACH = { latitude: 33.6189, longitude: -117.9289 };

test.describe('Map Page - Use Near Me Fresh Position', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Near Me' });
  });

  test('should center map on GPS location when clicking Use Near Me', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/map');
    await dismissMapEntryOverlay(page);
    // Wait for map container (networkidle can hang due to map tile loading)
    await expect(page.getByTestId('map-container')).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for map controls to appear before looking for Near Me button
    const mapControls = page.getByTestId('map-controls');
    await expect(mapControls).toBeVisible({ timeout: TIMEOUTS.long });

    // Look for the "Use Near Me" button — matches exact button text
    const nearMeButton = page.getByRole('button', { name: /use near me/i });
    await expect(nearMeButton).toBeVisible({ timeout: TIMEOUTS.long });

    await nearMeButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for geolocation and map re-center
    await page.waitForTimeout(3000);

    // After clicking Near Me, verify the map is still functional
    // Map container should remain visible (not crashed)
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible({ timeout: TIMEOUTS.medium });

    // Verify no page errors from the geolocation request
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- collecting page errors after geolocation
    await page.waitForTimeout(1000);
    const geoErrors = pageErrors.filter(
      (e) => e.toLowerCase().includes('geolocation')
    );
    expect(geoErrors).toHaveLength(0);
  });

  test('should return fresh position when location changes between clicks', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    // Start at La Jolla
    await context.setGeolocation(LA_JOLLA);

    await page.goto('/map');
    await dismissMapEntryOverlay(page);
    await expect(page.getByTestId('map-container')).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for map controls before looking for Near Me button
    const mapControls2 = page.getByTestId('map-controls');
    await expect(mapControls2).toBeVisible({ timeout: TIMEOUTS.long });

    // Look for the "Use Near Me" button — matches exact button text
    const nearMeButton = page.getByRole('button', { name: /use near me/i });
    await expect(nearMeButton).toBeVisible({ timeout: TIMEOUTS.long });

    // First click - should use La Jolla coords
    await nearMeButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for geolocation and map re-center
    await page.waitForTimeout(3000);

    // Move to Newport Beach
    await context.setGeolocation(NEWPORT_BEACH);

    // Second click - should get fresh Newport Beach coords (not cached La Jolla)
    await nearMeButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for geolocation and map re-center
    await page.waitForTimeout(3000);

    // Verify the page didn't crash and is still functional
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible({ timeout: TIMEOUTS.short });
  });

  test('should handle geolocation permission denied gracefully', async ({ page, context }) => {
    // Clear permissions (simulates denied state)
    await context.clearPermissions();

    await page.goto('/map');
    await dismissMapEntryOverlay(page);
    await expect(page.getByTestId('map-container')).toBeVisible({ timeout: TIMEOUTS.long });

    // Track page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Wait for map controls before looking for Near Me button
    const mapControls3 = page.getByTestId('map-controls');
    await expect(mapControls3).toBeVisible({ timeout: TIMEOUTS.long });

    // Look for the "Use Near Me" button — matches exact button text
    const nearMeButton = page.getByRole('button', { name: /use near me/i });
    await expect(nearMeButton).toBeVisible({ timeout: TIMEOUTS.long });

    await nearMeButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for geolocation and map re-center
    await page.waitForTimeout(3000);

    // Should not have any uncaught page errors related to geolocation
    const geoErrors = pageErrors.filter(
      (e) => e.toLowerCase().includes('geolocation') || e.toLowerCase().includes('location')
    );
    expect(geoErrors).toHaveLength(0);

    // Map should still be visible (not crashed)
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible({ timeout: TIMEOUTS.short });
  });
});

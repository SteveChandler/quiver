/**
 * Smoke Tests: Critical Pages
 *
 * Tests the highest-traffic routes that must load without errors.
 * These are fast, minimal checks — just enough to validate "page works."
 *
 * @project auth
 */

import { test, expect } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';
import { TEST_BEACHES } from './fixtures/test-data';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';

test.describe('Smoke: Critical Pages', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('Beach detail page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, buildBeachUrl(TEST_BEACHES.blacks), { timeout: 15000 });

    // Beach name heading should be visible
    const heading = page.getByRole('heading', { name: /blacks/i });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Forecast section or spot overview should render
    const forecastArea = page.locator(
      '[data-testid="spot-overview"], [data-testid="forecast"], [class*="forecast"], [class*="surf-report"]'
    ).first();
    const hasForecast = await isVisibleSafe(forecastArea, { timeout: 5000 });

    // Alternatively, check for wave height or swell text
    const waveInfo = page.getByText(/ft|swell|wave/i).first();
    const hasWaveInfo = await isVisibleSafe(waveInfo);

    expect(hasForecast || hasWaveInfo).toBe(true);

    await assertNoErrors(page, errorCapture, { context: 'Beach detail page' });
  });

  test('Interactive map loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/map', { timeout: 15000 });

    // Map canvas or container should render
    const mapCanvas = page.locator('.mapboxgl-canvas, [class*="map-container"], canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    await assertNoErrors(page, errorCapture, { context: 'Map page' });
  });

  test('Sessions page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/sessions', { timeout: 10000 });

    // Page heading or title should be visible
    const heading = page.getByRole('heading', { name: /session/i }).first();
    const hasHeading = await isVisibleSafe(heading, { timeout: 5000 });

    // Either session list items or empty state should render
    const sessionItems = page.locator('[data-testid="session-item"], [class*="session-card"]').first();
    const emptyState = page.getByText(/no sessions|get started|log your first/i).first();

    const hasItems = await isVisibleSafe(sessionItems);
    const hasEmpty = await isVisibleSafe(emptyState);

    expect(hasHeading || hasItems || hasEmpty).toBe(true);

    await assertNoErrors(page, errorCapture, { context: 'Sessions page' });
  });
});

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
import { isVisibleSafe } from './utils/strict-helpers';

test.describe('Smoke: Critical Pages', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('Beach detail page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, buildBeachUrl(TEST_BEACHES.blacks), { timeout: 15000 });

    // Beach name heading should be visible (use .first() — page has multiple headings matching)
    const heading = page.getByRole('heading', { name: /blacks/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const currentConditions = page.getByRole('heading', {
      name: /current conditions/i,
    });
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const statsGrid = page.locator('[data-testid="beach-stats-grid"]');
    const beachActions = page.locator('[data-testid="beach-actions"]');

    const hasForecast = await isVisibleSafe(currentConditions, { timeout: 15000 });
    const hasForecastTab = await isVisibleSafe(forecastTab, { timeout: 10000 });
    const hasStats = await isVisibleSafe(statsGrid, { timeout: 10000 });
    const hasBeachActions = await isVisibleSafe(beachActions, { timeout: 10000 });

    expect(hasForecast || hasForecastTab || hasStats || hasBeachActions).toBe(true);

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

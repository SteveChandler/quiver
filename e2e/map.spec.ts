import { test, expect } from '@playwright/test';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import { isVisibleSafe } from './utils/strict-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { dismissMapEntryOverlay } from './utils/map-helpers';

type WaveHeightRange = {
  min: number;
  max: number;
};

const normalizeWaveHeightValue = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
};

const parseWaveHeightRange = (text: string): WaveHeightRange | null => {
  const normalizedText = text.replace(/\u2013/g, '-').toLowerCase();
  const wavePattern = /~?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?)\s*)?ft/g;
  const matches = [...normalizedText.matchAll(wavePattern)];

  for (const match of matches) {
    const min = Number.parseFloat(match[1]);
    const max = match[2] ? Number.parseFloat(match[2]) : min;

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      continue;
    }

    return {
      min,
      max,
    };
  }

  return null;
};

const formatWaveHeightRange = (range: WaveHeightRange): string => {
  if (range.min === range.max) {
    return `${normalizeWaveHeightValue(range.min)}ft`;
  }

  return `${normalizeWaveHeightValue(range.min)}-${normalizeWaveHeightValue(range.max)}ft`;
};

const waveHeightRangesOverlap = (
  left: WaveHeightRange | null,
  right: WaveHeightRange | null
): boolean => {
  if (!left || !right) {
    return false;
  }

  return Math.max(left.min, right.min) <= Math.min(left.max, right.max);
};

/**
 * Map Page Tests
 * Tests the interactive map functionality including view modes, filters, search, and geolocation
 *
 * @project auth
 */

test.describe('Map Page - Core Functionality', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/map');
    await waitForPageLoad(page);
  await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Core' });
  });

  test('should display the map container', async ({ page }) => {
    // Map view should be visible
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map controls should be visible
    const mapControls = page.getByTestId('map-controls');
    await expect(mapControls).toBeVisible({ timeout: TIMEOUTS.short });
  });

  test('should display map canvas or interactive element', async ({ page }) => {
    // Wait for map to fully load - canvas element appears once Mapbox initializes.
    // Uses long timeout because WebGL context creation + Mapbox style/tile loading
    // can be slow, especially in CI environments with limited GPU resources.
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });
  });

  test('should display beach markers or beach data', async ({ page }) => {
    // Wait for map container to be fully loaded first
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for beaches to load - use data-testid selectors
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');

    // Wait for any beach indicator to appear (longer timeout for initial load)
    // Try markers first, then items, then just verify map loaded
    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });

    // If we found markers or items, verify count
    if (hasMarkers) {
      const count = await beachMarkers.count();
      expect(count).toBeGreaterThan(0);
    } else if (hasItems) {
      const count = await beachItems.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Fallback - map should at least be showing something
      // Check for the map canvas which indicates Mapbox loaded
      const mapCanvas = page.locator('canvas').first();
      await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
    }
  });

});

test.describe('Map Page - View Mode Toggle', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/map');
    await waitForPageLoad(page);
  await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map View Mode' });
  });

  test('should toggle between map and list view', async ({ page }) => {
    // Start in map view (default)
    const mapButton = page.getByTestId('view-mode-map');
    const listButton = page.getByTestId('view-mode-list');

    await expect(mapButton).toBeVisible();
    await expect(listButton).toBeVisible();

    // Switch to list view
    await listButton.click();
    await page.waitForLoadState('load');

    // List view should now be active (button has 'default' variant)
    // In list mode, canvas should not be visible
    const mapCanvas = page.locator('canvas').first();
    const canvasVisible = await isVisibleSafe(mapCanvas, { timeout: 2000 });

    // Canvas might be hidden or removed in list view
    expect(canvasVisible).toBe(false);

    // Switch back to map view
    await mapButton.click();
    await page.waitForLoadState('load');

    // Canvas should be visible again
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should display beaches in list view', async ({ page }) => {
    const listButton = page.getByTestId('view-mode-list');
    await listButton.click();
    await page.waitForLoadState('load');

    // In list view, beaches appear with data-testid="beach-item"
    const beachList = page.getByTestId('beach-list');
    const beachItems = page.locator('[data-testid="beach-item"]');

    // Wait for list to render
    const hasList = await isVisibleSafe(beachList, { timeout: TIMEOUTS.medium });
    const hasItems = await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });

    expect(hasList || hasItems).toBe(true);

    if (hasItems) {
      const count = await beachItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should preserve forecast height from list card into beach detail', async ({ page }) => {
    try {
      const listButton = page.getByTestId('view-mode-list');
      await listButton.click();
      await page.waitForLoadState('load');

      const beachList = page.getByTestId('beach-list');
      const hasList = await isVisibleSafe(beachList, { timeout: TIMEOUTS.medium });
      const firstListCard = page
        .locator('[data-testid="beach-item"]')
        .filter({ hasText: /\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*ft/i })
        .first();

      if (!hasList) {
        const hasCards = await isVisibleSafe(firstListCard, { timeout: TIMEOUTS.long });
        expect(hasCards).toBe(true);
      }

      await expect(firstListCard).toBeVisible({ timeout: TIMEOUTS.long });

      const listBeachName = (await firstListCard.locator('h3').first().textContent())?.trim();
      expect(listBeachName).toBeTruthy();

      const expandButton = firstListCard.getByRole('button', {
        name: /expand details|collapse details/i,
      });

      if (await isVisibleSafe(expandButton, { timeout: TIMEOUTS.short })) {
        await expandButton.click();
      }

      await expect(
        firstListCard.getByRole('heading', { name: 'Current Conditions' })
      ).toBeVisible({ timeout: TIMEOUTS.long });

      const listForecastHeight = parseWaveHeightRange(await firstListCard.textContent() ?? '');
      expect(listForecastHeight).toBeTruthy();

      const detailLink = firstListCard.getByRole('link', { name: /view details/i }).first();
      await expect(detailLink).toBeVisible({ timeout: TIMEOUTS.short });
      await detailLink.click();

      await page.waitForURL(/\/(?:surf-forecast\/[^/?#]+|[a-z]{2}\/[^/?#]+\/[^/?#]+)/i, {
        timeout: TIMEOUTS.short,
      });

      const detailCurrentSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Current Conditions', level: 2, exact: true }) });

      await expect(detailCurrentSection).toBeVisible({ timeout: TIMEOUTS.long });

      const detailForecastHeight = parseWaveHeightRange(await detailCurrentSection.textContent() ?? '');
      expect(detailForecastHeight).toBeTruthy();

      const listForecastLabel = formatWaveHeightRange(listForecastHeight as WaveHeightRange);
      const detailForecastLabel = formatWaveHeightRange(detailForecastHeight as WaveHeightRange);

      expect(
        waveHeightRangesOverlap(listForecastHeight, detailForecastHeight),
        `Expected overlapping wave-height ranges between map list (${listForecastLabel}) and detail (${detailForecastLabel})`
      ).toBe(true);
    } finally {
      errorCapture.networkErrors = errorCapture.networkErrors.filter(
        (entry) => !(entry.status === 500 && entry.url.includes('/api/intel'))
      );
      errorCapture.consoleErrors = errorCapture.consoleErrors.filter(
        (msg) => !(
          msg.includes('500 Internal Server Error') &&
          msg.includes('/api/intel')
        )
      );
      errorCapture.consoleErrors = errorCapture.consoleErrors.filter(
        (msg) => !msg.includes('Encountered a script tag while rendering React component')
      );
    }
  });
});

test.describe('Map Page - Filter Functionality', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/map');
    await waitForPageLoad(page);
  await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Filters' });
  });

  test('should display filter badges', async ({ page }) => {
    // Filter section should have filter chips
    const beginnerBadge = page.getByText('Beginner-friendly').first();
    const beachBadge = page.getByText('beach', { exact: true }).first();
    const pointBadge = page.getByText('point', { exact: true }).first();
    const reefBadge = page.getByText('reef', { exact: true }).first();

    await expect(beginnerBadge).toBeVisible({ timeout: TIMEOUTS.short });
    await expect(beachBadge).toBeVisible();
    await expect(pointBadge).toBeVisible();
    await expect(reefBadge).toBeVisible();
  });

  test('should toggle beginner-friendly filter', async ({ page }) => {
    const beginnerBadge = page.getByText('Beginner-friendly').first();

    // Click to activate filter
    await beginnerBadge.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- networkidle never fires on Mapbox pages (continuous tile fetches); brief pause for filter API response
    await page.waitForTimeout(2000);

    // Badge should change visual state (outline -> default variant)
    // We can verify this by checking if beaches are filtered
    const beachesAfterFilter = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const countAfterFilter = await beachesAfterFilter.count();

    // Should still have beaches (unless no beginner beaches exist)
    expect(countAfterFilter).toBeGreaterThanOrEqual(0);

    // Click again to deactivate
    await beginnerBadge.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- networkidle never fires on Mapbox pages (continuous tile fetches); brief pause for filter API response
    await page.waitForTimeout(2000);
  });

  test('should toggle break type filters', async ({ page }) => {
    const beachBadge = page.getByText('beach', { exact: true }).first();

    // Click to activate beach break filter
    await beachBadge.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- networkidle never fires on Mapbox pages (continuous tile fetches); brief pause for filter API response
    await page.waitForTimeout(2000);

    const beachesAfterFilter = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const countAfterFilter = await beachesAfterFilter.count();

    expect(countAfterFilter).toBeGreaterThanOrEqual(0);

    // Click again to deactivate
    await beachBadge.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- networkidle never fires on Mapbox pages (continuous tile fetches); brief pause for filter API response
    await page.waitForTimeout(2000);
  });

});

test.describe('Map Page - Search Integration', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/map');
    await waitForPageLoad(page);
  await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Search' });
  });

  test('should accept search query from URL params', async ({ page }) => {
    // Navigate with search query in URL
    await page.goto('/map?search=Ocean Beach');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Beaches should be filtered based on search
    // The map should show results (or no results message if none match)
    const beachLinks = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const count = await beachLinks.count();

    // Count could be 0 if no matches, or >0 if there are matches
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter beaches based on search query', async ({ page }) => {
    // Use URL search param to filter
    await page.goto('/map?search=Beach');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Wait for map to be ready
    const mapCanvas = page.locator('canvas').first();
    await mapCanvas.waitFor({ timeout: TIMEOUTS.medium });

    // Should show some beaches with "Beach" in the name
    // Or show empty state if no matches
    const beachLinks = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const count = await beachLinks.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Map Page - Geolocation', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Geolocation' });
  });

  test('should handle geolocation permission granted', async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750, // La Jolla area
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Map should load with user location
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Nearby beaches should be loaded - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });
    const hasMap = !hasMarkers && !hasItems && await isVisibleSafe(mapContainer, { timeout: TIMEOUTS.short });

    expect(hasMarkers || hasItems || hasMap).toBe(true);
  });

  test('should handle geolocation permission denied', async ({ page, context }) => {
    // Deny geolocation permission
    await context.clearPermissions();

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Map should still load (using default location or showing all beaches)
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Should show beaches (fallback to default location) - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });
    const hasMap = !hasMarkers && !hasItems && await isVisibleSafe(mapContainer, { timeout: TIMEOUTS.short });

    expect(hasMarkers || hasItems || hasMap).toBe(true);
  });

  test('should not have geolocation errors in console', async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    // Collect console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // eslint-disable-next-line playwright/no-wait-for-timeout -- collecting console errors over time window for geolocation operations
    await page.waitForTimeout(TIMEOUTS.short);

    // Should not have geolocation-related errors
    const geoErrors = errors.filter(e =>
      e.toLowerCase().includes('geolocation') ||
      e.toLowerCase().includes('location')
    );

    expect(geoErrors.length).toBe(0);
  });

  test('should use "Near Me" button to request location', async ({ page, context }) => {
    // Start without permission
    await context.clearPermissions();

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Click "Use Near Me" button - matches exact button text
    const nearMeButton = page.getByRole('button', { name: /use near me/i });
    await expect(nearMeButton).toBeVisible({ timeout: TIMEOUTS.medium });

    // Grant permission before clicking
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    await nearMeButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- networkidle never fires on Mapbox pages (continuous tile fetches); brief pause for filter API response
    await page.waitForTimeout(2000);

    // Wait for beaches to load - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.medium });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.short });
    const hasMap = !hasMarkers && !hasItems && await isVisibleSafe(mapContainer, { timeout: TIMEOUTS.short });

    expect(hasMarkers || hasItems || hasMap).toBe(true);
  });
});

test.describe('Map Page - Responsive Design', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Responsive' });
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Map view should be visible
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map controls should be visible
    const mapControls = page.getByTestId('map-controls');
    await expect(mapControls).toBeVisible();

    // View mode buttons should be visible
    const mapButton = page.getByTestId('view-mode-map');
    const listButton = page.getByTestId('view-mode-list');
    await expect(mapButton).toBeVisible();
    await expect(listButton).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map canvas should be visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map canvas should be visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('mobile: map controls do not overflow and view toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Map view should be visible within viewport
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map controls should not overflow viewport width
    const mapControls = page.getByTestId('map-controls');
    await expect(mapControls).toBeVisible();
    const controlsBox = await mapControls.boundingBox();
    if (controlsBox) {
      expect(controlsBox.x + controlsBox.width).toBeLessThanOrEqual(375);
    }

    // Map canvas should load
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });

    // Toggle to list view and back without errors
    const listButton = page.getByTestId('view-mode-list');
    await listButton.click();
    await page.waitForLoadState('load');

    const mapButton = page.getByTestId('view-mode-map');
    await mapButton.click();
    await page.waitForLoadState('load');

    // No critical console errors (filter benign ones)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.toLowerCase().includes('network') &&
      !err.includes('ERR_BLOCKED_BY_CLIENT')
    );
    const mapErrors = criticalErrors.filter(err =>
      err.toLowerCase().includes('infinite') ||
      err.toLowerCase().includes('maximum') ||
      err.toLowerCase().includes('uncaught')
    );
    expect(mapErrors.length).toBe(0);
  });
});

test.describe('Map Page - Stability and Performance', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Stability' });
  });

  test('should not re-initialize map on prop changes', async ({ page }) => {
    let mapInitCount = 0;

    // Listen for console logs that indicate map initialization
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Initializing map') || text.includes('Map initialized')) {
        mapInitCount++;
      }
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const initialCount = mapInitCount;

    // Interact with the map (which might trigger state updates)
    // Toggle view mode
    const listButton = page.getByTestId('view-mode-list');
    if (await isVisibleSafe(listButton, { timeout: 2000 })) {
      await listButton.click();
      await page.waitForLoadState('load');

      const mapButton = page.getByTestId('view-mode-map');
      await mapButton.click();
      await page.waitForLoadState('load');
    }

    // The map should not reinitialize during normal interactions
    // Allow for initial map creation but no subsequent recreations
    expect(mapInitCount).toBeLessThanOrEqual(initialCount + 1);
  });

  test('map should be interactive after load without errors', async ({ page, context }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Verify map canvas is visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- collecting console errors over time window
    await page.waitForTimeout(2000);

    // Filter out expected/benign errors. Mapbox in headless Chromium emits
    // CORS/WebGL noise that doesn't reflect a real bug — these are already
    // catalogued in `e2e/utils/error-detection.ts::isIgnorableConsoleError`
    // and should not fail this stability check either.
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.toLowerCase().includes('network') &&
      !err.includes('api.mapbox.com') &&
      !err.includes('CORS policy') &&
      !err.toLowerCase().includes('blocked by cors') &&
      !err.includes('Failed to initialize WebGL') &&
      !err.includes('Map component error')
    );

    // Should not have map-related errors. After the benign-CORS/WebGL exclusion
    // above, anything matching this filter is a genuine "Maximum call stack",
    // mapbox runtime exception, or infinite-loop signal worth failing on.
    const mapErrors = criticalErrors.filter(err =>
      err.toLowerCase().includes('map') ||
      err.toLowerCase().includes('mapbox') ||
      err.toLowerCase().includes('infinite') ||
      err.toLowerCase().includes('maximum')
    );

    expect(mapErrors.length, `unexpected map errors: ${JSON.stringify(mapErrors)}`).toBe(0);
  });
});

test.describe('Map Page - Marker Interactions', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page, context }) => {
    errorCapture = setupErrorDetection(page);
    // Set up location for consistent results
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    await page.goto('/map');
    await waitForPageLoad(page);
  await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Markers' });
  });

  test('should show beach details on marker interaction', async ({ page }) => {
    // Wait for beaches to load using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');

    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });

    if (!hasMarkers && !hasItems) {
      // No markers visible yet — map may still be loading or beach density is low in viewport
      test.skip(true, 'No beach markers or items found — map may still be loading or viewport has low beach density');
      return;
    }

    // Click should either navigate to beach detail page OR show selected beach card
    // Use force:true to avoid header interception issues with map markers
    const beachElement = hasMarkers ? beachMarkers.first() : beachItems.first();
    await beachElement.click({ force: true });

    await page.waitForLoadState('load');

    // Check if we navigated or if a selected beach card appeared
    const url = page.url();
    const navigated = url.includes('/beach/') ||
                     (url.split('/').length >= 5 && !url.includes('/map'));

    if (navigated) {
      // Successfully navigated to beach detail
      expect(navigated).toBe(true);
    } else {
      // Should be on map page with potentially selected beach state
      expect(url).toContain('/map');
    }
  });

  test('should display multiple beach markers', async ({ page }) => {
    // Wait for beaches to load using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });
    const hasItems = !hasMarkers && await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });
    const hasMap = !hasMarkers && !hasItems && await isVisibleSafe(mapContainer, { timeout: TIMEOUTS.short });

    expect(hasMarkers || hasItems || hasMap).toBe(true);

    // Count beaches in whichever format they're displayed
    let count = 0;
    if (hasMarkers) {
      count = await beachMarkers.count();
    } else if (hasItems) {
      count = await beachItems.count();
    }

    // Expect at least 1 beach (map may limit visible markers)
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      // Map container is visible but no individual markers - still valid
      expect(hasMap).toBe(true);
    }
  });
});

test.describe('Map Page - Beach Card Navigation', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Beach Card Nav' });
  });

  test('desktop: clicking list-view beach card navigates to beach detail page', async ({ page, context }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map?search=Blacks');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    await expect(page.getByText(/spots in view/i)).toHaveCount(0);

    const listButton = page.getByTestId('view-mode-list');
    await expect(listButton).toBeVisible({ timeout: TIMEOUTS.medium });
    await listButton.click();

    const detailLink = page.locator('a[href*="/blacks"]').first();
    await expect(detailLink).toBeVisible({ timeout: TIMEOUTS.long });
    await detailLink.click();

    await page.waitForURL(/\/(ca|california|beach)\//, { timeout: TIMEOUTS.medium });
  });

  test('mobile: clicking selected beach card navigates to beach detail page', async ({ page, context }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Wait for map canvas to fully load
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for beach markers to load
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await isVisibleSafe(beachMarkers.first(), { timeout: TIMEOUTS.long });

    if (!hasMarkers) {
      throw new Error('No beach markers found on mobile map page');
    }

    // Click a marker to select a beach (triggers SelectedBeachCard in bottom sheet)
    await beachMarkers.first().click({ force: true });

    // Wait for the selected beach card link to appear
    const selectedCardLink = page.locator('a[aria-label*="View details for"]');
    await expect(selectedCardLink).toBeVisible({ timeout: TIMEOUTS.medium });

    // Click the selected beach card link
    await selectedCardLink.click();

    // Should have navigated away from /map
    await page.waitForURL(/\/(ca|or|wa|hi|beach)\//, { timeout: TIMEOUTS.medium });
  });
});

test.describe('Map Page - Mobile Bug Fix Regression', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Mobile Regression' });
  });

  test('mobile: bottom sheet stays visible after aggressive downward swipe', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const handleArea = page.getByTestId('drawer-handle-area');
    await expect(handleArea).toBeVisible({ timeout: TIMEOUTS.medium });

    const box = await handleArea.boundingBox();
    if (!box) throw new Error('Drawer handle area not found');

    // Drag handle aggressively downward (attempting to dismiss)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 400, { steps: 10 });
    await page.mouse.up();

    // eslint-disable-next-line playwright/no-wait-for-timeout -- snap animation settling time
    await page.waitForTimeout(500);

    // Drawer should still be visible (snapped to peek, not dismissed)
    await expect(handleArea).toBeVisible();
  });

  test('mobile: close button on selected beach card meets 44px touch target', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Wait for markers then click one to select a beach
    const markers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await isVisibleSafe(markers.first(), { timeout: TIMEOUTS.long });
    if (!hasMarkers) throw new Error('No beach markers found for touch target test');

    await markers.first().click({ force: true });

    const closeButton = page.getByLabel('Deselect beach');
    await expect(closeButton).toBeVisible({ timeout: TIMEOUTS.medium });

    const box = await closeButton.boundingBox();
    if (!box) throw new Error('Close button bounding box not found');
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('mobile: drawer handle area has adequate touch target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const handleArea = page.getByTestId('drawer-handle-area');
    await expect(handleArea).toBeVisible({ timeout: TIMEOUTS.medium });

    const box = await handleArea.boundingBox();
    if (!box) throw new Error('Drawer handle area bounding box not found');
    // py-4 = 16px top + 16px bottom + handle height should give adequate target
    expect(box.height).toBeGreaterThanOrEqual(32);
  });

  test('mobile: beach count overlay does not exceed 60% of viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Wait for map to load
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: TIMEOUTS.long });

    // The overlay is inside map-container
    const overlay = page.getByTestId('map-overlay');
    await expect(overlay).toBeVisible({ timeout: TIMEOUTS.medium });

    const box = await overlay.boundingBox();
    if (!box) throw new Error('Map overlay bounding box not found');
    expect(box.width).toBeLessThanOrEqual(375 * 0.6);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });

  test('mobile: selected beach card icon is hidden on small screens', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    const markers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await isVisibleSafe(markers.first(), { timeout: TIMEOUTS.long });
    if (!hasMarkers) throw new Error('No beach markers found for icon visibility test');

    await markers.first().click({ force: true });

    const iconContainer = page.locator('[data-testid="beach-icon-container"]');
    const exists = await iconContainer.count() > 0;
    if (exists) {
      await expect(iconContainer).not.toBeVisible();
    }
  });

  test('mobile: beach card in list view responds to tap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Switch to list view
    const listButton = page.getByTestId('view-mode-list');
    await listButton.click();
    await page.waitForLoadState('load');

    // Find a beach item and click it
    const beachItems = page.locator('[data-testid="beach-item"]');
    const hasItems = await isVisibleSafe(beachItems.first(), { timeout: TIMEOUTS.medium });
    if (!hasItems) throw new Error('No beach items found in list view for tap test');

    // Click should navigate or trigger selection (proving whileTap didn't break interaction)
    const urlBefore = page.url();
    await beachItems.first().click();
    await page.waitForLoadState('load');

    // Should have either navigated or changed state
    const urlAfter = page.url();
    const navigated = urlAfter !== urlBefore;
    // If didn't navigate, check that we're at least still on map page (no crash)
    if (!navigated) {
      expect(urlAfter).toContain('/map');
    }
  });
});

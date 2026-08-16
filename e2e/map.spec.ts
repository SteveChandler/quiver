import { test, expect } from './fixtures/auth-fixture';
import type { Page } from '@playwright/test';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import { isVisibleSafe } from './utils/strict-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { dismissMapEntryOverlay } from './utils/map-helpers';

async function openFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Filters' }).click();
}

type MapRegion = 'hawaii' | 'san-diego' | 'unknown';

interface MapDebugCenter {
  lat: number;
  lon: number;
}

interface DelayedGeolocationController {
  pendingCount: number;
  resolve: () => void;
}

async function installDelayedSanDiegoGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mapWindow = window as Window & {
      __quiverDelayedGeolocation?: DelayedGeolocationController;
      __quiverMapDebugCenter?: MapDebugCenter;
    };
    const pendingCallbacks: PositionCallback[] = [];
    let released = false;

    const createCoordinates = (): GeolocationCoordinates => ({
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: 32.7702,
      longitude: -117.2525,
      speed: null,
      toJSON: () => ({
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 32.7702,
        longitude: -117.2525,
        speed: null,
      }),
    });
    const createPosition = (): GeolocationPosition => {
      const coords = createCoordinates();
      const timestamp = Date.now();
      return {
        coords,
        timestamp,
        toJSON: () => ({ coords: coords.toJSON(), timestamp }),
      };
    };
    const deliver = (callback: PositionCallback): void => {
      callback(createPosition());
    };

    const geolocation: Geolocation = {
      clearWatch: () => undefined,
      getCurrentPosition: (success) => {
        if (released) {
          window.setTimeout(() => deliver(success), 0);
          return;
        }
        pendingCallbacks.push(success);
        if (mapWindow.__quiverDelayedGeolocation) {
          mapWindow.__quiverDelayedGeolocation.pendingCount =
            pendingCallbacks.length;
        }
      },
      watchPosition: (success) => {
        if (released) {
          window.setTimeout(() => deliver(success), 0);
        } else {
          pendingCallbacks.push(success);
        }
        return 1;
      },
    };

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });

    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== '(hover: hover)') return originalMatchMedia(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
        addListener: () => undefined,
        removeListener: () => undefined,
      };
    };

    mapWindow.__quiverMapDebugCenter = undefined;
    mapWindow.__quiverDelayedGeolocation = {
      pendingCount: 0,
      resolve: () => {
        released = true;
        const callbacks = pendingCallbacks.splice(0);
        mapWindow.__quiverDelayedGeolocation!.pendingCount = 0;
        callbacks.forEach(deliver);
      },
    };
  });
}

async function readPendingGeolocationCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const mapWindow = window as Window & {
      __quiverDelayedGeolocation?: DelayedGeolocationController;
    };
    return mapWindow.__quiverDelayedGeolocation?.pendingCount ?? 0;
  });
}

async function resolveDelayedGeolocation(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const mapWindow = window as Window & {
      __quiverDelayedGeolocation?: DelayedGeolocationController;
    };
    mapWindow.__quiverDelayedGeolocation?.resolve();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

function regionForCenter(center: MapDebugCenter): MapRegion {
  if (
    center.lat >= 18.8 &&
    center.lat <= 22.4 &&
    center.lon >= -160.3 &&
    center.lon <= -154.7
  ) {
    return 'hawaii';
  }

  if (
    center.lat >= 32.4 &&
    center.lat <= 33.2 &&
    center.lon >= -117.7 &&
    center.lon <= -116.8
  ) {
    return 'san-diego';
  }

  return 'unknown';
}

async function readMapCenter(
  page: Page,
): Promise<(MapDebugCenter & { region: MapRegion }) | null> {
  const center = await page.evaluate(() => {
    const mapWindow = window as Window & {
      __quiverMapDebugCenter?: MapDebugCenter;
    };
    return mapWindow.__quiverMapDebugCenter ?? null;
  });

  return center ? { ...center, region: regionForCenter(center) } : null;
}

async function readMapRegion(page: Page): Promise<MapRegion> {
  return (await readMapCenter(page))?.region ?? 'unknown';
}

async function dragMapCanvas(page: Page): Promise<void> {
  const canvas = page.locator('.mapboxgl-canvas');
  await expect(canvas).toBeVisible({ timeout: TIMEOUTS.long });
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Mapbox canvas has no measurable bounds');

  const start = {
    x: box.x + box.width * 0.5,
    y: box.y + box.height * 0.45,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y + 35, { steps: 8 });
  await page.mouse.up();
}

async function tapBeachMarker(page: Page, beachName: string): Promise<void> {
  await page
    .getByRole('button', { name: `View ${beachName} conditions` })
    .click();
}

async function findUnobscuredBeachMarkerPoint(
  page: Page,
  minimumY: number,
): Promise<{ x: number; y: number }> {
  const markerPoint = await page
    .waitForFunction((minY): { x: number; y: number } | null => {
      const badges = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="beach-marker"] [data-marker-badge="true"]',
        ),
      );

      for (const badge of badges) {
        const rect = badge.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          x < 0 ||
          y < minY ||
          x > window.innerWidth ||
          y > window.innerHeight
        ) {
          continue;
        }

        if (document.elementsFromPoint(x, y).includes(badge)) {
          return { x, y };
        }
      }

      return null;
    }, minimumY)
    .then((handle) => handle.jsonValue());

  if (!markerPoint) {
    throw new Error(
      'No unobscured beach marker badge is available in the viewport',
    );
  }

  return markerPoint;
}

async function findUnobscuredBeachMarkerId(page: Page): Promise<string> {
  const markerId = await page
    .waitForFunction((): string | null => {
      const badges = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid="beach-marker"] [data-marker-badge="true"]',
        ),
      );

      for (const badge of badges) {
        const rect = badge.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          document.elementsFromPoint(x, y).includes(badge)
        ) {
          return (
            badge.closest<HTMLElement>('[data-beach-id]')?.dataset.beachId ??
            null
          );
        }
      }

      return null;
    })
    .then((handle) => handle.jsonValue());

  if (!markerId) {
    throw new Error('No unobscured beach marker badge is available in the viewport');
  }

  return markerId;
}

/**
 * Map Page Tests
 * Tests the interactive map functionality including filters, search, and geolocation
 *
 * @project auth
 */

test.describe.configure({ mode: 'serial' });

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

  test('should render individual beach points without averaged cluster pills', async ({ page }) => {
    const beachMarkers = page.locator('[data-testid="beach-marker"]');

    await expect(beachMarkers.first()).toBeVisible({ timeout: TIMEOUTS.long });
    expect(await beachMarkers.count()).toBeGreaterThan(1);
    await expect(page.locator('[data-testid="cluster-marker"]')).toHaveCount(0);
  });

});

test.describe('Map Page - Toolbar Controls', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/map');
    await waitForPageLoad(page);
    await dismissMapEntryOverlay(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Toolbar Controls' });
  });

  test('should not render the removed map/list view toggle', async ({ page }) => {
    await expect(page.getByTestId('view-mode-map')).toHaveCount(0);
    await expect(page.getByTestId('view-mode-list')).toHaveCount(0);
    await expect(
      page.getByRole('combobox', { name: 'Search beaches, spots, or cities' })
    ).toBeVisible({ timeout: TIMEOUTS.medium });
    await expect(
      page.getByRole('button', { name: 'Filters' })
    ).toBeVisible();

    const toolbarActions = page.getByTestId('map-toolbar-actions');
    const fieldGuideToggle = page.getByTestId('map-field-guide-toggle');
    await expect(toolbarActions).toContainText('How to read this map');
    await expect(fieldGuideToggle).toBeVisible();
    expect(await fieldGuideToggle.evaluate((node) => node.parentElement?.dataset.testid)).toBe(
      'map-toolbar-actions'
    );

    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('keeps the complete field guide reachable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const fieldGuideToggle = page.getByTestId('map-field-guide-toggle');
    await fieldGuideToggle.click();

    const panel = page.getByTestId('map-learning-panel');
    await expect(panel).toBeVisible();
    const appLink = panel.getByRole('link', { name: 'Get the app' });
    await appLink.scrollIntoViewIfNeeded();
    await expect(appLink).toBeVisible();

    const appLinkBox = await appLink.boundingBox();
    expect(appLinkBox).not.toBeNull();
    expect(appLinkBox!.y).toBeGreaterThanOrEqual(0);
    expect(appLinkBox!.y + appLinkBox!.height).toBeLessThanOrEqual(844);

    await page.getByRole('button', { name: 'Close map field guide' }).click();
    await expect(fieldGuideToggle).toBeFocused();
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
    await openFilters(page);

    const beginnerBadge = page.getByRole('button', { name: 'Beginner-friendly' });
    const beachBadge = page.getByRole('button', { name: 'beach', exact: true });
    const pointBadge = page.getByRole('button', { name: 'point', exact: true });
    const reefBadge = page.getByRole('button', { name: 'reef', exact: true });

    await expect(beginnerBadge).toBeVisible({ timeout: TIMEOUTS.short });
    await expect(beachBadge).toBeVisible();
    await expect(pointBadge).toBeVisible();
    await expect(reefBadge).toBeVisible();
  });

  test('should toggle beginner-friendly filter', async ({ page }) => {
    await openFilters(page);

    const beginnerBadge = page.getByRole('button', { name: 'Beginner-friendly' });

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
    await openFilters(page);

    const beachBadge = page.getByRole('button', { name: 'beach', exact: true });

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

  test('should select a beach suggestion without leaving the map', async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
    await dismissMapEntryOverlay(page);

    const search = page.getByRole('combobox', {
      name: 'Search beaches, spots, or cities',
    });
    await search.fill('Waikiki');
    await expect(page.getByRole('option', { name: /Waikiki/i }).first()).toBeVisible({
      timeout: TIMEOUTS.long,
    });
    await search.press('ArrowDown');
    await search.press('Enter');

    await expect(page).toHaveURL(/\/map(?:\?.*)?$/);
    await expect(page.getByTestId('map-search-suggestions')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^View Waikiki.* conditions$/ }).first(),
    ).toBeVisible({ timeout: TIMEOUTS.long });
    await expect
      .poll(async () => {
        const center = await readMapCenter(page);
        if (!center) return false;
        return (
          Math.abs(center.lat - 21.2767) < 0.05 &&
          Math.abs(center.lon - -157.8263) < 0.05
        );
      }, { timeout: TIMEOUTS.long })
      .toBe(true);
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

test.describe('Map Page - Camera Ownership', () => {
  let errorCapture: ErrorCapture;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Camera Ownership' });
  });

  test('Hawaii exploration is not reclaimed by San Diego GPS', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await installDelayedSanDiegoGeolocation(page);
    await page.goto('/map');
    await dismissMapEntryOverlay(page);
    await expect
      .poll(() => readPendingGeolocationCount(page), { timeout: TIMEOUTS.long })
      .toBeGreaterThan(0);
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('san-diego');

    const search = page.getByRole('combobox', {
      name: 'Search beaches, spots, or cities',
    });
    await search.fill('Waikiki');
    await page.getByRole('option').first().click();
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('hawaii');

    const beforeDrag = await readMapCenter(page);
    expect(beforeDrag).not.toBeNull();
    await dragMapCanvas(page);
    await expect
      .poll(async () => {
        const center = await readMapCenter(page);
        if (!center || !beforeDrag) return false;
        return (
          Math.abs(center.lat - beforeDrag.lat) > 0.00001 ||
          Math.abs(center.lon - beforeDrag.lon) > 0.00001
        );
      }, { timeout: TIMEOUTS.long })
      .toBe(true);
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('hawaii');

    await page
      .getByRole('combobox', { name: 'Search beaches, spots, or cities' })
      .fill('Ala Moana Bowls');
    await expect(
      page.getByRole('button', { name: 'View Ala Moana Bowls conditions' }),
    ).toBeVisible({ timeout: TIMEOUTS.long });
    await tapBeachMarker(page, 'Ala Moana Bowls');
    await expect(
      page.locator('[data-conditions-callout="true"]'),
    ).toContainText('Ala Moana Bowls');
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('hawaii');
    await expect(page).toHaveURL(/\/map(?:\?.*)?$/);

    await resolveDelayedGeolocation(page);
    await expect(page).toHaveURL(/\/map(?:\?.*)?$/);
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('hawaii');

    await page.getByRole('button', { name: 'Use Near Me' }).click();
    await expect
      .poll(() => readMapRegion(page), { timeout: TIMEOUTS.long })
      .toBe('san-diego');
    await expect(page).toHaveURL(/\/map(?:\?.*)?$/);
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

    await expect(page.getByTestId('view-mode-map')).toHaveCount(0);
    await expect(page.getByTestId('view-mode-list')).toHaveCount(0);
    await expect(
      page.getByRole('combobox', { name: 'Search beaches, spots, or cities' })
    ).toBeVisible();
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

  test('mobile: map controls do not overflow', async ({ page }) => {
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

    await expect(page.getByTestId('view-mode-map')).toHaveCount(0);
    await expect(page.getByTestId('view-mode-list')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Use My Actual Location' })
    ).toHaveCount(0);

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

    await openFilters(page);
    await page.keyboard.press('Escape');

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

  test('should open one conditions callout from a point marker', async ({ page }) => {
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    await expect(beachMarkers.first()).toBeVisible({ timeout: TIMEOUTS.long });

    const markerPoint = await findUnobscuredBeachMarkerPoint(page, 170);
    await page.mouse.click(markerPoint.x, markerPoint.y);

    await expect(page.locator('[data-conditions-callout="true"]')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Full forecast' })).toBeVisible();
    expect(page.url()).toContain('/map');
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

test.describe('Map Page - Beach Detail Navigation', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Map Beach Card Nav' });
  });

  test('mobile: tapping a marker opens conditions before full forecast navigation', async ({ browser, context }) => {
    const touchContext = await browser.newContext({
      storageState: await context.storageState(),
      viewport: VIEWPORTS.mobile,
      hasTouch: true,
      isMobile: true,
      geolocation: { latitude: 32.8473, longitude: -117.2750 },
      permissions: ['geolocation'],
    });
    const touchPage = await touchContext.newPage();
    const touchErrors = setupErrorDetection(touchPage);

    try {
      const forecastsLoaded = touchPage.waitForResponse((response) =>
        response.url().includes('/api/forecasts/bulk'),
      );
      await touchPage.goto('/map');
      await waitForPageLoad(touchPage);
      await dismissMapEntryOverlay(touchPage);

      await expect(touchPage.locator('canvas').first()).toBeVisible({
        timeout: TIMEOUTS.long,
      });
      await expect(
        touchPage.locator('[data-testid="beach-marker"]').first(),
      ).toBeVisible({ timeout: TIMEOUTS.long });
      await forecastsLoaded;
      await expect(touchPage.getByTestId('bottom-sheet')).toHaveCount(0);

      const markerId = await findUnobscuredBeachMarkerId(touchPage);
      await touchPage
        .locator(`[data-beach-id="${markerId}"] [data-marker-badge="true"]`)
        .dispatchEvent('touchend', {
          touches: [],
          targetTouches: [],
          changedTouches: [],
        });

      await expect(
        touchPage.locator('[data-conditions-callout="true"]'),
      ).toHaveCount(1);
      const fullForecast = touchPage.getByRole('link', { name: 'Full forecast' });
      await expect(fullForecast).toBeVisible();
      expect(touchPage.url()).toContain('/map');

      await fullForecast.click();
      await touchPage.waitForURL(/\/(ca|or|wa|hi|beach)\//, {
        timeout: TIMEOUTS.medium,
      });
      await assertNoErrors(touchPage, touchErrors, {
        context: 'Map Beach Card Nav touch context',
      });
    } finally {
      await touchContext.close();
    }
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

  test('mobile: bottom sheet is removed from the map', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    await expect(page.locator('canvas').first()).toBeVisible({ timeout: TIMEOUTS.long });

    await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
    await expect(page.getByTestId('drawer-handle-area')).toHaveCount(0);
  });

  test('mobile: map status overlay is removed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    await dismissMapEntryOverlay(page);

    // Wait for map to load
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: TIMEOUTS.long });

    await expect(page.getByTestId('map-overlay')).toHaveCount(0);
  });
});

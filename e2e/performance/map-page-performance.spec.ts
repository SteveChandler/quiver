import { test, expect } from '@playwright/test';
import {
  collectWebVitals,
  collectPerformanceTimings,
  assertWebVitalsThresholds,
  collectNetworkMetrics,
  createPerformanceReport,
} from '../../__tests__/performance/helpers/web-vitals-helpers';

/**
 * Map Page Performance Test Suite
 *
 * Tests performance metrics for the map page including:
 * - Lazy loading and Mapbox initialization
 * - Beach marker rendering (50+ markers)
 * - View mode transitions (Map ↔ List)
 * - Region filtering and tab switching
 * - Beach selection and map updates
 * - Pan/zoom interactions
 * - Search functionality
 */

test.describe('Map Page Performance', () => {
  const MAP_URL = '/map';

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load map page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(MAP_URL);
    await page.waitForLoadState('domcontentloaded');

    // Wait for map container or list view
    await page.waitForSelector('.mapboxgl-canvas, [data-testid="map"], [data-testid="beach-list"]', {
      timeout: 5000,
      state: 'visible'
    });

    const loadTime = Date.now() - startTime;

    console.log(`[Map Page Load] ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should meet Web Vitals thresholds', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Give enough time for map to initialize
    await page.waitForTimeout(2000);

    const metrics = await collectWebVitals(page, 4000);
    console.log('[Map Page Web Vitals]', JSON.stringify(metrics, null, 2));

    const { passed, failures } = assertWebVitalsThresholds(metrics, {
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      fcp: 1800,
    });

    if (!passed) {
      console.error('[Map Page Web Vitals] Failures:', failures);
    }

    expect(passed).toBe(true);
  });

  test('should have good performance timings', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    const timings = await collectPerformanceTimings(page);
    console.log('[Map Page Timings]', JSON.stringify(timings, null, 2));

    expect(timings.domContentLoaded).toBeLessThan(2000);
    expect(timings.loadComplete).toBeLessThan(4000); // Slightly higher for map initialization

    if (timings.firstPaint > 0) {
      expect(timings.firstPaint).toBeLessThan(1500);
    }
  });

  test('should initialize MapView component quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(MAP_URL);

    // Wait for MapView wrapper to appear (before map fully loads)
    await page.waitForSelector('[data-testid="map-view"], .map-view, main', {
      timeout: 3000,
      state: 'visible'
    });

    const mapViewRenderTime = Date.now() - startTime;

    console.log(`[MapView Component Render] ${mapViewRenderTime}ms`);
    expect(mapViewRenderTime).toBeLessThan(2000);
  });

  test('should initialize Mapbox efficiently', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Wait for Mapbox canvas to appear
    await page.waitForSelector('.mapboxgl-canvas', {
      timeout: 5000,
      state: 'visible'
    }).catch(() => {
      console.log('[Mapbox] Canvas not found - may be in list view');
    });

    const mapboxInitTime = Date.now() - startTime;

    console.log(`[Mapbox Initialization] ${mapboxInitTime}ms`);
    expect(mapboxInitTime).toBeLessThan(3500);
  });

  test('should render beach markers efficiently', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Ensure we're in map view
    const viewToggle = page.locator('button:has-text("Map"), [aria-label*="Map" i]').first();
    const isVisible = await viewToggle.isVisible().catch(() => false);
    if (isVisible) {
      await viewToggle.click();
      await page.waitForTimeout(500);
    }

    // Wait for markers to load
    await page.waitForSelector('.mapboxgl-canvas', { timeout: 5000 }).catch(() => {
      console.log('[Map] Canvas not available');
    });

    // Count API calls for beach data
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/beaches')) {
        apiCalls.push(req.url());
      }
    });

    await page.waitForTimeout(1000);

    console.log(`[Beach Markers] ${apiCalls.length} API calls for beach data`);

    // Should not make excessive API calls
    expect(apiCalls.length).toBeLessThan(5);
  });

  test('should toggle view mode quickly (Map ↔ List)', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Find view toggle buttons
    const mapButton = page.locator('button:has-text("Map"), [aria-label*="Map view" i]').first();
    const listButton = page.locator('button:has-text("List"), [aria-label*="List view" i]').first();

    // Ensure one of them is visible
    await Promise.race([
      mapButton.waitFor({ state: 'visible', timeout: 2000 }),
      listButton.waitFor({ state: 'visible', timeout: 2000 })
    ]).catch(() => {
      console.log('[View Toggle] Buttons not found');
    });

    // Test Map → List transition
    const isListButtonVisible = await listButton.isVisible().catch(() => false);
    if (isListButtonVisible) {
      const mapToListStart = Date.now();
      await listButton.click();
      await page.waitForTimeout(100);
      const mapToListTime = Date.now() - mapToListStart;

      console.log(`[View Toggle: Map → List] ${mapToListTime}ms`);
      expect(mapToListTime).toBeLessThan(300);
    }

    // Test List → Map transition
    const isMapButtonVisible = await mapButton.isVisible().catch(() => false);
    if (isMapButtonVisible) {
      const listToMapStart = Date.now();
      await mapButton.click();
      await page.waitForTimeout(100);
      const listToMapTime = Date.now() - listToMapStart;

      console.log(`[View Toggle: List → Map] ${listToMapTime}ms`);
      expect(listToMapTime).toBeLessThan(300);
    }
  });

  test('should switch region tabs quickly', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Find region tabs (ALL, region names)
    const regionTabs = page.locator('role=tab, [role="tab"]');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Click second tab
      const switchStart = Date.now();
      await regionTabs.nth(1).click();
      await page.waitForTimeout(100);
      const switchTime = Date.now() - switchStart;

      console.log(`[Region Tab Switch] ${switchTime}ms (${tabCount} tabs available)`);
      expect(switchTime).toBeLessThan(200);
    } else {
      console.log('[Region Tabs] Not enough tabs to test switching');
    }
  });

  test('should apply filters quickly', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Look for filter chips/buttons
    const beginnerFilter = page.locator('button:has-text("Beginner"), [data-filter="beginner-friendly"]').first();
    const isVisible = await beginnerFilter.isVisible().catch(() => false);

    if (isVisible) {
      const filterStart = Date.now();
      await beginnerFilter.click();
      await page.waitForTimeout(200);
      const filterTime = Date.now() - filterStart;

      console.log(`[Filter Application] ${filterTime}ms`);
      expect(filterTime).toBeLessThan(300);
    } else {
      console.log('[Filters] Filter buttons not found');
    }
  });

  test('should handle beach selection quickly', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Find a beach card in the list
    const beachCard = page.locator('[data-testid^="beach-card"], .beach-card, article').first();
    const isVisible = await beachCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const selectionStart = Date.now();
      await beachCard.click();
      await page.waitForTimeout(300);
      const selectionTime = Date.now() - selectionStart;

      console.log(`[Beach Selection] ${selectionTime}ms`);
      expect(selectionTime).toBeLessThan(200);
    } else {
      console.log('[Beach Selection] No beach cards found');
    }
  });

  test('should handle "Near Me" geolocation button efficiently', async ({ page }) => {
    // Grant geolocation permission
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 32.7157, longitude: -117.1611 }); // San Diego

    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Find "Near Me" button
    const nearMeButton = page.locator('button:has-text("Near Me"), [aria-label*="Near me" i]').first();
    const isVisible = await nearMeButton.isVisible().catch(() => false);

    if (isVisible) {
      const geoStart = Date.now();
      await nearMeButton.click();
      await page.waitForTimeout(500);
      const geoTime = Date.now() - geoStart;

      console.log(`[Near Me Geolocation] ${geoTime}ms`);
      expect(geoTime).toBeLessThan(1000);
    } else {
      console.log('[Near Me] Button not found');
    }
  });

  test('should have responsive search autocomplete', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    const isVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const searchStart = Date.now();
      await searchInput.fill('Black');
      await page.waitForTimeout(500);
      const searchTime = Date.now() - searchStart;

      console.log(`[Map Search Autocomplete] ${searchTime}ms`);
      expect(searchTime).toBeLessThan(1000);
    } else {
      console.log('[Search] Input not found');
    }
  });

  test('should have efficient network usage', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    const networkMetrics = await collectNetworkMetrics(page);
    console.log('[Map Page Network Metrics]', JSON.stringify(networkMetrics, null, 2));

    // Map page can have more requests due to Mapbox tiles
    expect(networkMetrics.totalRequests).toBeLessThan(150);

    // Total size should be reasonable
    expect(networkMetrics.totalSize).toBeLessThan(5 * 1024 * 1024); // 5MB

    // API calls should be efficient
    if (networkMetrics.byType.fetch) {
      console.log(`[API Calls] ${networkMetrics.byType.fetch.count} fetch requests`);
    }
  });

  test('should handle map pan/zoom interactions smoothly', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Wait for map canvas
    const mapCanvas = page.locator('.mapboxgl-canvas').first();
    const isVisible = await mapCanvas.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const bbox = await mapCanvas.boundingBox();
      if (bbox) {
        // Simulate pan gesture
        const panStart = Date.now();
        await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
        await page.mouse.down();
        await page.mouse.move(bbox.x + bbox.width / 2 + 100, bbox.y + bbox.height / 2 + 100);
        await page.mouse.up();
        await page.waitForTimeout(300);
        const panTime = Date.now() - panStart;

        console.log(`[Map Pan] ${panTime}ms`);
        expect(panTime).toBeLessThan(500);

        // Check for smooth rendering (no janky layout shifts)
        const metrics = await collectWebVitals(page, 1000);
        console.log(`[Map Pan CLS] ${metrics.cls}`);
        expect(metrics.cls).toBeLessThan(0.15); // Slightly higher tolerance for map interactions
      }
    } else {
      console.log('[Map Pan/Zoom] Map canvas not available');
    }
  });

  test('should render beach list in list view efficiently', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Switch to list view
    const listButton = page.locator('button:has-text("List"), [aria-label*="List view" i]').first();
    const isVisible = await listButton.isVisible().catch(() => false);

    if (isVisible) {
      await listButton.click();
      await page.waitForTimeout(300);

      // Count rendered beach cards
      const beachCards = page.locator('[data-testid^="beach-card"], .beach-card, article');
      const cardCount = await beachCards.count();

      console.log(`[List View] ${cardCount} beach cards rendered`);

      // Should render a reasonable number efficiently
      expect(cardCount).toBeGreaterThan(0);
      expect(cardCount).toBeLessThan(100); // Virtualization should limit this
    } else {
      console.log('[List View] Could not switch to list view');
    }
  });

  test('should generate comprehensive map page performance report', async ({ page }) => {
    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Give map time to fully load
    await page.waitForTimeout(2000);

    const metrics = await collectWebVitals(page, 4000);
    const timings = await collectPerformanceTimings(page);

    const report = createPerformanceReport(metrics, timings);

    console.log('\n' + '='.repeat(60));
    console.log('MAP PAGE PERFORMANCE REPORT');
    console.log('='.repeat(60));
    console.log(report);
    console.log('='.repeat(60) + '\n');

    expect(report).toBeTruthy();
    expect(report.length).toBeGreaterThan(0);
  });
});

test.describe('Map Page Performance (Guest Users)', () => {
  const MAP_URL = '/map';

  test.use({
    storageState: { cookies: [], origins: [] }
  });

  test('should load map page for guest users', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(MAP_URL);
    await page.waitForLoadState('load');

    // Guest users may be redirected or see a different view
    const loadTime = Date.now() - startTime;

    console.log(`[Map Page Load (Guest)] ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3500);
  });
});

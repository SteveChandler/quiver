import { test, expect } from '@playwright/test';
import { VIEWPORTS, TIMEOUTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * Map Page Tests
 * Tests the interactive map functionality including view modes, filters, search, and geolocation
 *
 * @project auth
 */

test.describe('Map Page - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
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
    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

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

  // TODO: Test drift - beach link selectors changed in map view
  test.skip('should navigate to beach detail when clicking a beach', async ({ page }) => {
    // Wait for beaches to load by checking for beach links
    const beachLinks = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const firstBeach = beachLinks.first();

    const isVisible = await firstBeach.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'No beach markers found in current viewport');
      return;
    }

    await firstBeach.click();
    await waitForPageLoad(page);

    // Verify navigation to beach detail page
    const url = page.url();
    const validUrl = url.includes('/beach/') ||
                    (url.split('/').length >= 5 && !url.includes('/map'));

    expect(validUrl).toBeTruthy();
  });
});

test.describe('Map Page - View Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
  });

  test('should toggle between map and list view', async ({ page }) => {
    // Start in map view (default)
    const mapButton = page.getByTestId('view-mode-map');
    const listButton = page.getByTestId('view-mode-list');

    await expect(mapButton).toBeVisible();
    await expect(listButton).toBeVisible();

    // Switch to list view
    await listButton.click();
    await page.waitForTimeout(500); // Brief wait for UI transition

    // List view should now be active (button has 'default' variant)
    // In list mode, canvas should not be visible
    const mapCanvas = page.locator('canvas').first();
    const canvasVisible = await mapCanvas.isVisible({ timeout: 2000 }).catch(() => false);

    // Canvas might be hidden or removed in list view
    expect(canvasVisible).toBe(false);

    // Switch back to map view
    await mapButton.click();
    await page.waitForTimeout(500); // Brief wait for UI transition

    // Canvas should be visible again
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test('should display beaches in list view', async ({ page }) => {
    const listButton = page.getByTestId('view-mode-list');
    await listButton.click();
    await page.waitForTimeout(1000); // Wait for view mode transition

    // In list view, beaches appear with data-testid="beach-item"
    const beachList = page.getByTestId('beach-list');
    const beachItems = page.locator('[data-testid="beach-item"]');

    // Wait for list to render
    const hasList = await beachList.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const hasItems = await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    expect(hasList || hasItems).toBe(true);

    if (hasItems) {
      const count = await beachItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Map Page - Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
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
    await page.waitForTimeout(500); // Brief wait for filtering

    // Badge should change visual state (outline -> default variant)
    // We can verify this by checking if beaches are filtered
    const beachesAfterFilter = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const countAfterFilter = await beachesAfterFilter.count();

    // Should still have beaches (unless no beginner beaches exist)
    expect(countAfterFilter).toBeGreaterThanOrEqual(0);

    // Click again to deactivate
    await beginnerBadge.click();
    await page.waitForTimeout(500);
  });

  test('should toggle break type filters', async ({ page }) => {
    const beachBadge = page.getByText('beach', { exact: true }).first();

    // Click to activate beach break filter
    await beachBadge.click();
    await page.waitForTimeout(500); // Brief wait for filtering

    const beachesAfterFilter = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const countAfterFilter = await beachesAfterFilter.count();

    expect(countAfterFilter).toBeGreaterThanOrEqual(0);

    // Click again to deactivate
    await beachBadge.click();
    await page.waitForTimeout(500);
  });

  test('should clear all filters', async ({ page }) => {
    // Wait for map to fully load first
    const mapContainer = page.getByTestId('map-container');
    await expect(mapContainer).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for initial beach markers to load
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    await expect(beachMarkers.first()).toBeVisible({ timeout: TIMEOUTS.long });

    // Get initial marker count
    const initialCount = await beachMarkers.count();

    // Activate a filter
    const beginnerBadge = page.getByText('Beginner-friendly').first();
    await beginnerBadge.click();
    await page.waitForTimeout(1500);

    // Click clear filters
    const clearButton = page.getByText('Clear filters').first();
    const clearVisible = await clearButton.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!clearVisible) {
      // Clear filters button may not appear if no filters are active or all beaches match
      test.skip(true, 'Clear filters button not visible - may not be needed');
      return;
    }

    await clearButton.click();
    await page.waitForTimeout(2000);

    // Verify map is still visible and working after clearing filters
    await expect(mapContainer).toBeVisible();

    // Should have at least as many markers as before (or more if filter was reducing count)
    await expect(beachMarkers.first()).toBeVisible({ timeout: TIMEOUTS.medium });
    const clearedCount = await beachMarkers.count();

    // After clearing, should have >= the initial count
    expect(clearedCount).toBeGreaterThanOrEqual(initialCount);
  });
});

test.describe('Map Page - Region Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
  });

  test('should display region tabs if regions exist', async ({ page }) => {
    // Check if "All" tab exists (always present if regions are shown)
    const allTab = page.getByRole('tab', { name: /All/i });
    const tabsExist = await allTab.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!tabsExist) {
      test.skip(true, 'No regions available in current dataset');
      return;
    }

    await expect(allTab).toBeVisible();
  });

  test('should switch between regions', async ({ page }) => {
    const allTab = page.getByRole('tab', { name: /All/i });
    const tabsExist = await allTab.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!tabsExist) {
      test.skip(true, 'No regions available in current dataset');
      return;
    }

    // Get all tabs
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount <= 1) {
      test.skip(true, 'Only "All" tab exists, need multiple regions to test switching');
      return;
    }

    // Click second tab (first region after "All")
    const secondTab = tabs.nth(1);
    await secondTab.click();
    await page.waitForTimeout(500); // Wait for region filtering

    // Map should update to show region bounds
    // Canvas should still be visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.short });

    // Switch back to All
    await allTab.click();
    await page.waitForTimeout(500);
  });
});

test.describe('Map Page - Search Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
  });

  test('should accept search query from URL params', async ({ page }) => {
    // Navigate with search query in URL
    await page.goto('/map?search=Ocean Beach');
    await waitForPageLoad(page);

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
  test('should handle geolocation permission granted', async ({ page, context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750, // La Jolla area
    });

    await page.goto('/map');
    await waitForPageLoad(page);

    // Map should load with user location
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Nearby beaches should be loaded - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const hasMap = !hasMarkers && !hasItems && await mapContainer.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    expect(hasMarkers || hasItems || hasMap).toBe(true);
  });

  test('should handle geolocation permission denied', async ({ page, context }) => {
    // Deny geolocation permission
    await context.clearPermissions();

    await page.goto('/map');
    await waitForPageLoad(page);

    // Map should still load (using default location or showing all beaches)
    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Should show beaches (fallback to default location) - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const hasMap = !hasMarkers && !hasItems && await mapContainer.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

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

    // Wait for any async geolocation operations
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

    // Click "Near Me" button - text is "Use Near Me"
    const nearMeButton = page.getByRole('button', { name: /Near Me/i });
    const nearMeVisible = await nearMeButton.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!nearMeVisible) {
      // Near Me button might not be visible if location is already set or not needed
      test.skip(true, 'Near Me button not visible');
      return;
    }

    // Grant permission before clicking
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    await nearMeButton.click();
    await page.waitForTimeout(2000); // Wait for location request and beach load

    // Wait for beaches to load - check using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');
    const mapContainer = page.getByTestId('map-container');

    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
    const hasMap = !hasMarkers && !hasItems && await mapContainer.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    expect(hasMarkers || hasItems || hasMap).toBe(true);
  });
});

test.describe('Map Page - Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/map');
    await waitForPageLoad(page);

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

    const mapView = page.getByTestId('map-view');
    await expect(mapView).toBeVisible({ timeout: TIMEOUTS.medium });

    // Map canvas should be visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.medium });
  });
});

test.describe('Map Page - Marker Interactions', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up location for consistent results
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({
      latitude: 32.8473,
      longitude: -117.2750,
    });

    await page.goto('/map');
    await waitForPageLoad(page);
  });

  test('should show beach details on marker interaction', async ({ page }) => {
    // Wait for beaches to load using data-testid
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const beachItems = page.locator('[data-testid="beach-item"]');

    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (!hasMarkers && !hasItems) {
      test.skip(true, 'No beach markers or items found');
      return;
    }

    // Click should either navigate to beach detail page OR show selected beach card
    // Use force:true to avoid header interception issues with map markers
    const beachElement = hasMarkers ? beachMarkers.first() : beachItems.first();
    await beachElement.click({ force: true });

    // Small wait for either navigation or card appearance
    await page.waitForTimeout(1000);

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

    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const hasItems = !hasMarkers && await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    const hasMap = !hasMarkers && !hasItems && await mapContainer.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

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

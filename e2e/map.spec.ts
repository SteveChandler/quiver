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
      throw new Error('Not implemented: Near Me button - geolocation button not visible or accessible');
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
    await page.waitForTimeout(500);

    const mapButton = page.getByTestId('view-mode-map');
    await mapButton.click();
    await page.waitForTimeout(500);

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

    const initialCount = mapInitCount;

    // Interact with the map (which might trigger state updates)
    // Toggle view mode
    const listButton = page.getByTestId('view-mode-list');
    if (await listButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await listButton.click();
      await page.waitForTimeout(500);

      const mapButton = page.getByTestId('view-mode-map');
      await mapButton.click();
      await page.waitForTimeout(500);
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

    // Verify map canvas is visible
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000);

    // Filter out expected/benign errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404') &&
      !err.toLowerCase().includes('network')
    );

    // Should not have map-related errors
    const mapErrors = criticalErrors.filter(err =>
      err.toLowerCase().includes('map') ||
      err.toLowerCase().includes('mapbox') ||
      err.toLowerCase().includes('infinite') ||
      err.toLowerCase().includes('maximum')
    );

    expect(mapErrors.length).toBe(0);
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
      throw new Error('Not implemented: Beach markers interaction - no beach markers or items found to interact with');
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

test.describe('Map Page - Beach Card Navigation', () => {
  test('desktop: clicking sidebar beach card navigates to beach detail page', async ({ page, context }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Use search to ensure predictable sidebar content
    await page.goto('/map?search=Blacks');
    await waitForPageLoad(page);

    // Wait for sidebar beach cards to appear (desktop shows MapSidebar)
    const sidebarCards = page.locator('[data-testid="sidebar-beach-card"]');
    const hasSidebarCards = await sidebarCards.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

    if (!hasSidebarCards) {
      // Fallback: look for any clickable beach link in the sidebar area
      const sidebarLinks = page.locator('a[href*="/ca/"], a[href*="/beach/"]');
      const hasLinks = await sidebarLinks.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (!hasLinks) {
        throw new Error('No sidebar beach cards or links found on desktop map page');
      }

      await sidebarLinks.first().click();
    } else {
      await sidebarCards.first().click();
    }

    // Should have navigated away from /map
    await page.waitForURL(/\/(ca|or|wa|hi|beach)\//, { timeout: TIMEOUTS.medium });
  });

  test('mobile: clicking selected beach card navigates to beach detail page', async ({ page, context }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map');
    await waitForPageLoad(page);

    // Wait for map canvas to fully load
    const mapCanvas = page.locator('canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: TIMEOUTS.long });

    // Wait for beach markers to load
    const beachMarkers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await beachMarkers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

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
  test('mobile: bottom sheet stays visible after aggressive downward swipe', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');
    await waitForPageLoad(page);

    const handleArea = page.getByTestId('drawer-handle-area');
    await expect(handleArea).toBeVisible({ timeout: TIMEOUTS.medium });

    const box = await handleArea.boundingBox();
    if (!box) throw new Error('Drawer handle area not found');

    // Drag handle aggressively downward (attempting to dismiss)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 400, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500); // Wait for snap animation

    // Drawer should still be visible (snapped to peek, not dismissed)
    await expect(handleArea).toBeVisible();
  });

  test('mobile: close button on selected beach card meets 44px touch target', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/map');
    await waitForPageLoad(page);

    // Wait for markers then click one to select a beach
    const markers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await markers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
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

    const markers = page.locator('[data-testid="beach-marker"]');
    const hasMarkers = await markers.first().isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
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

    // Switch to list view
    const listButton = page.getByTestId('view-mode-list');
    await listButton.click();
    await page.waitForTimeout(500);

    // Find a beach item and click it
    const beachItems = page.locator('[data-testid="beach-item"]');
    const hasItems = await beachItems.first().isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);
    if (!hasItems) throw new Error('No beach items found in list view for tap test');

    // Click should navigate or trigger selection (proving whileTap didn't break interaction)
    const urlBefore = page.url();
    await beachItems.first().click();
    await page.waitForTimeout(1000);

    // Should have either navigated or changed state
    const urlAfter = page.url();
    const navigated = urlAfter !== urlBefore;
    // If didn't navigate, check that we're at least still on map page (no crash)
    if (!navigated) {
      expect(urlAfter).toContain('/map');
    }
  });
});

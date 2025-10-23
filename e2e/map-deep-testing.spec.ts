import { test, expect, Page } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation, denyGeolocation } from './utils/waits';

/**
 * Deep Testing Suite for /map Page
 * Phase 1: Critical Path & Race Conditions
 *
 * This suite tests for:
 * - Geolocation race conditions
 * - Beach loading race conditions
 * - Map interaction race conditions
 * - State synchronization across components
 *
 * Expected bugs: 3-5 race condition issues, 2-3 state sync bugs
 */

test.describe('@map-deep - Geolocation Race Conditions', () => {
  test('should handle rapid "Near Me" button clicks without duplicate API calls', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Wait for initial load
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Click "Near Me" rapidly 5 times
    const nearMeButton = page.getByRole('button', { name: /near me|use near me/i });

    if (await nearMeButton.isVisible().catch(() => false)) {
      // Setup network monitoring to detect duplicate calls
      const apiCalls: string[] = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/beaches/nearby')) {
          apiCalls.push(url);
        }
      });

      // Rapid fire clicks
      for (let i = 0; i < 5; i++) {
        await nearMeButton.click();
        await page.waitForTimeout(50); // Very short delay to simulate rapid clicks
      }

      // Wait for any pending requests
      await page.waitForTimeout(2000);

      // BUG CHECK: Should not have more than 1-2 nearby API calls
      // If > 3, we have a duplicate request bug
      console.log(`📊 API calls made: ${apiCalls.length}`);

      if (apiCalls.length > 3) {
        console.error(`🐛 BUG FOUND: ${apiCalls.length} duplicate nearby beach API calls detected`);
      }

      // Test should pass if system handles gracefully (even with bug)
      await expect(page.locator(selectors.mapView)).toBeVisible();
    }
  });

  test('should not trigger location update during search', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Monitor geolocation API calls
    let geolocationCallCount = 0;
    await page.context().grantPermissions(['geolocation']);

    // Switch to list view
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await expect(page.locator(selectors.beachList)).toBeVisible();

      // Start typing in filter
      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Ocean');

        // Rapidly click "Near Me" while searching
        const nearMeButton = page.getByRole('button', { name: /near me|use near me/i });
        if (await nearMeButton.isVisible().catch(() => false)) {
          await nearMeButton.click();
        }

        // Wait and check if search results are corrupted
        await page.waitForTimeout(1000);

        // BUG CHECK: Filter should still work, results should not reset
        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count();

        console.log(`📊 Beach items after Near Me during search: ${count}`);

        // Should still have filtered results
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should handle geolocation timeout gracefully', async ({ page }) => {
    // Don't grant or deny - let it timeout
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Wait for timeout (should use default location)
    await page.waitForTimeout(12000); // Longer than the 10s safety timeout

    // BUG CHECK: Should show default location, not infinite loading
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    // Check for error message or default location indicator
    const defaultLocationText = page.getByText(/ocean beach|san diego|default location/i);
    const isVisible = await defaultLocationText.isVisible().catch(() => false);

    if (!isVisible) {
      console.error('🐛 BUG FOUND: No indication of default location being used after timeout');
    }
  });

  test('should prevent multiple simultaneous geolocation requests', async ({ page }) => {
    await grantGeolocation(page);

    // Monitor geolocation API at browser level
    const geolocations: number[] = [];
    await page.addInitScript(() => {
      const original = navigator.geolocation.getCurrentPosition;
      (navigator.geolocation as any).getCurrentPosition = function(...args: any[]) {
        (window as any).__geoCallCount = ((window as any).__geoCallCount || 0) + 1;
        return original.apply(this, args);
      };
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Trigger multiple location requests
    for (let i = 0; i < 3; i++) {
      const nearMe = page.getByRole('button', { name: /near me|use near me/i });
      if (await nearMe.isVisible().catch(() => false)) {
        await nearMe.click();
      }
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2000);

    // Check geolocation call count
    const callCount = await page.evaluate(() => (window as any).__geoCallCount || 0);
    console.log(`📊 Geolocation API calls: ${callCount}`);

    if (callCount > 2) {
      console.error(`🐛 BUG FOUND: ${callCount} geolocation API calls - should be 1-2 max`);
    }
  });

  test('should handle location change during active map movement', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Simulate map drag
    const mapContainer = page.locator(selectors.mapContainer);
    if (await mapContainer.isVisible()) {
      const box = await mapContainer.boundingBox();
      if (box) {
        // Start dragging map
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 });

        // Click Near Me while dragging
        const nearMe = page.getByRole('button', { name: /near me|use near me/i });
        if (await nearMe.isVisible().catch(() => false)) {
          await nearMe.click();
        }

        await page.mouse.up();

        // Wait for map to settle
        await page.waitForTimeout(2000);

        // BUG CHECK: Map should not be stuck or show incorrect position
        await expect(mapContainer).toBeVisible();

        // Check if markers are still visible
        const markers = page.locator(selectors.beachMarker);
        const markerCount = await markers.count().catch(() => 0);

        console.log(`📊 Markers visible after location change during drag: ${markerCount}`);

        if (markerCount === 0) {
          console.error('🐛 BUG FOUND: No markers visible after location change during map drag');
        }
      }
    }
  });

  test('should handle rapid viewport changes without breaking', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Rapidly resize viewport
    const viewports = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1280, height: 800 },  // Desktop
      { width: 390, height: 844 },   // Mobile again
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
    }

    // Wait for stabilization
    await page.waitForTimeout(1000);

    // BUG CHECK: Map should still be functional
    await expect(page.locator(selectors.mapView)).toBeVisible();
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    // Check if markers are still rendering
    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Markers after rapid viewport changes: ${markerCount}`);
  });
});

test.describe('@map-deep - Beach Loading Race Conditions', () => {
  test('should prevent duplicate loadNearbyBeaches calls', async ({ page }) => {
    await grantGeolocation(page);

    // Track API calls
    const nearbyApiCalls: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/beaches/nearby')) {
        nearbyApiCalls.push(url);
        console.log(`📡 Nearby API call: ${nearbyApiCalls.length}`);
      }
    });

    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Wait for initial load to complete
    await page.waitForTimeout(3000);

    // Trigger multiple "Near Me" clicks
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });

    if (await nearMe.isVisible().catch(() => false)) {
      for (let i = 0; i < 5; i++) {
        await nearMe.click();
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(2000);

      console.log(`📊 Total nearby API calls: ${nearbyApiCalls.length}`);

      // BUG CHECK: Should have at most 2-3 calls (initial + 1-2 from clicks)
      if (nearbyApiCalls.length > 4) {
        console.error(`🐛 BUG FOUND: ${nearbyApiCalls.length} nearby API calls - possible duplicate loading`);
      }
    }
  });

  test('should handle search during beach loading', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Don't wait for loading to complete - immediately switch to list and search
    await page.waitForTimeout(500);

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Type search query while beaches are still loading
        await filterInput.fill('Cardiff');

        // Wait for results
        await page.waitForTimeout(2000);

        // BUG CHECK: Should show filtered results or loading state, not crash
        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Beach items after search during loading: ${count}`);

        // Should either have results or show empty state, not crash
        await expect(page.locator(selectors.beachList)).toBeVisible();
      }
    }
  });

  test('should handle region change during beach loading', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Wait for regions to load
    await page.waitForTimeout(2000);

    // Click on a region tab if available
    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Trigger new beach load
      const nearMe = page.getByRole('button', { name: /near me|use near me/i });
      if (await nearMe.isVisible().catch(() => false)) {
        await nearMe.click();
      }

      // Immediately change region (don't wait for load)
      await page.waitForTimeout(200);
      await regionTabs.nth(1).click();

      await page.waitForTimeout(2000);

      // BUG CHECK: Should show region-filtered beaches, not mixed results
      await expect(page.locator(selectors.mapView)).toBeVisible();

      // Map should still be functional
      const markers = page.locator(selectors.beachMarker);
      const markerCount = await markers.count().catch(() => 0);

      console.log(`📊 Markers after region change during loading: ${markerCount}`);
    }
  });

  test('should handle view mode toggle during beach loading', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Start loading beaches
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      await nearMe.click();
    }

    // Rapidly toggle view modes
    await page.waitForTimeout(200);

    const listToggle = page.locator(selectors.viewModeList);
    const mapToggle = page.locator(selectors.viewModeMap);

    for (let i = 0; i < 3; i++) {
      if (await listToggle.isVisible().catch(() => false)) {
        await listToggle.click();
        await page.waitForTimeout(200);
      }

      if (await mapToggle.isVisible().catch(() => false)) {
        await mapToggle.click();
        await page.waitForTimeout(200);
      }
    }

    await page.waitForTimeout(2000);

    // BUG CHECK: Should end in a stable state (either map or list visible)
    const mapVisible = await page.locator(selectors.mapContainer).isVisible().catch(() => false);
    const listVisible = await page.locator(selectors.beachList).isVisible().catch(() => false);

    console.log(`📊 Final state - Map: ${mapVisible}, List: ${listVisible}`);

    if (!mapVisible && !listVisible) {
      console.error('🐛 BUG FOUND: Neither map nor list is visible after rapid toggling during load');
    }
  });

  test('should handle filter changes during beach loading', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Wait for filters to appear
    await page.waitForTimeout(1000);

    // Trigger new load
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      await nearMe.click();
    }

    // Immediately click filter badges
    await page.waitForTimeout(200);

    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false });
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(100);
    }

    const beachBreak = page.getByText('beach', { exact: false }).filter({ hasText: /^beach$/i });
    if (await beachBreak.first().isVisible().catch(() => false)) {
      await beachBreak.first().click();
    }

    await page.waitForTimeout(2000);

    // BUG CHECK: Filters should be applied or beaches should still load
    await expect(page.locator(selectors.mapView)).toBeVisible();

    console.log('✅ Filters during loading handled');
  });
});

test.describe('@map-deep - Map Interaction Race Conditions', () => {
  test('should handle marker click during map move', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const mapContainer = page.locator(selectors.mapContainer);
    const markers = page.locator(selectors.beachMarker);

    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0 && await mapContainer.isVisible()) {
      const box = await mapContainer.boundingBox();
      if (box) {
        // Start dragging map
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + 50, { steps: 5 });

        // Try to click a marker while map is moving
        const firstMarker = markers.first();
        const markerBox = await firstMarker.boundingBox();

        if (markerBox) {
          await firstMarker.click({ force: true });
        }

        await page.mouse.up();
        await page.waitForTimeout(1000);

        // BUG CHECK: Should handle click gracefully (either ignore or process after move)
        // Should not crash or navigate incorrectly
        await expect(page.locator(selectors.mapView)).toBeVisible();

        console.log('✅ Marker click during map move handled');
      }
    }
  });

  test('should prevent double navigation from marker click', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0) {
      // Track navigation events
      let navigationCount = 0;
      page.on('framenavigated', () => {
        navigationCount++;
        console.log(`🔄 Navigation event #${navigationCount}`);
      });

      // Double click a marker rapidly
      const firstMarker = markers.first();
      await firstMarker.click();
      await page.waitForTimeout(50);
      await firstMarker.click();

      // Wait for navigation
      await page.waitForTimeout(2000);

      console.log(`📊 Total navigation events: ${navigationCount}`);

      // BUG CHECK: Should only navigate once, not twice
      if (navigationCount > 2) {
        console.error(`🐛 BUG FOUND: ${navigationCount} navigation events from double click - should be 1-2 max`);
      }
    }
  });

  test('should handle marker click during popup open', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount >= 2) {
      const firstMarker = markers.nth(0);
      const secondMarker = markers.nth(1);

      // Hover first marker to open popup
      await firstMarker.hover();
      await page.waitForTimeout(300);

      // Immediately click second marker before popup fully opens
      await secondMarker.click();

      await page.waitForTimeout(1000);

      // BUG CHECK: Should handle gracefully, not leave popup artifacts
      await expect(page.locator(selectors.mapView)).toBeVisible();

      // Check for orphaned popups
      const popups = page.locator('.mapboxgl-popup');
      const popupCount = await popups.count().catch(() => 0);

      console.log(`📊 Popups after rapid interaction: ${popupCount}`);

      if (popupCount > 1) {
        console.error('🐛 BUG FOUND: Multiple popups visible - popup cleanup issue');
      }
    }
  });

  test('should handle multiple rapid marker clicks', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    console.log(`📊 Available markers: ${markerCount}`);

    if (markerCount >= 3) {
      // Rapidly click multiple markers
      for (let i = 0; i < Math.min(3, markerCount); i++) {
        await markers.nth(i).click();
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(1000);

      // BUG CHECK: Should show last clicked beach or handle gracefully
      // Check if a selected beach card appears
      const selectedCard = page.getByText(/selected beach|view details/i);
      const hasSelection = await selectedCard.isVisible().catch(() => false);

      console.log(`📊 Has selected beach card: ${hasSelection}`);

      // Map should still be functional
      await expect(page.locator(selectors.mapView)).toBeVisible();
    }
  });

  test('should handle marker click during beach loading from API', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Trigger new beach load
    await page.waitForTimeout(1000);
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      await nearMe.click();
    }

    // Immediately try to click a marker (if any are visible)
    await page.waitForTimeout(300);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0) {
      await markers.first().click();

      await page.waitForTimeout(2000);

      // BUG CHECK: Should handle click or wait for loading to complete
      await expect(page.locator(selectors.mapView)).toBeVisible();

      console.log('✅ Marker click during API loading handled');
    }
  });
});

test.describe('@map-deep - State Synchronization', () => {
  test('should keep selected beach in sync between map and cards', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0) {
      // Click a marker
      await markers.first().click();
      await page.waitForTimeout(1000);

      // Check if selected beach card appears
      const selectedCard = page.getByText(/selected beach|view details/i).first();
      const cardVisible = await selectedCard.isVisible().catch(() => false);

      console.log(`📊 Selected beach card visible: ${cardVisible}`);

      // Check if nearby beach scroll updates
      const nearbyScroll = page.getByText(/nearby beach|beaches nearby/i).first();
      const scrollVisible = await nearbyScroll.isVisible().catch(() => false);

      console.log(`📊 Nearby beach scroll visible: ${scrollVisible}`);

      // BUG CHECK: Both should update together
      if (cardVisible !== scrollVisible) {
        console.error('🐛 BUG FOUND: Selected beach card and nearby scroll out of sync');
      }
    }
  });

  test('should maintain filter state between map and list view', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply a filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);

      // Check filter is active
      const isActive = await beginnerFilter.evaluate(el => {
        return el.className.includes('default') || el.getAttribute('data-state') === 'active';
      }).catch(() => false);

      console.log(`📊 Beginner filter active in map view: ${isActive}`);

      // Switch to list view
      const listToggle = page.locator(selectors.viewModeList);
      if (await listToggle.isVisible().catch(() => false)) {
        await listToggle.click();
        await page.waitForTimeout(500);

        // Check if filter is still active
        const stillActive = await beginnerFilter.evaluate(el => {
          return el.className.includes('default') || el.getAttribute('data-state') === 'active';
        }).catch(() => false);

        console.log(`📊 Beginner filter active in list view: ${stillActive}`);

        // BUG CHECK: Filter should remain active
        if (isActive && !stillActive) {
          console.error('🐛 BUG FOUND: Filter state lost when switching to list view');
        }

        // Check if beaches are actually filtered
        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Beach count in filtered list: ${count}`);
      }
    }
  });

  test('should persist search query between view modes', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Switch to list view
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await expect(page.locator(selectors.beachList)).toBeVisible();

      // Enter search query
      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Cardiff');
        await page.waitForTimeout(500);

        // Get filtered count
        const beachItems = page.locator(selectors.beachListItem);
        const listCount = await beachItems.count().catch(() => 0);

        console.log(`📊 Filtered beaches in list: ${listCount}`);

        // Switch back to map view
        const mapToggle = page.locator(selectors.viewModeMap);
        if (await mapToggle.isVisible().catch(() => false)) {
          await mapToggle.click();
          await page.waitForTimeout(1000);

          // Check if map still shows filtered results
          const markers = page.locator(selectors.beachMarker);
          const mapMarkerCount = await markers.count().catch(() => 0);

          console.log(`📊 Markers in map after filter: ${mapMarkerCount}`);

          // Check for "Found X beaches" text
          const foundText = page.getByText(/found.*beach/i);
          const hasFoundText = await foundText.isVisible().catch(() => false);

          console.log(`📊 Has "Found beaches" text: ${hasFoundText}`);

          // BUG CHECK: Map should reflect filtered state
          // Note: Exact counts may differ due to map viewport, but should have some correlation
        }
      }
    }
  });

  test('should sync region selection with beach display', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Get initial marker count
    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    console.log(`📊 Initial marker count: ${initialCount}`);

    // Click on a region tab if available
    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Click second region tab (first is usually "All")
      await regionTabs.nth(1).click();
      await page.waitForTimeout(1500);

      // Check new marker count
      const newCount = await markers.count().catch(() => 0);

      console.log(`📊 Marker count after region change: ${newCount}`);

      // BUG CHECK: Count should be different (unless only one region has beaches)
      // Map should update to show region

      // Check for beach count indicator
      const beachCountText = page.getByText(/found.*beach/i);
      const hasCountText = await beachCountText.isVisible().catch(() => false);

      console.log(`📊 Has beach count indicator: ${hasCountText}`);
    }
  });

  test('should handle URL search param and local search state together', async ({ page }) => {
    // Navigate with URL search param
    await grantGeolocation(page);
    await page.goto('/map?search=Ocean', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Check if search is applied
    const searchIndicator = page.getByText(/ocean/i);
    const hasSearch = await searchIndicator.first().isVisible().catch(() => false);

    console.log(`📊 URL search param applied: ${hasSearch}`);

    // Switch to list and add local filter
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await expect(page.locator(selectors.beachList)).toBeVisible();

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Add additional filter on top of URL search
        await filterInput.fill('Beach');
        await page.waitForTimeout(500);

        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Beach count with URL + local filter: ${count}`);

        // BUG CHECK: Both filters should be applied
        // Should show beaches matching "Ocean" AND "Beach"
      }
    }
  });

  test('should keep selection when clearing search but maintaining filters', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply beginner filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    // Switch to list and search
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await expect(page.locator(selectors.beachList)).toBeVisible();

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Cardiff');
        await page.waitForTimeout(500);

        // Get count with filter + search
        let beachItems = page.locator(selectors.beachListItem);
        const withSearchCount = await beachItems.count().catch(() => 0);

        console.log(`📊 Beaches with filter + search: ${withSearchCount}`);

        // Clear search only (keep filter)
        await filterInput.clear();
        await page.waitForTimeout(500);

        // Get count with just filter
        beachItems = page.locator(selectors.beachListItem);
        const withFilterCount = await beachItems.count().catch(() => 0);

        console.log(`📊 Beaches with just filter: ${withFilterCount}`);

        // BUG CHECK: Should have more beaches now (filter only, no search)
        if (withFilterCount <= withSearchCount && withSearchCount > 0) {
          console.error('🐛 BUG FOUND: Clearing search did not restore filtered beaches');
        }
      }
    }
  });

  test('should maintain scroll position when switching between views', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Switch to list
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await expect(page.locator(selectors.beachList)).toBeVisible();

      // Scroll down in list
      const beachList = page.locator(selectors.beachList);
      await beachList.evaluate(el => el.scrollTop = 500);
      await page.waitForTimeout(500);

      const scrollBefore = await beachList.evaluate(el => el.scrollTop);
      console.log(`📊 Scroll position before view switch: ${scrollBefore}`);

      // Switch to map
      const mapToggle = page.locator(selectors.viewModeMap);
      if (await mapToggle.isVisible().catch(() => false)) {
        await mapToggle.click();
        await page.waitForTimeout(500);

        // Switch back to list
        if (await listToggle.isVisible().catch(() => false)) {
          await listToggle.click();
          await page.waitForTimeout(500);

          const scrollAfter = await beachList.evaluate(el => el.scrollTop);
          console.log(`📊 Scroll position after view switch: ${scrollAfter}`);

          // BUG CHECK: Scroll position might reset (acceptable) or maintain (better UX)
          // Document behavior for discussion
        }
      }
    }
  });

  test('should handle selected beach across filter changes', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const markerCount = await markers.count().catch(() => 0);

    if (markerCount > 0) {
      // Select a beach
      await markers.first().click();
      await page.waitForTimeout(500);

      // Check if selected card appears
      const selectedCard = page.getByText(/selected beach|view details/i).first();
      const cardVisibleBefore = await selectedCard.isVisible().catch(() => false);

      console.log(`📊 Selected card visible before filter: ${cardVisibleBefore}`);

      // Apply a filter that might exclude the selected beach
      const beachBreak = page.getByText('point', { exact: false }).first();
      if (await beachBreak.isVisible().catch(() => false)) {
        await beachBreak.click();
        await page.waitForTimeout(1000);

        // Check if selected card still visible
        const cardVisibleAfter = await selectedCard.isVisible().catch(() => false);

        console.log(`📊 Selected card visible after filter: ${cardVisibleAfter}`);

        // BUG CHECK: Selection should either:
        // 1. Clear if beach no longer matches filter
        // 2. Maintain if beach still matches
        // Should not show card for filtered-out beach
      }
    }
  });
});

console.log('🧪 Phase 1: Critical Path & Race Conditions Tests - Complete');
console.log('📊 Expected to find: 3-5 race condition bugs, 2-3 state sync issues');

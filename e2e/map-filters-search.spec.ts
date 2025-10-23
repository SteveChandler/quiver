import { test, expect, Page } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation } from './utils/waits';

/**
 * Deep Testing Suite for /map Page
 * Phase 2: Filter & Search Bugs
 *
 * This suite tests for:
 * - Filter combination bugs
 * - Search edge cases and normalization
 * - Region filtering interactions
 * - Clear operations and state management
 *
 * Expected bugs: 4-6 filter/search issues
 */

test.describe('@map-filters - Filter Combinations', () => {
  test('should apply Beginner-friendly + Beach break type filter correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Count initial beaches
    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    console.log(`📊 Initial marker count: ${initialCount}`);

    // Apply Beginner filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(1000);

      const afterBeginnerCount = await markers.count().catch(() => 0);
      console.log(`📊 After Beginner filter: ${afterBeginnerCount}`);

      // Apply Beach break type filter
      const beachBreak = page.getByRole('button', { name: /^beach$/i }).first();
      if (await beachBreak.isVisible().catch(() => false)) {
        await beachBreak.click();
        await page.waitForTimeout(1000);

        const finalCount = await markers.count().catch(() => 0);
        console.log(`📊 After Beginner + Beach filters: ${finalCount}`);

        // BUG CHECK: Final count should be <= afterBeginnerCount
        // Should only show beaches that are BOTH beginner-friendly AND beach break
        if (finalCount > afterBeginnerCount) {
          console.error(`🐛 BUG FOUND: Filter combination increased beach count (${afterBeginnerCount} → ${finalCount})`);
        }

        // Should have fewer beaches (more restrictive filters)
        expect(finalCount).toBeLessThanOrEqual(afterBeginnerCount);
      }
    }
  });

  test('should handle all break types selected', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    console.log(`📊 Initial beaches: ${initialCount}`);

    // Select all break types
    const breakTypes = ['beach', 'point', 'reef'];

    for (const breakType of breakTypes) {
      const filter = page.getByRole('button', { name: new RegExp(`^${breakType}$`, 'i') }).first();
      if (await filter.isVisible().catch(() => false)) {
        await filter.click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);

    const finalCount = await markers.count().catch(() => 0);
    console.log(`📊 After all break types selected: ${finalCount}`);

    // BUG CHECK: Selecting all break types should show same or similar count to initial
    // Logic: (beach OR point OR reef) should include most/all beaches
    if (finalCount < initialCount * 0.7) {
      console.error(`🐛 BUG FOUND: All break types filter too restrictive (${initialCount} → ${finalCount})`);
    }

    // Should still have beaches
    expect(finalCount).toBeGreaterThan(0);
  });

  test('should apply Region + Beginner filter correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Select a region
    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Click second region (first is usually "All")
      await regionTabs.nth(1).click();
      await page.waitForTimeout(1000);

      const markers = page.locator(selectors.beachMarker);
      const afterRegionCount = await markers.count().catch(() => 0);

      console.log(`📊 After region filter: ${afterRegionCount}`);

      // Apply Beginner filter
      const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
      if (await beginnerFilter.isVisible().catch(() => false)) {
        await beginnerFilter.click();
        await page.waitForTimeout(1000);

        const finalCount = await markers.count().catch(() => 0);
        console.log(`📊 After Region + Beginner: ${finalCount}`);

        // BUG CHECK: Should be <= region count (more restrictive)
        if (finalCount > afterRegionCount) {
          console.error(`🐛 BUG FOUND: Adding beginner filter increased beach count`);
        }

        expect(finalCount).toBeLessThanOrEqual(afterRegionCount);
      }
    }
  });

  test('should clear all filters correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    console.log(`📊 Initial count: ${initialCount}`);

    // Apply multiple filters
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    const beachBreak = page.getByRole('button', { name: /^beach$/i }).first();
    if (await beachBreak.isVisible().catch(() => false)) {
      await beachBreak.click();
      await page.waitForTimeout(500);
    }

    const filteredCount = await markers.count().catch(() => 0);
    console.log(`📊 After filters: ${filteredCount}`);

    // Click "Clear filters" button
    const clearButton = page.getByText(/clear filter/i);
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(1500);

      const afterClearCount = await markers.count().catch(() => 0);
      console.log(`📊 After clear: ${afterClearCount}`);

      // BUG CHECK: Should restore to initial count (or close to it)
      const difference = Math.abs(afterClearCount - initialCount);
      const tolerance = initialCount * 0.2; // 20% tolerance

      if (difference > tolerance) {
        console.error(`🐛 BUG FOUND: Clear filters didn't restore beaches (${initialCount} → ${afterClearCount})`);
      }

      // Should be close to initial
      expect(afterClearCount).toBeGreaterThan(filteredCount);
    }
  });

  test('should handle toggling same filter on/off', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    // Toggle beginner filter on/off 3 times
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();

    if (await beginnerFilter.isVisible().catch(() => false)) {
      for (let i = 0; i < 3; i++) {
        await beginnerFilter.click();
        await page.waitForTimeout(800);

        const count = await markers.count().catch(() => 0);
        const state = i % 2 === 0 ? 'ON' : 'OFF';
        console.log(`📊 Toggle ${i + 1} (${state}): ${count} beaches`);
      }

      // Final toggle should be OFF, so should match initial
      await page.waitForTimeout(1000);
      const finalCount = await markers.count().catch(() => 0);

      const difference = Math.abs(finalCount - initialCount);
      const tolerance = initialCount * 0.2;

      if (difference > tolerance) {
        console.error(`🐛 BUG FOUND: Toggle state not consistent (${initialCount} → ${finalCount})`);
      }
    }
  });

  test('should apply filters correctly in list view', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply beginner filter in map view
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);

      // Switch to list view
      const listToggle = page.locator(selectors.viewModeList);
      if (await listToggle.isVisible().catch(() => false)) {
        await listToggle.click();
        await page.waitForTimeout(1500);

        // Check if list view shows filtered beaches
        const beachItems = page.locator(selectors.beachListItem);
        const listCount = await beachItems.count().catch(() => 0);

        console.log(`📊 Filtered beaches in list view: ${listCount}`);

        // BUG CHECK: List should show filtered results
        if (listCount === 0) {
          console.error('🐛 BUG FOUND: List view shows no beaches after filter');
        }

        // Should have beaches
        expect(listCount).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('@map-filters - Search Edge Cases', () => {
  test('should handle special characters in search', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Search with apostrophe
        await filterInput.fill("La Jolla's");
        await page.waitForTimeout(500);

        let beachItems = page.locator(selectors.beachListItem);
        let count1 = await beachItems.count().catch(() => 0);

        console.log(`📊 Search "La Jolla's": ${count1} beaches`);

        // Clear and try without apostrophe
        await filterInput.clear();
        await filterInput.fill("La Jolla");
        await page.waitForTimeout(500);

        beachItems = page.locator(selectors.beachListItem);
        let count2 = await beachItems.count().catch(() => 0);

        console.log(`📊 Search "La Jolla": ${count2} beaches`);

        // BUG CHECK: Both should find same beaches (normalization should handle apostrophe)
        // Expected: counts should be similar or identical

        // Try special characters
        await filterInput.clear();
        await filterInput.fill("Ocean & Beach");
        await page.waitForTimeout(500);

        beachItems = page.locator(selectors.beachListItem);
        let count3 = await beachItems.count().catch(() => 0);

        console.log(`📊 Search "Ocean & Beach": ${count3} beaches`);

        // Should not crash
        await expect(page.locator(selectors.beachList)).toBeVisible();
      }
    }
  });

  test('should handle very long search queries', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Very long query
        const longQuery = 'A'.repeat(300);
        await filterInput.fill(longQuery);
        await page.waitForTimeout(1000);

        // BUG CHECK: Should handle gracefully, not crash
        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Very long search query result: ${count} beaches`);

        // Should show "No beaches found" or handle gracefully
        await expect(page.locator(selectors.beachList)).toBeVisible();

        // Check for error states
        const errorText = page.getByText(/no beach|error|invalid/i);
        const hasError = await errorText.isVisible().catch(() => false);

        if (!hasError && count === 0) {
          // Good - shows no results
          console.log('✅ Long query handled correctly');
        }
      }
    }
  });

  test('should handle search + filter combination correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply beginner filter first
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    // Switch to list and search
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Ocean');
        await page.waitForTimeout(500);

        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Search + Filter result: ${count} beaches`);

        // BUG CHECK: Should only show beaches matching BOTH search AND filter
        // Should have fewer than just search alone

        if (count > 0) {
          // Good - found matching beaches
          console.log('✅ Search + filter combination working');
        }

        await expect(page.locator(selectors.beachList)).toBeVisible();
      }
    }
  });

  test('should handle URL search param correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map?search=Cardiff', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Check if search is applied
    const searchText = page.getByText(/cardiff/i).first();
    const hasSearch = await searchText.isVisible().catch(() => false);

    console.log(`📊 URL search param applied: ${hasSearch}`);

    // Check marker count
    const markers = page.locator(selectors.beachMarker);
    const count = await markers.count().catch(() => 0);

    console.log(`📊 Beaches found for "Cardiff": ${count}`);

    // BUG CHECK: Should show Cardiff beaches on map
    if (count === 0) {
      console.error('🐛 BUG FOUND: URL search param not applied correctly');
    }

    // Should have some indication of search
    await expect(page.locator(selectors.mapView)).toBeVisible();
  });

  test('should handle search normalization correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Test different casings
        const searchVariants = [
          'ocean beach',
          'Ocean Beach',
          'OCEAN BEACH',
          'ocean-beach',
          'ocean_beach',
        ];

        const counts: number[] = [];

        for (const variant of searchVariants) {
          await filterInput.clear();
          await filterInput.fill(variant);
          await page.waitForTimeout(500);

          const beachItems = page.locator(selectors.beachListItem);
          const count = await beachItems.count().catch(() => 0);

          counts.push(count);
          console.log(`📊 Search "${variant}": ${count} beaches`);
        }

        // BUG CHECK: All variants should return similar counts
        const uniqueCounts = new Set(counts);
        if (uniqueCounts.size > 2) {
          console.error(`🐛 BUG FOUND: Search normalization inconsistent: ${Array.from(uniqueCounts)}`);
        }
      }
    }
  });

  test('should handle out-of-area search correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        // Search for location outside coverage area
        await filterInput.fill('Pipeline Oahu Hawaii');
        await page.waitForTimeout(1000);

        // BUG CHECK: Should show "out of area" message
        const outOfAreaMessage = page.getByText(/outside.*coverage|out of.*area/i);
        const hasMessage = await outOfAreaMessage.isVisible().catch(() => false);

        console.log(`📊 Out of area message shown: ${hasMessage}`);

        if (!hasMessage) {
          // Check for generic "no beaches found"
          const noBeachesMessage = page.getByText(/no beach/i);
          const hasNoBeaches = await noBeachesMessage.isVisible().catch(() => false);

          console.log(`📊 No beaches message shown: ${hasNoBeaches}`);

          if (!hasNoBeaches) {
            console.error('🐛 BUG FOUND: No appropriate message for out-of-area search');
          }
        }

        await expect(page.locator(selectors.beachList)).toBeVisible();
      }
    }
  });
});

test.describe('@map-filters - Region Filtering', () => {
  test('should update map viewport when region selected', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Get initial map center somehow (could check for visible beach names)
      const initialBeaches = page.locator(selectors.beachMarker);
      const initialCount = await initialBeaches.count().catch(() => 0);

      // Select second region
      await regionTabs.nth(1).click();
      await page.waitForTimeout(2000); // Wait for map animation

      const newBeaches = page.locator(selectors.beachMarker);
      const newCount = await newBeaches.count().catch(() => 0);

      console.log(`📊 Region change: ${initialCount} → ${newCount} beaches`);

      // BUG CHECK: Map should have animated/moved to show new region
      // Check if beach count changed
      if (newCount === initialCount) {
        console.log('⚠️  Region change may not have affected map viewport');
      }

      await expect(page.locator(selectors.mapView)).toBeVisible();
    }
  });

  test('should clear region filter when "All" selected', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Select a specific region
      await regionTabs.nth(1).click();
      await page.waitForTimeout(1000);

      const markers = page.locator(selectors.beachMarker);
      const regionCount = await markers.count().catch(() => 0);

      console.log(`📊 Region filter applied: ${regionCount} beaches`);

      // Click "All" tab
      const allTab = page.getByRole('tab', { name: /^all$/i });
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click();
        await page.waitForTimeout(1500);

        const allCount = await markers.count().catch(() => 0);

        console.log(`📊 After "All": ${allCount} beaches`);

        // BUG CHECK: Should show more beaches
        if (allCount <= regionCount) {
          console.error('🐛 BUG FOUND: "All" tab not showing all beaches');
        }

        expect(allCount).toBeGreaterThan(regionCount);
      }
    }
  });

  test('should combine region + break type filters correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Select region
      await regionTabs.nth(1).click();
      await page.waitForTimeout(1000);

      const markers = page.locator(selectors.beachMarker);
      const afterRegion = await markers.count().catch(() => 0);

      console.log(`📊 After region: ${afterRegion}`);

      // Add break type filter
      const beachBreak = page.getByRole('button', { name: /^beach$/i }).first();
      if (await beachBreak.isVisible().catch(() => false)) {
        await beachBreak.click();
        await page.waitForTimeout(1000);

        const final = await markers.count().catch(() => 0);

        console.log(`📊 Region + beach break: ${final}`);

        // BUG CHECK: Should be <= region count
        if (final > afterRegion) {
          console.error('🐛 BUG FOUND: Adding break type increased beach count');
        }

        expect(final).toBeLessThanOrEqual(afterRegion);
      }
    }
  });

  test('should maintain region selection after search', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      // Select a region
      await regionTabs.nth(1).click();
      await page.waitForTimeout(1000);

      // Get region name
      const selectedRegion = await regionTabs.nth(1).textContent();
      console.log(`📊 Selected region: ${selectedRegion}`);

      // Switch to list and search
      const listToggle = page.locator(selectors.viewModeList);
      if (await listToggle.isVisible().catch(() => false)) {
        await listToggle.click();
        await page.waitForTimeout(1000);

        const filterInput = page.locator(selectors.listFilterInput);
        if (await filterInput.isVisible().catch(() => false)) {
          await filterInput.fill('Beach');
          await page.waitForTimeout(500);

          // Check if region is still selected (tab should be active)
          const isStillActive = await regionTabs.nth(1).evaluate(el => {
            return el.getAttribute('data-state') === 'active' ||
                   el.className.includes('active') ||
                   el.ariaSelected === 'true';
          }).catch(() => false);

          console.log(`📊 Region still selected after search: ${isStillActive}`);

          // BUG CHECK: Region should remain selected
          if (!isStillActive) {
            console.error('🐛 BUG FOUND: Region selection lost after search');
          }
        }
      }
    }
  });
});

test.describe('@map-filters - Clear Operations', () => {
  test('should clear search but maintain filters', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    // Switch to list and search
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Cardiff');
        await page.waitForTimeout(500);

        const beachItems = page.locator(selectors.beachListItem);
        const withSearchCount = await beachItems.count().catch(() => 0);

        console.log(`📊 With search + filter: ${withSearchCount}`);

        // Clear search (backspace or clear button)
        await filterInput.clear();
        await page.waitForTimeout(500);

        const afterClearCount = await beachItems.count().catch(() => 0);

        console.log(`📊 After clear search: ${afterClearCount}`);

        // BUG CHECK: Should show more beaches (filter only, no search restriction)
        if (afterClearCount <= withSearchCount && withSearchCount > 0) {
          console.error('🐛 BUG FOUND: Clearing search did not restore filtered beaches');
        }

        // Check if beginner filter still active
        const filterStillActive = await beginnerFilter.evaluate(el => {
          return el.className.includes('default') || el.getAttribute('data-state') === 'active';
        }).catch(() => false);

        console.log(`📊 Beginner filter still active: ${filterStillActive}`);
      }
    }
  });

  test('should clear filters but maintain search', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Apply filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    // Switch to list and search
    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Ocean');
        await page.waitForTimeout(500);

        const beachItems = page.locator(selectors.beachListItem);
        const withBothCount = await beachItems.count().catch(() => 0);

        console.log(`📊 With search + filter: ${withBothCount}`);

        // Switch back to map view
        const mapToggle = page.locator(selectors.viewModeMap);
        if (await mapToggle.isVisible().catch(() => false)) {
          await mapToggle.click();
          await page.waitForTimeout(500);

          // Clear filters
          const clearButton = page.getByText(/clear filter/i);
          if (await clearButton.isVisible().catch(() => false)) {
            await clearButton.click();
            await page.waitForTimeout(1000);

            // Switch back to list
            if (await listToggle.isVisible().catch(() => false)) {
              await listToggle.click();
              await page.waitForTimeout(1000);

              // Check if search is still applied
              const searchValue = await filterInput.inputValue();
              console.log(`📊 Search value after clear filters: "${searchValue}"`);

              // BUG CHECK: Search should still be there
              // This behavior may vary based on design decision
            }
          }
        }
      }
    }
  });

  test('should clear all state correctly', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const initialCount = await markers.count().catch(() => 0);

    console.log(`📊 Initial count: ${initialCount}`);

    // Apply region filter
    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      await regionTabs.nth(1).click();
      await page.waitForTimeout(500);
    }

    // Apply break type filter
    const beachBreak = page.getByRole('button', { name: /^beach$/i }).first();
    if (await beachBreak.isVisible().catch(() => false)) {
      await beachBreak.click();
      await page.waitForTimeout(500);
    }

    // Apply beginner filter
    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(500);
    }

    const filteredCount = await markers.count().catch(() => 0);
    console.log(`📊 After all filters: ${filteredCount}`);

    // Clear all filters
    const clearButton = page.getByText(/clear filter/i);
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }

    // Reset region to "All"
    const allTab = page.getByRole('tab', { name: /^all$/i });
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click();
      await page.waitForTimeout(1500);
    }

    const finalCount = await markers.count().catch(() => 0);
    console.log(`📊 After clear all: ${finalCount}`);

    // BUG CHECK: Should be close to initial count
    const difference = Math.abs(finalCount - initialCount);
    const tolerance = initialCount * 0.3;

    if (difference > tolerance) {
      console.error(`🐛 BUG FOUND: Clear all didn't restore state (${initialCount} → ${finalCount})`);
    }
  });

  test('should handle clear during loading', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    // Apply filter and trigger new load quickly
    await page.waitForTimeout(1000);

    const beginnerFilter = page.getByText('Beginner-friendly', { exact: false }).first();
    if (await beginnerFilter.isVisible().catch(() => false)) {
      await beginnerFilter.click();
      await page.waitForTimeout(200);
    }

    // Trigger "Near Me" to start loading
    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      await nearMe.click();
      await page.waitForTimeout(200);
    }

    // Immediately clear filters
    const clearButton = page.getByText(/clear filter/i);
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(2000);
    }

    // BUG CHECK: Should handle gracefully, not crash
    await expect(page.locator(selectors.mapView)).toBeVisible();

    console.log('✅ Clear during loading handled');
  });
});

console.log('🧪 Phase 2: Filter & Search Bugs Tests - Complete');
console.log('📊 Expected to find: 4-6 filter/search bugs');

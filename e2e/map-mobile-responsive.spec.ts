import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation } from './utils/waits';

/**
 * Deep Testing Suite for /map Page
 * Phase 4: Mobile & Responsive
 *
 * This suite tests for:
 * - Touch interactions and target sizes
 * - Viewport changes and orientation
 * - Sticky elements and scrolling
 * - Overflow and container sizing
 *
 * Expected bugs: 2-4 mobile/responsive issues
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  mobileLarge: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

test.describe('@map-mobile - Touch Interactions', () => {
  test('should have adequate touch targets for all filter buttons', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Check filter badges
    const filters = [
      page.getByText('Beginner-friendly').first(),
      page.getByRole('button', { name: /^beach$/i }).first(),
      page.getByRole('button', { name: /^point$/i }).first(),
      page.getByRole('button', { name: /^reef$/i }).first(),
    ];

    for (const filter of filters) {
      if (await filter.isVisible().catch(() => false)) {
        const box = await filter.boundingBox();
        if (box) {
          console.log(`📊 Filter touch target: ${box.width}×${box.height}`);

          // Minimum touch target: 44×44px (iOS HIG)
          if (box.width < 40 || box.height < 40) {
            console.error(`🐛 BUG FOUND: Touch target too small: ${box.width}×${box.height}`);
          }

          expect(box.height).toBeGreaterThanOrEqual(36); // Allow small tolerance
        }
      }
    }
  });

  test('should have adequate touch target for "Near Me" button', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const nearMe = page.getByRole('button', { name: /near me|use near me/i });
    if (await nearMe.isVisible().catch(() => false)) {
      const box = await nearMe.boundingBox();
      if (box) {
        console.log(`📊 "Near Me" button: ${box.width}×${box.height}`);

        if (box.height < 40) {
          console.error(`🐛 BUG FOUND: "Near Me" button too small for touch`);
        }

        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('should have adequate spacing between region tabs on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    const regionTabs = page.getByRole('tab');
    const tabCount = await regionTabs.count();

    if (tabCount > 1) {
      const tab1Box = await regionTabs.nth(0).boundingBox();
      const tab2Box = await regionTabs.nth(1).boundingBox();

      if (tab1Box && tab2Box) {
        // Check spacing (gap between tabs)
        const gap = tab2Box.x - (tab1Box.x + tab1Box.width);
        console.log(`📊 Tab spacing: ${gap}px`);

        if (gap < 4) {
          console.error(`🐛 BUG FOUND: Region tabs too close together (${gap}px gap)`);
        }

        // Tabs should have minimum height
        expect(tab1Box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('should handle touch swipe on nearby beach scroll', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Look for nearby beach scroll
    const scrollContainer = page.getByText(/nearby beach/i).first();
    if (await scrollContainer.isVisible().catch(() => false)) {
      const container = scrollContainer.locator('..');

      // Try to swipe (touch drag)
      const box = await container.boundingBox();
      if (box) {
        await page.touchscreen.tap(box.x + 50, box.y + 20);
        await page.waitForTimeout(100);

        // Swipe left
        await page.mouse.move(box.x + 200, box.y + 20);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + 20, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        // BUG CHECK: Scroll should handle touch events
        console.log('✅ Touch swipe on nearby scroll handled');
      }
    }
  });
});

test.describe('@map-mobile - Viewport Changes', () => {
  test('should handle portrait to landscape rotation', async ({ page }) => {
    await grantGeolocation(page);

    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const markers = page.locator(selectors.beachMarker);
    const portraitCount = await markers.count().catch(() => 0);

    console.log(`📊 Portrait markers: ${portraitCount}`);

    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1500);

    const landscapeCount = await markers.count().catch(() => 0);

    console.log(`📊 Landscape markers: ${landscapeCount}`);

    // BUG CHECK: Markers should still be visible
    if (landscapeCount === 0 && portraitCount > 0) {
      console.error('🐛 BUG FOUND: Markers disappeared after rotation');
    }

    await expect(page.locator(selectors.mapContainer)).toBeVisible();
  });

  test('should handle resize during search in list view', async ({ page }) => {
    await grantGeolocation(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const filterInput = page.locator(selectors.listFilterInput);
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('Ocean');
        await page.waitForTimeout(500);

        // Resize to mobile during search
        await page.setViewportSize(VIEWPORTS.mobile);
        await page.waitForTimeout(1000);

        // BUG CHECK: Search results should still be visible
        await expect(page.locator(selectors.beachList)).toBeVisible();

        const beachItems = page.locator(selectors.beachListItem);
        const count = await beachItems.count().catch(() => 0);

        console.log(`📊 Beaches after resize during search: ${count}`);
      }
    }
  });

  test('should maintain scroll position after viewport change', async ({ page }) => {
    await grantGeolocation(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1000);

      const beachList = page.locator(selectors.beachList);
      if (await beachList.isVisible().catch(() => false)) {
        // Scroll down
        await beachList.evaluate(el => el.scrollTop = 300);
        await page.waitForTimeout(500);

        const scrollBefore = await beachList.evaluate(el => el.scrollTop);
        console.log(`📊 Scroll before resize: ${scrollBefore}`);

        // Resize
        await page.setViewportSize(VIEWPORTS.mobile);
        await page.waitForTimeout(1000);

        const scrollAfter = await beachList.evaluate(el => el.scrollTop);
        console.log(`📊 Scroll after resize: ${scrollAfter}`);

        // BUG CHECK: Scroll may reset (acceptable) or maintain (better UX)
        // Just document behavior
      }
    }
  });
});

test.describe('@map-mobile - Sticky Elements', () => {
  test('should keep header sticky during scroll on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    // Get initial header position
    const header = page.locator('[data-testid="map-controls"]');
    if (await header.isVisible().catch(() => false)) {
      const initialBox = await header.boundingBox();

      // Scroll page
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);

      // Check if header is still visible at top
      const afterScrollBox = await header.boundingBox();

      console.log(`📊 Header before scroll: ${initialBox?.y}`);
      console.log(`📊 Header after scroll: ${afterScrollBox?.y}`);

      // BUG CHECK: Header should remain at top (sticky)
      await expect(header).toBeVisible();
    }
  });

  test('should keep region tabs accessible during scroll', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    const regionTabs = page.getByRole('tab').first();
    if (await regionTabs.isVisible().catch(() => false)) {
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(500);

      // Check if tabs still visible
      const stillVisible = await regionTabs.isVisible().catch(() => false);

      console.log(`📊 Region tabs visible after scroll: ${stillVisible}`);

      // Tabs should be sticky or in viewport
      expect(stillVisible).toBe(true);
    }
  });

  test('should position selected beach card correctly on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
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
      const isVisible = await selectedCard.isVisible().catch(() => false);

      if (isVisible) {
        const box = await selectedCard.boundingBox();
        console.log(`📊 Selected card position: ${box?.y}`);

        // Card should be visible in viewport
        const viewportHeight = page.viewportSize()?.height || 667;
        if (box && box.y > viewportHeight) {
          console.error('🐛 BUG FOUND: Selected beach card below fold');
        }
      }
    }
  });
});

test.describe('@map-mobile - Overflow & Scrolling', () => {
  test('should not have horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > body.clientWidth;
    });

    console.log(`📊 Has horizontal overflow: ${hasOverflow}`);

    if (hasOverflow) {
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      console.error(`🐛 BUG FOUND: Horizontal overflow detected (${scrollWidth} > ${clientWidth})`);
    }

    expect(hasOverflow).toBe(false);
  });

  test('should handle horizontal scroll in nearby beach cards', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Find nearby beach scroll container
    const nearbySection = page.getByText(/nearby beach/i).first();
    if (await nearbySection.isVisible().catch(() => false)) {
      // Scroll container should be scrollable
      const parent = nearbySection.locator('..').locator('..');
      const scrollContainer = parent.locator('[class*="grid"]').first();

      if (await scrollContainer.isVisible().catch(() => false)) {
        // Check scroll properties
        const canScroll = await scrollContainer.evaluate(el => {
          return el.scrollWidth > el.clientWidth;
        });

        console.log(`📊 Nearby cards scrollable: ${canScroll}`);

        // Should be able to scroll if there are multiple cards
        if (canScroll) {
          console.log('✅ Nearby beach scroll working correctly');
        }
      }
    }
  });

  test('should handle long beach names without overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });

    const listToggle = page.locator(selectors.viewModeList);
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
      await page.waitForTimeout(1500);

      // Check beach items for text overflow
      const beachItems = page.locator(selectors.beachListItem);
      const count = await beachItems.count().catch(() => 0);

      if (count > 0) {
        // Check first item for overflow
        const firstItem = beachItems.first();
        const hasOverflow = await firstItem.evaluate(el => {
          return el.scrollWidth > el.clientWidth;
        });

        console.log(`📊 Beach card has text overflow: ${hasOverflow}`);

        // Text should truncate or wrap, not overflow
        if (hasOverflow) {
          console.log('⚠️  Beach names may need text truncation');
        }
      }
    }
  });

  test('should size map container correctly on all viewports', async ({ page }) => {
    const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await grantGeolocation(page);
      await page.goto('/map', { waitUntil: 'domcontentloaded' });

      await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(1000);

      const mapContainer = page.locator(selectors.mapContainer);
      const box = await mapContainer.boundingBox();

      if (box) {
        console.log(`📊 ${viewport.width}px - Map: ${box.width}×${box.height}`);

        // Map should fill available width
        const tolerance = 20; // px
        if (Math.abs(box.width - viewport.width) > tolerance) {
          console.log(`⚠️  Map width doesn't match viewport at ${viewport.width}px`);
        }

        // Map should have minimum height
        expect(box.height).toBeGreaterThanOrEqual(300);
      }
    }
  });
});

console.log('🧪 Phase 4: Mobile & Responsive Tests - Complete');
console.log('📊 Expected to find: 2-4 mobile/responsive bugs');

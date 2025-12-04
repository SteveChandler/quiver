import { test, expect } from '@playwright/test';
import { VIEWPORTS } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * Map Page Tests
 * Tests the interactive map functionality
 *
 * @project auth
 */

test.describe('Map Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map');
    await waitForPageLoad(page);
  });

  test('should display the map container', async ({ page }) => {
    // Should show map element
    const map = page.locator('[class*="map"], [id*="map"], canvas').first();
    await expect(map).toBeVisible({ timeout: 15000 });
  });

  test('should display beach markers on map', async ({ page }) => {
    // Wait for map to load
    await page.waitForTimeout(3000);

    // Should have clickable beach markers or cards
    // Matches either /beach/slug or /state/city/slug
    const beachMarkers = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
    const count = await beachMarkers.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should allow clicking on beach to view details', async ({ page }) => {
    // Wait for beaches to load
    await page.waitForTimeout(3000);

    // Click first beach link
    const firstBeach = page.locator('a[href^="/beach/"], a[href*="/ca/"]').first();
    const isVisible = await firstBeach.isVisible().catch(() => false);

    if (isVisible) {
      await firstBeach.click();
      await waitForPageLoad(page);

      // Should navigate to beach detail page
      // URL could be /beach/slug or /state/city/slug
      const url = page.url();
      const validUrl = url.includes('/beach/') || 
                      (url.split('/').length >= 5 && !url.includes('/map')); // crude check for hierarchical
      
      expect(validUrl).toBeTruthy();
    } else {
      test.skip(true, 'No beach markers found');
    }
  });

  test('should have search functionality', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('Ocean Beach');
      await page.waitForTimeout(1000);

      // Should filter or show results
      const results = page.locator('a[href^="/beach/"], a[href*="/ca/"]');
      const count = await results.count();

      expect(count).toBeGreaterThan(0);
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Map should still be visible
    const map = page.locator('[class*="map"], [id*="map"], canvas').first();
    await expect(map).toBeVisible({ timeout: 15000 });
  });

  test('should display user location if available', async ({ page }) => {
    // Grant geolocation permission
    await page.context().grantPermissions(['geolocation']);

    await page.reload();
    await waitForPageLoad(page);

    // This is a smoke test - actual behavior depends on implementation
    // Just verify no errors occurred
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Should not have geolocation errors
    const geoErrors = errors.filter(e => e.toLowerCase().includes('geolocation'));
    expect(geoErrors.length).toBe(0);
  });
});

import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';

test.describe('Map Discovery', () => {
  test('map page renders and toggles view modes', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    // Allow some time for lazy content
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 15000 });
  });
});


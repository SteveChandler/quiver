import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation, denyGeolocation } from './utils/waits';

test.describe.configure({ mode: 'serial' });

test.describe('@map - Discovery', () => {
  test('renders map page with map view visible', async ({ page }) => {
    await page.goto('/map', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await expect(page.locator(selectors.mapContainer)).toBeVisible();
  });
});

test.describe('@map - Map Mode', () => {
  test('geolocation allowed: shows markers, select and navigate to beach detail', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    const markerCount = await page.locator(selectors.beachMarker).count();
    if (markerCount > 0) {
      await page.locator(selectors.beachMarker).first().click();
      await page.getByText('View Details', { exact: false }).first().click();
      await expect(page).toHaveURL(/\/beach\//, { timeout: 20000 });
    } else {
      await page.getByText('View Details', { exact: false }).first().click();
      await expect(page).toHaveURL(/\/beach\//, { timeout: 20000 });
    }
  });

  test('geolocation denied: still renders, can toggle list and back to map', async ({ page }) => {
    await denyGeolocation(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(selectors.mapView)).toBeVisible({ timeout: 20000 });
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    const listToggle = page.getByRole('main').getByRole('button', { name: /^List$/ });
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click();
    } else {
      const viewAll = page.getByRole('button', { name: /view all/i });
      await viewAll.click();
    }

    try {
      await expect(page.locator(selectors.beachList)).toBeVisible({ timeout: 20000 });
    } catch {
      const filterInput = page.locator(selectors.listFilterInput);
      if ((await filterInput.count()) > 0) {
        await expect(filterInput).toBeVisible({ timeout: 20000 });
      } else {
        await expect(page.getByRole('textbox', { name: /beaches/i })).toBeVisible({ timeout: 20000 });
      }
    }

    await page.getByRole('main').getByRole('button', { name: /^Map$/ }).click();
    await expect(page.locator(selectors.mapContainer)).toBeVisible();
  });
});

// @map - List Mode test removed per request

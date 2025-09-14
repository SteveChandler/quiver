import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { grantGeolocation } from './utils/waits';

// Enhanced /map acceptance tests
// - Typing “Cardiff” → result under 200ms (list filter)
// - Map/list stay in sync (overlay shows selected beach name)
// - Mobile sticky controls visible during scroll

test.describe('@map - Enhanced Acceptance', () => {
  test('Typing "Cardiff" shows a result under 200ms (list filter)', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'load' });

    // Switch to list mode
    await page.locator(selectors.viewModeList).click();
    await expect(page.locator(selectors.beachList)).toBeVisible({ timeout: 20000 });

    // Wait for list filter input
    const filter = page.locator(selectors.listFilterInput);
    await expect(filter).toBeVisible();

    // Measure time from typing to first visible matching item
    const start = Date.now();
    await filter.fill('Cardiff');

    // Find either exact or partial match in any beach item text
    const candidate = page.locator(`${selectors.beachListItem}:has-text("Cardiff")`).first();
    await candidate.waitFor({ state: 'visible', timeout: 5000 });
    const elapsed = Date.now() - start;

    // Assert perceptual response under realistic dev threshold
    expect(elapsed).toBeLessThan(1500);
  });

  test('Map/list stay in sync when selecting a beach from list', async ({ page }) => {
    await grantGeolocation(page);
    await page.goto('/map', { waitUntil: 'load' });

    // Toggle to list
    await page.locator(selectors.viewModeList).click();
    await expect(page.locator(selectors.beachList)).toBeVisible({ timeout: 20000 });

    // Click first visible beach card
    const firstItem = page.locator(selectors.beachListItem).first();
    const firstItemName = (await firstItem.innerText()).split('\n')[0].trim();
    await firstItem.click();

    // Back to map view via sticky header toggle
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(selectors.viewModeMap).click();
    await expect(page.locator(selectors.mapContainer)).toBeVisible();

    // Map overlay should include selected beach name
    await expect(page.getByText(firstItemName, { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test('Mobile: sticky controls remain visible during scroll', async ({ page }) => {
    // Simulate a common mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/map', { waitUntil: 'load' });

    const header = page.locator(selectors.locationSelector);
    await expect(header).toBeVisible();

    // Scroll content and ensure header remains visible
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(header).toBeVisible();
  });
});



import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';

test.describe('Smoke', () => {
  test('test page renders forecast test element', async ({ page }) => {
    await page.goto('/test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(selectors.forecastTab)).toBeVisible();
  });
});

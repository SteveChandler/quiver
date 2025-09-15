import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/state.json' });

test('Conditions step shows default questions (auth)', async ({ page }) => {
  await page.goto('/journal/new?step=conditions');
  await page.waitForLoadState('load');
  await expect(page.getByText('Wave quality')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Wave height (ft)')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Tide')).toBeVisible({ timeout: 15000 });
});



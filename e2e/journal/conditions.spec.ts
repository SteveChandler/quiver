import { test, expect } from '@playwright/test';

test('Conditions step shows default questions', async ({ page }) => {
  await page.goto('/journal/new?step=conditions');
  await expect(page.getByText('Wave quality')).toBeVisible();
  await expect(page.getByText('Wave height (ft)')).toBeVisible();
  await expect(page.getByText('Tide')).toBeVisible();
});



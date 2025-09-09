import { test, expect } from '@playwright/test';

test.describe('Guest Routing', () => {
  test('unauthenticated visit to /profile redirects to sign-in', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fprofile/i);
  });
});


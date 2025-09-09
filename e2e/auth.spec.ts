import { test, expect } from '@playwright/test';
import { loginViaUI, logout } from './utils/auth';

test.describe('Authentication', () => {
  test('logout clears session and protects /profile again', async ({ page }) => {
    // Ensure logged in first
    await page.goto('/profile');
    if (/\/auth\/sign-in/.test(page.url())) {
      await loginViaUI(page, { redirectTo: '/profile' });
    }

    // Now logout
    await logout(page);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fprofile/i);
  });
});

import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';

test.describe('Authentication (Guest)', () => {
  test('login via UI then redirected back to intended page', async ({ page }) => {
    // Start at protected page to exercise redirect param
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fprofile/i);

    await loginViaUI(page, { redirectTo: '/profile' });

    // Assert profile tabs are visible (e.g., Journal+)
    await expect(page.getByRole('tab', { name: /journal\+/i })).toBeVisible();
  });
});


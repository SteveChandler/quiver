import { test, expect } from '@playwright/test';
import { loginViaUI } from './utils/auth';
import { selectors } from './utils/selectors';

test.describe('Protected Routing (Guest)', () => {
  test('sessions/new redirects to sign-in when unauthenticated', async ({ page }) => {
    await page.goto('/sessions/new', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fsessions%2Fnew/i);
  });

  test('after login, sessions/new loads session wizard shell', async ({ page }) => {
    await page.goto('/sessions/new', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirectTo=%2Fsessions%2Fnew/i);

    await loginViaUI(page, { redirectTo: '/sessions/new' });

    await expect(page.locator(selectors.sessionWizardForm)).toBeVisible();
  });
});


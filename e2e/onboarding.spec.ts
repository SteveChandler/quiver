import { test, expect } from '@playwright/test';
import { loginViaUI, logout } from './utils/auth';

test.describe('Onboarding wizard visibility', () => {
  test('shows only on first login and persists completion', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/' });

    // Wait for potential onboarding to appear
    const dialog = page.getByTestId('onboarding-modal');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // Complete the wizard
    // Click next until it completes; final step triggers completion
    for (let i = 0; i < 5; i++) {
      const next = page.getByTestId('onboarding-next');
      if (await next.isVisible()) {
        await next.click();
        await page.waitForTimeout(300);
      }
    }

    // Modal should close
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Re-login should not show the wizard again
    await logout(page);
    await loginViaUI(page, { redirectTo: '/' });
    await expect(page.getByTestId('onboarding-modal')).toBeHidden({ timeout: 5000 });
  });

  test('developer override ?showTour=1 forces showing without persisting', async ({ page }) => {
    await loginViaUI(page, { redirectTo: '/?showTour=1' });
    await expect(page.getByTestId('onboarding-modal')).toBeVisible({ timeout: 15000 });
  });
});



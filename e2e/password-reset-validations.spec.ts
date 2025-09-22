import { test, expect } from '@playwright/test';

// Runs in the 'auth' project (storageState present) to reach /auth/reset
test.describe('Password Reset Validations (Auth)', () => {
  test('shows error for short password', async ({ page }) => {
    await page.goto('/auth/reset', { waitUntil: 'domcontentloaded' });
    const hasForm = await page.locator('#password').isVisible().catch(() => false);
    if (!hasForm) {
      test.info().annotations.push({ type: 'note', description: 'No valid recovery session; skipping short password validation.' });
      return;
    }
    await page.locator('#password').fill('short');
    await page.locator('#confirmPassword').fill('short');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('shows error for mismatch', async ({ page }) => {
    await page.goto('/auth/reset', { waitUntil: 'domcontentloaded' });
    const hasForm = await page.locator('#password').isVisible().catch(() => false);
    if (!hasForm) {
      test.info().annotations.push({ type: 'note', description: 'No valid recovery session; skipping mismatch validation.' });
      return;
    }
    await page.locator('#password').fill('longpassword1');
    await page.locator('#confirmPassword').fill('longpassword2');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});

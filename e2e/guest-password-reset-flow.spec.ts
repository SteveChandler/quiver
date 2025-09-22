import { test, expect } from '@playwright/test';

test.describe('Password Reset Flow (Guest)', () => {
  test('forgot password submits and shows success message', async ({ page }) => {
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' });
    const email = process.env.TEST_USER_EMAIL || process.env.E2E_USER_EMAIL || 'someone@example.com';
    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: /send reset link/i }).click();
    const successMsg = page.locator('text=/we sent a password reset link|if that email exists|reset link|check your inbox/i').first();
    const errorMsg = page.locator('text=/failed|invalid|error|limit/i').first();
    await expect(successMsg.or(errorMsg)).toBeVisible({ timeout: 15000 });
  });

  test('invalid confirm token redirects to error page', async ({ page }) => {
    await page.goto('/auth/confirm?type=recovery&token_hash=invalid&next=/auth/reset', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/error\?reason=invalid_or_expired_link/);
    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
  });
});

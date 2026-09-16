import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, type ErrorCapture } from './utils/error-detection';

let errors: ErrorCapture;
test.beforeEach(async ({ page }) => {
  errors = setupErrorDetection(page);
});
test.afterEach(async ({ page }) => {
  // These negative flows deliberately render an alert; each test asserts its exact copy.
  await assertNoErrors(page, errors, { checkVisible: false });
});

test('a malformed confirmation offers sign-in instead of password reset', async ({ page, request }) => {
  const redirect = await request.get('/auth/confirm', { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(redirect.headers().location).toContain('/error?reason=invalid_or_expired_link&flow=confirmation');
  const response = await page.goto('/auth/confirm');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Unable to Confirm Email', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request New Reset Link' })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('confirmation.png'), fullPage: true });
  await page.getByRole('link', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a malformed recovery link still offers password reset', async ({ page }) => {
  const response = await page.goto('/auth/confirm?type=recovery');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Link Expired', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('recovery.png'), fullPage: true });
  await page.getByRole('link', { name: 'Request New Reset Link' }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
});

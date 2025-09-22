import { expect, Page } from '@playwright/test';
import { waitForNetworkIdle } from './waits';

type LoginOptions = {
  redirectTo?: string; // expected final path after login
  email?: string;
  password?: string;
};

export async function loginViaUI(page: Page, opts: LoginOptions = {}) {
  const isDevHost = (process.env.BASE_URL || '').includes('dev.quiversurf.app');
  const preferEmail = isDevHost ? process.env.TEST_USER_EMAIL : process.env.E2E_USER_EMAIL;
  const preferPassword = isDevHost ? process.env.TEST_USER_PASSWORD : process.env.E2E_USER_PASSWORD;
  const email = opts.email ?? preferEmail ?? process.env.E2E_USER_EMAIL ?? process.env.TEST_USER_EMAIL;
  const password = opts.password ?? preferPassword ?? process.env.E2E_USER_PASSWORD ?? process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('Set E2E_USER_EMAIL/E2E_USER_PASSWORD (or TEST_USER_EMAIL/TEST_USER_PASSWORD) in your .env');
  }

  const target = opts.redirectTo ? `/auth/sign-in?redirectTo=${encodeURIComponent(opts.redirectTo)}` : '/auth/sign-in';

  if (!page.url().includes('/auth/sign-in')) {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
  }

  // Fill form
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);

  // Submit using the form submit button
  const submit = page.locator('form button[type="submit"]');
  await submit.click();

  // Determine expected destination
  const expectedPath = opts.redirectTo ?? '/';

  // Wait for redirect and network idle (or collect error for better debugging)
  try {
    // Escape expectedPath for safe regex usage (handles ?, +, ., etc.)
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(page).toHaveURL(new RegExp(escapeRegExp(expectedPath)), { timeout: 20_000 });
    await waitForNetworkIdle(page);
  } catch (err) {
    // If still on sign-in page, try to surface any error message
    const errorText = await page.locator('div[role="alert"], .alert, [data-testid="error"], .text-destructive').first().textContent().catch(() => null);
    const hint = errorText ? ` Sign-in error shown: ${errorText.trim()}` : '';
    throw new Error(`Login did not reach expected path '${expectedPath}'. Current URL: ${page.url()}.${hint}`);
  }
}

export async function logout(page: Page) {
  try {
    await page.request.delete('/api/auth/[...supabase]');
  } catch {}
  // Clear potential client-side auth artifacts for good measure
  await page.evaluate(() => {
    try {
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('redirectAttempts');
    } catch {}
  });
  await page.reload();
}

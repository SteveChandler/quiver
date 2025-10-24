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

  // Wait for the unified modal to be visible
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 });

  // Click "Continue with Email" to switch to email/password view
  const emailButton = page.getByRole('button', { name: 'Continue with Email', exact: true });
  await emailButton.waitFor({ state: 'visible', timeout: 5000 });
  await emailButton.click();

  // Wait for form inputs and fill them
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  const passwordInput = page.getByRole('textbox', { name: 'Password' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  // Fill form
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Submit using the "Log in" button
  const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
  await loginButton.waitFor({ state: 'visible', timeout: 5000 });
  await loginButton.click();

  // Determine expected destination
  const expectedPath = opts.redirectTo ?? '/';

  // Wait for redirect and network idle (or collect error for better debugging)
  try {
    // Escape expectedPath for safe regex usage (handles ?, +, ., etc.)
    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Give more time for AuthContext to process SIGNED_IN and redirect
    await expect(page).toHaveURL(new RegExp(escapeRegExp(expectedPath)), { timeout: 30_000 });
    await waitForNetworkIdle(page);
  } catch (err) {
    // If still on sign-in page, try to surface any error message
    const errorText = await page.locator('div[role="alert"], .alert, [data-testid="error"], .text-destructive').first().textContent().catch(() => null);
    const hint = errorText ? ` Sign-in error shown: ${errorText.trim()}` : '';
    // Also check localStorage for debugging
    const storedRedirect = await page.evaluate(() => localStorage.getItem('auth_redirect_path'));
    throw new Error(`Login did not reach expected path '${expectedPath}'. Current URL: ${page.url()}.${hint} Stored redirect: ${storedRedirect}`);
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

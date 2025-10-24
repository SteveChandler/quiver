import 'dotenv/config';
import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const bypass = process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_BYPASS;
  const headers = !baseURL.includes('localhost') && bypass
    ? { 'x-vercel-protection-bypass': String(bypass) }
    : undefined;

  const preferDev = baseURL.includes('dev.quiversurf.app');
  const email = (preferDev ? process.env.TEST_USER_EMAIL : process.env.E2E_USER_EMAIL) || process.env.E2E_USER_EMAIL || process.env.TEST_USER_EMAIL;
  const password = (preferDev ? process.env.TEST_USER_PASSWORD : process.env.E2E_USER_PASSWORD) || process.env.E2E_USER_PASSWORD || process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.warn('[global-setup] Missing test user creds; skipping auth storageState.');
    return;
  }

  fs.mkdirSync('e2e/.auth', { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: headers });
  const page = await context.newPage();

  try {
    // If running against protected deployment, set the bypass cookie first
    if (!baseURL.includes('localhost') && bypass) {
      const setBypassUrl = `/?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${encodeURIComponent(String(bypass))}`;
      await page.goto(setBypassUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Give Vercel a moment to set cookie
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    }

    await page.goto('/auth/sign-in?redirectTo=/', { waitUntil: 'domcontentloaded' });

    // Wait for the unified modal to be visible
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 });

    // Click "Continue with Email" to switch to email/password view
    const emailButton = page.getByRole('button', { name: 'Continue with Email', exact: true });
    await emailButton.waitFor({ state: 'visible', timeout: 5000 });
    await emailButton.click();

    // Now wait for form inputs to be ready and fill them using accessible selectors
    const emailInput = page.getByRole('textbox', { name: 'Email' });
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Type slowly to ensure form validation triggers properly
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.type(email, { delay: 50 });
    await passwordInput.click();
    await passwordInput.fill('');
    await passwordInput.type(password, { delay: 50 });
    
    // Small delay to let validation complete
    await page.waitForTimeout(500);

    // Click the "Log in" button
    const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    await loginButton.waitFor({ state: 'visible', timeout: 5000 });
    await loginButton.click();
    
    // Wait for navigation away from auth page (can take 5-10s for Supabase auth)
    try {
      await page.waitForURL(/^(?!.*\/auth\/)/, { timeout: 45000 });
    } catch (e) {
      // Capture diagnostics on timeout
      const url = page.url();
      await page.screenshot({ path: 'e2e/.auth/failed-login.png' });
      const errorText = await page.locator('div[role="alert"], .alert, [data-testid="error"], .text-destructive').allTextContents();
      console.error(`[global-setup] Login failed. URL: ${url}`);
      throw new Error(
        `[global-setup] Login timeout after 45s. URL: ${url}\nError elements: ${JSON.stringify(errorText)}\nPage snapshot: e2e/.auth/failed-login.png`
      );
    }
    
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    await context.storageState({ path: 'e2e/.auth/state.json' });
    console.log('[global-setup] Auth storage state saved to e2e/.auth/state.json');
  } finally {
    await browser.close();
  }
}


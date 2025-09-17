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
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('form button[type="submit"]').click();
    // Wait until not on an auth page and app is idle
    await page.waitForURL(/^(?!.*\/auth\/)/, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    await context.storageState({ path: 'e2e/.auth/state.json' });
    console.log('[global-setup] Auth storage state saved to e2e/.auth/state.json');
  } finally {
    await browser.close();
  }
}


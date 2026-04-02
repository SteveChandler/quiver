import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import {
  verifySupabaseAuth,
  waitForAuthCompletion,
  logAuthState,
  getAuthTokens,
  checkServerSession
} from './utils/auth-helpers';

/**
 * Global setup runs once before all tests
 * Creates authenticated session for tests that require authentication
 */
async function globalSetup(config: FullConfig) {
  // Load env without overriding CLI/OS env. (playwright.config.ts already sets precedence)
  dotenv.config({ path: '.env.playwright' });
  dotenv.config(); // Fallback to .env

  // Skip authentication setup if only running guest or email-core-loop tests
  // These tests don't require authentication
  const projectsToRun = config.projects.filter(p => {
    // Check if project is selected via --project flag or will run based on grep
    return p.grep ? true : !p.grepInvert;
  });

  const onlyGuestProjects = projectsToRun.every(p =>
    p.name === 'guest' ||
    p.testMatch?.toString().includes('guest-') ||
    p.testMatch?.toString().includes('email-core-loop')
  );

  // Also check if running via SKIP_AUTH_SETUP env var (for CI or explicit skipping)
  const skipAuthSetup = process.env.SKIP_AUTH_SETUP === 'true' || onlyGuestProjects;

  if (skipAuthSetup) {
    console.log('[Global Setup] ============================================');
    console.log('[Global Setup] Skipping authentication setup');
    console.log('[Global Setup] (Only running guest/unauthenticated tests)');
    console.log('[Global Setup] ============================================');
    return;
  }

  // Get configuration from the correct project
  // Find the auth project or fallback to first project
  const authProject = config.projects.find(p => p.name === 'auth');
  const projectConfig = authProject || config.projects[0];
  const { baseURL } = projectConfig.use;
  const storageStatePath = 'e2e/.auth/state.json';

  const browser = await chromium.launch();
  const baseUrlString = typeof baseURL === 'string' ? baseURL : '';
  const isLocalhost =
    baseUrlString.includes('localhost') || baseUrlString.includes('127.0.0.1');
  const vercelBypassToken =
    process.env.VERCEL_BYPASS_TOKEN ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.VERCEL_BYPASS;
  const extraHTTPHeaders =
    !isLocalhost && vercelBypassToken
      ? { 'x-vercel-protection-bypass': String(vercelBypassToken) }
      : undefined;

  const context = await browser.newContext({
    // Match the main Playwright config so auth setup requests aren't bot-blocked.
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      // Required to pass bot detection (bots typically don't send Accept-Language)
      'Accept-Language': 'en-US,en;q=0.9',
      ...(extraHTTPHeaders ?? {}),
    },
  });
  const page = await context.newPage();

  // Get test credentials from environment
  const testEmail = process.env.TEST_USER_EMAIL || 'test@quiver.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';
  const testEnv = process.env.TEST_ENV || 'local';

  console.log(`[Global Setup] ============================================`);
  console.log(`[Global Setup] Environment: ${testEnv}`);
  console.log(`[Global Setup] Base URL: ${baseURL}`);
  if (!isLocalhost) {
    console.log(
      `[Global Setup] Vercel bypass header: ${
        extraHTTPHeaders ? 'enabled' : 'disabled'
      }`
    );
  }
  console.log(`[Global Setup] Authenticating test user: ${testEmail}`);
  console.log(`[Global Setup] ============================================`);

  const maxAttempts = 3;
  let authenticated = false;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts && !authenticated; attempt++) {
    try {
      console.log(`\n[Global Setup] Authentication attempt ${attempt}/${maxAttempts}`);

      // Navigate to home page
      console.log(`[Global Setup] Navigating to ${baseURL}...`);
      await page.goto(baseURL!, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for React to hydrate (js-loaded class is added after hydration)
      // Don't use networkidle - SPAs with real-time features never reach it
      try {
        await page.waitForSelector('body.js-loaded, body.authenticated', { timeout: 15000 });
        console.log('[Global Setup] React hydration complete');
      } catch {
        // Fallback: wait for load event if js-loaded not found (may be authenticated)
        await page.waitForLoadState('load', { timeout: 15000 });
        console.log('[Global Setup] Page loaded (fallback)');
      }

      // Check if already authenticated
      const isAlreadyAuth = await verifySupabaseAuth(page);

      if (isAlreadyAuth) {
        // Server-validate session. Cookie presence alone can be stale/rotated.
        const serverCheck = await checkServerSession(page, { baseUrl: baseUrlString });
        if (serverCheck.hasSession) {
          console.log('[Global Setup] ✓ Already authenticated (server-validated)');
          authenticated = true;
          break;
        }

        console.log(
          `[Global Setup] Auth tokens present but server session invalid (status=${serverCheck.status}). Will attempt login.`
        );
      }

      console.log('[Global Setup] Not authenticated, attempting login...');

      // Wait for login button to appear (React app needs time to complete auth check)
      console.log('[Global Setup] Waiting for login button to appear...');
      const loginButton = page.getByRole('button', { name: /log in/i });

      try {
        await loginButton.waitFor({ state: 'visible', timeout: 15000 });
        console.log('[Global Setup] Login button found');
      } catch (error) {
        throw new Error('Login button not found after 15 seconds. Page may still be checking authentication.');
      }

      // Use force:true to bypass any overlay issues during SSR-to-client transition
      // This is appropriate for setup since we're not testing click behavior
      await loginButton.click({ force: true });
      console.log('[Global Setup] Clicked login button');

      // Wait for auth modal to appear
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      console.log('[Global Setup] Auth modal appeared');

      // Click "Continue with Email" button to get to email/password form
      const emailButton = page.getByRole('button', { name: /continue with email|sign in with email/i }).first();
      const emailButtonVisible = await emailButton.isVisible().catch(() => false);

      if (emailButtonVisible) {
        await emailButton.click();
        await page.getByPlaceholder(/email/i).waitFor({ state: 'visible', timeout: 5000 });
        console.log('[Global Setup] Clicked "Continue with Email"');
      }

      // Fill in email and password
      const emailInput = page.getByPlaceholder(/email/i);
      const passwordInput = page.getByLabel(/password/i);

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);
      console.log('[Global Setup] Filled credentials');

      // Submit login
      const submitButton = page.getByRole('button', { name: /log in|sign in/i }).last();
      await submitButton.click();
      console.log('[Global Setup] Submitted login form');

      // Wait for authentication to complete
      try {
        await waitForAuthCompletion(page, 15000);
        // Server-validate session before considering setup successful.
        const serverCheck = await checkServerSession(page, { baseUrl: baseUrlString });
        if (!serverCheck.hasSession) {
          const bodyPreview =
            serverCheck.body == null
              ? 'null'
              : JSON.stringify(serverCheck.body).slice(0, 500);
          throw new Error(
            `Server session validation failed after login. status=${serverCheck.status} body=${bodyPreview}`
          );
        }

        authenticated = true;
        console.log('[Global Setup] ✓ Authentication successful (server-validated)!');
      } catch (error) {
        throw new Error(`Authentication verification failed: ${error}`);
      }

      // Wait for modal to close
      try {
        await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
        console.log('[Global Setup] Auth modal closed');
      } catch {
        console.log('[Global Setup] Auth modal still visible, but tokens are present');
      }

    } catch (error) {
      lastError = error as Error;
      console.error(`[Global Setup] Attempt ${attempt} failed:`, error);

      if (attempt < maxAttempts) {
        console.log(`[Global Setup] Retrying in 2 seconds...`);
        // eslint-disable-next-line playwright/no-wait-for-timeout -- retry backoff between login attempts
        await page.waitForTimeout(2000);
      }
    }
  }

  // Check if authentication succeeded
  if (!authenticated) {
    console.error('\n[Global Setup] ❌ AUTHENTICATION FAILED');
    console.error(`[Global Setup] All ${maxAttempts} attempts failed`);
    console.error(`[Global Setup] Last error:`, lastError);

    // Get debug information
    const tokens = await getAuthTokens(page);
    console.error('[Global Setup] Auth state:', {
      cookies: tokens.cookies.length,
      storage: tokens.storage.length
    });

    await context.close();
    await browser.close();

    throw new Error(
      `Failed to authenticate after ${maxAttempts} attempts. ` +
      `Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Please check:\n` +
      `  1. Test credentials are correct in .env.playwright\n` +
      `  2. User exists in the target environment (${testEnv})\n` +
      `  3. ${baseURL} is accessible\n` +
      `  4. Supabase configuration is correct`
    );
  }

  // Log final authentication state
  await logAuthState(page, 'Final Auth State');

  // Save authenticated state
  try {
    await context.storageState({ path: storageStatePath });
    console.log(`[Global Setup] ✓ Saved authentication state to ${storageStatePath}`);

    // Verify the state file contains cookies
    const tokens = await getAuthTokens(page);
    console.log(`[Global Setup] State contains ${tokens.cookies.length} cookies and ${tokens.storage.length} storage entries`);

    if (tokens.cookies.length === 0 && tokens.storage.length === 0) {
      throw new Error('Saved state contains no authentication data');
    }
  } catch (error) {
    console.error('[Global Setup] ❌ Failed to save authentication state:', error);
    await context.close();
    await browser.close();
    throw error;
  }

  await context.close();
  await browser.close();

  console.log('\n[Global Setup] ============================================');
  console.log('[Global Setup] ✓ Global setup completed successfully');
  console.log('[Global Setup] ============================================\n');
}

export default globalSetup;

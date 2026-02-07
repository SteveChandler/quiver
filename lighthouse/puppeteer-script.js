/**
 * Puppeteer script for Lighthouse CI authenticated testing
 *
 * This script logs in before Lighthouse runs its audits,
 * allowing testing of authenticated user flows.
 *
 * The login flow follows the same pattern as e2e/global-setup.ts:
 * 1. Navigate to home page
 * 2. Click "Log in" button to open auth modal
 * 3. Click "Continue with Email" to reveal email/password form
 * 4. Fill credentials and submit
 * 5. Verify authentication succeeded
 *
 * Required environment variables:
 * - LIGHTHOUSE_TEST_EMAIL: Test user email
 * - LIGHTHOUSE_TEST_PASSWORD: Test user password
 */

const BASE_URL = 'http://localhost:3000';
const LOGIN_TIMEOUT = 30000;

/**
 * @param {import('puppeteer').Browser} browser
 * @param {{url: string, options: object}} context
 */
module.exports = async (browser, context) => {
  const page = await browser.newPage();

  const testEmail = process.env.LIGHTHOUSE_TEST_EMAIL;
  const testPassword = process.env.LIGHTHOUSE_TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    // CRITICAL: Missing credentials should fail, not silently continue
    const error = new Error(
      '[Lighthouse Auth] FATAL: Missing LIGHTHOUSE_TEST_EMAIL or LIGHTHOUSE_TEST_PASSWORD environment variables. ' +
      'Cannot run authenticated Lighthouse tests without credentials.'
    );
    console.error(error.message);
    await page.close();
    throw error;
  }

  console.log('[Lighthouse Auth] Starting authentication flow...');
  // Mask email for security - only show domain
  const emailDomain = testEmail.split('@')[1] || 'unknown';
  console.log(`[Lighthouse Auth] Test email: ***@${emailDomain}`);

  // Step 1: Navigate to home page (not sign-in page)
  console.log(`[Lighthouse Auth] Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT });

  // Wait for React hydration - the app adds js-loaded class after hydration
  try {
    await page.waitForSelector('body.js-loaded, body.authenticated', { timeout: 15000 });
    console.log('[Lighthouse Auth] React hydration complete');
  } catch {
    // Fallback: wait for network to settle (Puppeteer API)
    await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
    console.log('[Lighthouse Auth] Page loaded (fallback)');
  }

  // Step 2: Click the "Log in" button to open auth modal
  console.log('[Lighthouse Auth] Looking for login button...');

  // Use XPath-like selector to find button with "Log in" text
  const loginButtonSelector = 'button';
  await page.waitForSelector(loginButtonSelector, { timeout: 15000 });

  // Find the login button by text content
  const loginButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn =>
      btn.textContent?.toLowerCase().includes('log in') ||
      btn.textContent?.toLowerCase().includes('login')
    );
  });

  if (!loginButton || !(await loginButton.asElement())) {
    throw new Error('[Lighthouse Auth] Login button not found on page');
  }

  await loginButton.asElement().click();
  console.log('[Lighthouse Auth] Clicked login button');

  // Step 3: Wait for auth modal to appear
  console.log('[Lighthouse Auth] Waiting for auth modal...');
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  console.log('[Lighthouse Auth] Auth modal appeared');

  // Step 4: Click "Continue with Email" button to reveal email/password form
  // Wait for modal content to fully render
  await page.waitForSelector('[role="dialog"] button', { visible: true, timeout: 5000 });

  const emailMethodButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
    return buttons.find(btn =>
      btn.textContent?.toLowerCase().includes('continue with email') ||
      btn.textContent?.toLowerCase().includes('sign in with email')
    );
  });

  if (emailMethodButton && await emailMethodButton.asElement()) {
    await emailMethodButton.asElement().click();
    console.log('[Lighthouse Auth] Clicked "Continue with Email"');
    // Wait for email input to appear (form transition complete)
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { visible: true, timeout: 10000 });
  } else {
    console.log('[Lighthouse Auth] Email method button not found, form may already be visible');
  }

  // Step 5: Fill email and password
  console.log('[Lighthouse Auth] Filling login form...');

  // Ensure email input is visible (may already be from step 4, but verify)
  await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', { visible: true, timeout: 10000 });

  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  if (!emailInput) {
    throw new Error('[Lighthouse Auth] Email input not found');
  }
  await emailInput.type(testEmail, { delay: 30 });
  console.log('[Lighthouse Auth] Filled email');

  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  if (!passwordInput) {
    throw new Error('[Lighthouse Auth] Password input not found');
  }
  await passwordInput.type(testPassword, { delay: 30 });
  console.log('[Lighthouse Auth] Filled password');

  // Step 6: Submit login form
  // Find submit button within the dialog
  const submitButton = await page.evaluateHandle(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const buttons = Array.from(dialog.querySelectorAll('button[type="submit"], button'));
    return buttons.find(btn =>
      btn.textContent?.toLowerCase().includes('log in') ||
      btn.textContent?.toLowerCase().includes('sign in') ||
      btn.getAttribute('type') === 'submit'
    );
  });

  if (!submitButton || !(await submitButton.asElement())) {
    throw new Error('[Lighthouse Auth] Submit button not found');
  }

  await submitButton.asElement().click();
  console.log('[Lighthouse Auth] Submitted login form');

  // Step 7: Wait for authentication to complete
  console.log('[Lighthouse Auth] Waiting for authentication to complete...');

  // Poll for authentication success indicators
  let authVerified = false;
  const maxWaitTime = 20000;
  const pollInterval = 500;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime && !authVerified) {
    // Check if modal is closed (indicates success)
    const modalVisible = await page.$('[role="dialog"]').then(el => !!el).catch(() => false);

    // Check for authenticated body class
    const bodyAuthenticated = await page.$('body.authenticated').then(el => !!el).catch(() => false);

    // Check for Supabase auth cookies (specifically sb-*-auth-token pattern)
    const cookies = await page.cookies();
    const hasAuthCookie = cookies.some(c =>
      c.name.startsWith('sb-') && c.name.includes('auth-token')
    );

    if (!modalVisible || bodyAuthenticated || hasAuthCookie) {
      authVerified = true;
      console.log(`[Lighthouse Auth] Auth indicators: modal_closed=${!modalVisible}, body_auth=${bodyAuthenticated}, has_cookie=${hasAuthCookie}`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  if (!authVerified) {
    console.log('[Lighthouse Auth] Warning: Could not verify auth completion within timeout');
  }

  // Final verification: ensure we're not redirected to sign-in on a protected page
  console.log('[Lighthouse Auth] Verifying authentication by accessing protected page...');
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT });

  // Wait for page to settle and check for redirects
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

  const currentUrl = page.url();
  if (currentUrl.includes('/auth/sign-in') || currentUrl.includes('/login')) {
    // Get more debug info
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => c.name.startsWith('sb-'));
    throw new Error(
      `[Lighthouse Auth] AUTHENTICATION FAILED: Redirected to sign-in page (${currentUrl}). ` +
      `Auth cookies found: ${authCookies.length}. ` +
      'This indicates the login did not succeed. Check credentials and try again.'
    );
  }

  console.log('[Lighthouse Auth] ✅ Login successful, authenticated session ready');
  console.log(`[Lighthouse Auth] Current URL after auth: ${currentUrl}`);

  await page.close();
};

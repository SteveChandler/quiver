/**
 * Puppeteer script for Lighthouse CI authenticated testing
 *
 * This script logs in before Lighthouse runs its audits,
 * allowing testing of authenticated user flows.
 *
 * Required environment variables:
 * - LIGHTHOUSE_TEST_EMAIL: Test user email
 * - LIGHTHOUSE_TEST_PASSWORD: Test user password
 */

const LOGIN_URL = 'http://localhost:3000/auth/sign-in';
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
    console.warn('[Lighthouse Auth] No test credentials provided - running unauthenticated');
    await page.close();
    return;
  }

  try {
    console.log('[Lighthouse Auth] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT });

    // Wait for the login form to be ready
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    console.log('[Lighthouse Auth] Filling login form...');

    // Fill email
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    if (emailInput) {
      await emailInput.type(testEmail, { delay: 50 });
    }

    // Fill password
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    if (passwordInput) {
      await passwordInput.type(testPassword, { delay: 50 });
    }

    // Click submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
    }

    // Wait for navigation after login
    console.log('[Lighthouse Auth] Waiting for login to complete...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: LOGIN_TIMEOUT });

    // Verify we're logged in by checking we're not on the sign-in page
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/sign-in')) {
      console.warn('[Lighthouse Auth] Still on sign-in page - login may have failed');
    } else {
      console.log('[Lighthouse Auth] Login successful, authenticated session ready');
    }

  } catch (error) {
    console.error('[Lighthouse Auth] Login failed:', error.message);
  } finally {
    await page.close();
  }
};

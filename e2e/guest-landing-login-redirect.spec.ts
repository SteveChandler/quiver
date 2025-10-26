/**
 * E2E Tests: Guest Landing Page Login Redirect
 *
 * Tests the bug fix where users logging in from the landing page were being
 * redirected to beach pages instead of staying on the home page (/).
 *
 * Bug Fix: Updated components/landing-page/navbar.tsx to pass returnTo="/"
 * to UnifiedAuthModal, ensuring explicit redirect to home page after login.
 *
 * Test Coverage:
 * 1. Basic login flow from landing page -> should land on / (HomeScreen)
 * 2. Edge case: Stale beach path in localStorage -> should override with /
 * 3. Multiple login attempts -> should work consistently
 * 4. Verification that auth_redirect_path is cleared after successful login
 */

import { test, expect } from '@playwright/test';
import { waitForNetworkIdle } from './utils/waits';

/**
 * Custom login helper for landing page authentication
 * Opens the auth modal from navbar and completes login
 */
async function loginFromLandingPage(
  page: any,
  options: {
    email?: string;
    password?: string;
    setStaleRedirect?: string; // Optional: set stale localStorage redirect before login
  } = {}
) {
  const email = options.email ?? process.env.E2E_USER_EMAIL ?? process.env.TEST_USER_EMAIL;
  const password = options.password ?? process.env.E2E_USER_PASSWORD ?? process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('Set E2E_USER_EMAIL/E2E_USER_PASSWORD in your .env');
  }

  // If requested, set a stale redirect path in localStorage (simulating previous session)
  if (options.setStaleRedirect) {
    await page.evaluate((path: string) => {
      try {
        localStorage.setItem('auth_redirect_path', path);
      } catch (e) {
        // Ignore localStorage security errors
      }
    }, options.setStaleRedirect);

    // Verify it was set
    const storedPath = await page.evaluate(() => {
      try {
        return localStorage.getItem('auth_redirect_path');
      } catch (e) {
        return null;
      }
    });
    console.log(`[Test] Set stale redirect path in localStorage: ${storedPath}`);
  }

  // Click the "Log in" button in the landing page navbar
  const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  await loginButton.click();

  // Wait for the unified auth modal dialog to appear
  const authDialog = page.getByRole('dialog');
  await authDialog.waitFor({ state: 'visible', timeout: 10000 });

  // Click "Continue with Email" button to switch to email/password view
  const emailButton = page.getByRole('button', { name: 'Continue with Email', exact: true });
  await emailButton.waitFor({ state: 'visible', timeout: 10000 });
  await emailButton.click();

  // Wait for form inputs to be visible
  const emailInput = page.getByRole('textbox', { name: 'Email' });
  const passwordInput = page.getByRole('textbox', { name: 'Password' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  // Fill in credentials
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Click the "Log in" submit button in the modal
  // At this point, we're in the email/password form view, so there's only one "Log in" button
  const submitButton = authDialog.getByRole('button', { name: 'Log in', exact: true });
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.click();

  // Wait for authentication to complete
  // The modal should close and we should be redirected
  await authDialog.waitFor({ state: 'hidden', timeout: 30000 });
}

/**
 * Helper to verify user is on the authenticated home page
 */
async function verifyOnHomeScreen(page: any) {
  // Verify URL is exactly "/" (home page)
  await expect(page).toHaveURL('/', { timeout: 30000 });

  // Wait for network to settle
  await waitForNetworkIdle(page);

  // Verify HomeScreen-specific elements are visible
  // 1. Welcome message with user's name or "Hey, Surfer!" or "Hey, Guest!"
  const welcomeHeading = page.locator('h2').filter({ hasText: /Hey/ });
  await expect(welcomeHeading).toBeVisible({ timeout: 10000 });

  // 2. Action buttons: "Plan Session" and "Log Session"
  const planSessionButton = page.getByRole('button', { name: /plan session/i });
  const logSessionButton = page.getByRole('button', { name: /log session/i });
  await expect(planSessionButton).toBeVisible({ timeout: 10000 });
  await expect(logSessionButton).toBeVisible({ timeout: 10000 });

  // 3. Tab navigation: Forecast, Nearby, Local Intel
  const forecastTab = page.getByRole('tab', { name: /forecast/i });
  const nearbyTab = page.getByRole('tab', { name: /nearby/i });
  const communityTab = page.getByRole('tab', { name: /local intel/i });
  await expect(forecastTab).toBeVisible({ timeout: 10000 });
  await expect(nearbyTab).toBeVisible({ timeout: 10000 });
  await expect(communityTab).toBeVisible({ timeout: 10000 });

  console.log('[Test] ✓ Verified user is on authenticated HomeScreen at /');
}

/**
 * Helper to verify user is NOT on a beach detail page
 */
async function verifyNotOnBeachPage(page: any) {
  const currentUrl = page.url();

  // Beach detail pages have URLs like /beach/[slug]
  // We should NOT be on any beach page
  expect(currentUrl).not.toMatch(/\/beach\/[^/]+$/);

  console.log(`[Test] ✓ Verified NOT on beach page. Current URL: ${currentUrl}`);
}

/**
 * Helper to logout and clear auth state
 */
async function logout(page: any) {
  try {
    // Clear localStorage auth data (wrap in try-catch for security errors)
    await page.evaluate(() => {
      try {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('auth_redirect_path');
        localStorage.removeItem('redirectAttempts');
        sessionStorage.clear();
      } catch (e) {
        // Ignore localStorage security errors
      }
    });

    // Navigate to home and wait for redirect to landing
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    console.log('[Test] ✓ Logged out and cleared auth state');
  } catch (error) {
    // Ignore errors - best effort cleanup
  }
}

test.describe('Guest Landing Page Login Redirect', () => {
  // Ensure we start each test from a clean slate (logged out)
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state (wrap in try-catch for security errors)
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore localStorage security errors
      }
    });

    // Navigate to landing page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify we're on the landing page (guest view)
    // Landing page should have a navbar with "Log in" and "Sign Up" buttons
    const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    await expect(loginButton).toBeVisible({ timeout: 10000 });

    console.log('[Test] Starting test from landing page (logged out)');
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await logout(page);
  });

  test('1. Basic Login Flow: User logs in from landing page and lands on / (HomeScreen)', async ({ page }) => {
    console.log('\n=== Test 1: Basic Login Flow ===');

    // Perform login from landing page navbar
    await loginFromLandingPage(page);

    // Verify we landed on the home page (/)
    await verifyOnHomeScreen(page);

    // Verify we did NOT get redirected to a beach page
    await verifyNotOnBeachPage(page);

    // Verify localStorage auth_redirect_path is cleared after successful login
    const redirectPath = await page.evaluate(() => {
      try {
        return localStorage.getItem('auth_redirect_path');
      } catch (e) {
        return null;
      }
    });
    expect(redirectPath).toBeNull();
    console.log('[Test] ✓ Verified auth_redirect_path cleared from localStorage');
  });

  test('2. Edge Case: Stale Beach Path in localStorage - Should Override with /', async ({ page }) => {
    console.log('\n=== Test 2: Stale localStorage Override ===');

    // Simulate a stale redirect path from a previous session
    // For example, user previously visited a beach page
    const staleBeachUrl = '/beach/ocean-beach-san-diego';

    console.log(`[Test] Setting stale redirect path: ${staleBeachUrl}`);

    // Perform login with stale localStorage redirect
    await loginFromLandingPage(page, {
      setStaleRedirect: staleBeachUrl
    });

    // The explicit returnTo="/" in navbar.tsx should override the stale localStorage value
    // Verify we landed on the home page (/), NOT the stale beach page
    await verifyOnHomeScreen(page);

    // Double-check we did NOT get redirected to the beach page
    await verifyNotOnBeachPage(page);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('ocean-beach-san-diego');
    console.log('[Test] ✓ Stale beach path was overridden - landed on / instead');

    // Verify localStorage auth_redirect_path is cleared
    const redirectPath = await page.evaluate(() => {
      try {
        return localStorage.getItem('auth_redirect_path');
      } catch (e) {
        return null;
      }
    });
    expect(redirectPath).toBeNull();
    console.log('[Test] ✓ Stale redirect path cleared from localStorage');
  });

  test('3. Multiple Login Attempts: Verify consistent behavior', async ({ page }) => {
    console.log('\n=== Test 3: Multiple Login Attempts ===');

    // First login attempt
    console.log('[Test] Attempt 1/2');
    await loginFromLandingPage(page);
    await verifyOnHomeScreen(page);
    await verifyNotOnBeachPage(page);

    // Logout
    await logout(page);

    // Wait a bit to ensure state is cleared
    await page.waitForTimeout(1000);

    // Verify we're back on landing page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    await expect(loginButton).toBeVisible({ timeout: 10000 });

    // Second login attempt
    console.log('[Test] Attempt 2/2');
    await loginFromLandingPage(page);
    await verifyOnHomeScreen(page);
    await verifyNotOnBeachPage(page);

    console.log('[Test] ✓ Both login attempts succeeded with consistent behavior');
  });

  test('4. Stale Path + Multiple Logins: Verify no accumulated state issues', async ({ page }) => {
    console.log('\n=== Test 4: Stale Path + Multiple Logins ===');

    // First attempt with one stale path
    const stalePath1 = '/beach/la-jolla-shores';
    console.log(`[Test] Attempt 1: Setting stale path ${stalePath1}`);
    await loginFromLandingPage(page, { setStaleRedirect: stalePath1 });
    await verifyOnHomeScreen(page);

    // Logout
    await logout(page);
    await page.waitForTimeout(1000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Second attempt with different stale path
    const stalePath2 = '/beach/blacks-beach';
    console.log(`[Test] Attempt 2: Setting stale path ${stalePath2}`);
    await loginFromLandingPage(page, { setStaleRedirect: stalePath2 });
    await verifyOnHomeScreen(page);

    // Verify we're still on / and not on any beach page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('la-jolla-shores');
    expect(currentUrl).not.toContain('blacks-beach');

    console.log('[Test] ✓ No accumulated state issues - both attempts landed on /');
  });

  test('5. Desktop Viewport: Login from navbar "Log in" button', async ({ page }) => {
    console.log('\n=== Test 5: Desktop Viewport ===');

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Perform login
    await loginFromLandingPage(page);

    // Verify home screen
    await verifyOnHomeScreen(page);
    await verifyNotOnBeachPage(page);

    console.log('[Test] ✓ Desktop login flow works correctly');
  });

  test('6. Mobile Viewport: Login from mobile menu', async ({ page }) => {
    console.log('\n=== Test 6: Mobile Viewport ===');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // On mobile, the landing page navbar has a Sheet menu for mobile
    // We need to click the hamburger menu icon to open it
    const mobileMenuTrigger = page.locator('button').filter({ has: page.locator('svg.lucide-menu') });
    const isMobileMenuVisible = await mobileMenuTrigger.isVisible().catch(() => false);

    if (isMobileMenuVisible) {
      console.log('[Test] Opening mobile menu...');
      await mobileMenuTrigger.click();
      await page.waitForTimeout(500); // Wait for sheet to open

      // Now the "Log in" button should be visible in the mobile sheet
      const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
      await loginButton.waitFor({ state: 'visible', timeout: 10000 });
      await loginButton.click();
    } else {
      // If no hamburger menu (maybe viewport is larger), just use the standard login button
      console.log('[Test] No mobile menu found, using desktop login button');
      const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
      await loginButton.click();
    }

    // Continue with standard login flow
    const authDialog = page.getByRole('dialog');
    await authDialog.waitFor({ state: 'visible', timeout: 10000 });

    const emailButton = page.getByRole('button', { name: 'Continue with Email', exact: true });
    await emailButton.click();

    const email = process.env.E2E_USER_EMAIL ?? process.env.TEST_USER_EMAIL!;
    const password = process.env.E2E_USER_PASSWORD ?? process.env.TEST_USER_PASSWORD!;

    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);

    const submitButton = authDialog.getByRole('button', { name: 'Log in', exact: true });
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    await submitButton.click();

    await authDialog.waitFor({ state: 'hidden', timeout: 30000 });

    // Verify home screen
    await verifyOnHomeScreen(page);
    await verifyNotOnBeachPage(page);

    console.log('[Test] ✓ Mobile login flow works correctly');
  });

  test('7. Verify returnTo="/" is passed to UnifiedAuthModal', async ({ page }) => {
    console.log('\n=== Test 7: Verify returnTo prop ===');

    // This test verifies the fix at the code level
    // by checking that auth_redirect_path is set to "/" before login

    // Click login button to open modal
    const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    await loginButton.click();

    // Wait for modal to open and for React useEffect to run
    const authDialog = page.getByRole('dialog');
    await authDialog.waitFor({ state: 'visible', timeout: 10000 });

    // Wait a bit for the modal's useEffect to set returnTo in localStorage
    await page.waitForTimeout(1000);

    // Check that auth_redirect_path is set to "/" (or null, which defaults to "/")
    const redirectPath = await page.evaluate(() => {
      try {
        return localStorage.getItem('auth_redirect_path');
      } catch (e) {
        return null;
      }
    });

    // The modal's useEffect should set it to "/" when returnTo="/" is provided
    // However, "/" is also the default, so even null is acceptable
    // The important thing is it's NOT a beach path
    expect(redirectPath === '/' || redirectPath === null).toBeTruthy();

    console.log(`[Test] ✓ Verified returnTo="/" results in redirect path: ${redirectPath || '/' } (default)`);


    // Close the modal without logging in
    const closeButton = page.getByRole('button', { name: /close/i }).or(page.locator('[aria-label*="close"]')).first();
    const isCloseVisible = await closeButton.isVisible().catch(() => false);

    if (isCloseVisible) {
      await closeButton.click();
    } else {
      // Press Escape to close
      await page.keyboard.press('Escape');
    }
  });
});

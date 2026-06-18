import { Page } from '@playwright/test';
import {
  verifySupabaseAuth,
  waitForAuthCompletion,
  ensureAuthenticated as ensureAuthenticatedHelper
} from './auth-helpers';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';

/**
 * Utility functions for E2E tests
 */

/**
 * Wait for an API response matching a URL pattern, triggered by an action.
 * Sets up the response listener BEFORE the action executes to avoid races.
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>,
  options?: { timeout?: number }
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (resp) => typeof urlPattern === 'string'
      ? resp.url().includes(urlPattern)
      : urlPattern.test(resp.url()),
    { timeout: options?.timeout ?? 15000 }
  );
  await action();
  await responsePromise;
}

/**
 * Legacy helper name: wait for deterministic page readiness.
 */
export async function waitForNetwork(page: Page, timeout = 5000): Promise<void> {
  await waitForPageLoad(page, timeout);
}

/**
 * Wait for element to be visible with custom timeout
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Check if user is authenticated
 * Uses improved authentication verification from auth-helpers
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await verifySupabaseAuth(page);
}

/**
 * Ensure user is authenticated before running test
 * Throws a helpful error if authentication is missing
 *
 * Use this in test beforeEach hooks:
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await ensureAuthenticated(page);
 *   await page.goto('/sessions');
 * });
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  return await ensureAuthenticatedHelper(page);
}

/**
 * Open auth modal (if not already authenticated)
 */
export async function openAuthModal(page: Page) {
  const loginButton = page.getByRole('button', { name: /log in|sign in/i }).first();
  const isVisible = await loginButton.isVisible().catch(() => false);

  if (isVisible) {
    await loginButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  }
}

/**
 * Login helper (for guest tests)
 * Uses improved authentication completion detection
 */
export async function login(page: Page, email: string, password: string) {
  // Open auth modal
  await openAuthModal(page);

  // Click "Continue with Email" to get password form
  const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
  const emailButtonVisible = await emailButton.isVisible().catch(() => false);

  if (emailButtonVisible) {
    await emailButton.click();
    await page.getByPlaceholder(/email/i).waitFor({ state: 'visible', timeout: 5000 });
  }

  // Fill credentials
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit
  await page.getByRole('button', { name: /log in|sign in/i }).last().click();

  // Wait for auth to complete (using improved helper)
  await waitForAuthCompletion(page, 15000);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Look for user avatar/menu button
  const userMenu = page.getByRole('button', { name: /user menu|account/i });
  const isVisible = await userMenu.isVisible().catch(() => false);

  if (isVisible) {
    await userMenu.click();

    // Click logout
    const logoutButton = page.getByRole('menuitem', { name: /log out|sign out/i });
    await logoutButton.click();

    // Wait for logout to complete
    await page.waitForLoadState('load', { timeout: 5000 });
  }
}

/**
 * Navigate to a beach detail page
 * @param page - Playwright page object
 * @param beach - Beach object with slug, city, state OR legacy beach ID string
 */
export async function navigateToBeach(
  page: Page,
  beach: { slug: string | null; city: string | null; state: string | null; id?: string } | string
) {
  let url: string;

  if (typeof beach === 'string') {
    // Legacy: support old beach ID format during migration
    url = `/beach/${beach}`;
  } else {
    // New hierarchical URL format using the same utility as production code
    url = buildBeachUrl(beach);
  }

  await page.goto(url);
  await waitForPageLoad(page);
}

/**
 * Check if an element is visible without throwing
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).isVisible();
  } catch {
    return false;
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  await page.screenshot({ path: `test-results/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('load', { timeout });
}

/**
 * Dismiss onboarding wizard if it appears
 * This modal can appear on various pages and block interactions
 */
export async function dismissOnboardingWizard(page: Page): Promise<void> {
  try {
    // Check if onboarding dialog is visible
    const dialog = page.locator('dialog[role="dialog"]:has-text("Onboarding Wizard")');
    const isDialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (isDialogVisible) {
      // Try to click the close button
      const closeButton = dialog.locator('button:has-text("Close")');
      await closeButton.click({ timeout: 5000 });
      // Wait for dialog to close
      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  } catch (error) {
    // Onboarding wizard not present or already closed - this is fine
  }
}

/**
 * Check for console errors
 */
export async function hasConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return errors;
}

/**
 * Wait for element with detailed debugging output
 *
 * This enhanced version provides comprehensive debugging when elements aren't found,
 * making it easier to diagnose test failures on different environments.
 *
 * @param page - Playwright page object
 * @param selector - CSS selector or role-based selector
 * @param options - Configuration options
 * @returns Promise<void>
 *
 * @example
 * await waitForElementWithDebug(page, '[role="dialog"]', {
 *   description: 'Edit Profile Modal',
 *   timeout: 15000
 * });
 */
export async function waitForElementWithDebug(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    description?: string;
    state?: 'visible' | 'attached' | 'hidden';
  } = {}
): Promise<void> {
  const { timeout = 30000, description = selector, state = 'visible' } = options;
  const debugMode = process.env.DEBUG_TESTS === 'true';

  try {
    if (debugMode) {
      console.log(`[Debug] Waiting for: ${description}`);
      console.log(`[Debug] Selector: ${selector}`);
      console.log(`[Debug] Timeout: ${timeout}ms`);
    }

    await page.waitForSelector(selector, { state, timeout });

    if (debugMode) {
      console.log(`[Debug] ✓ Found: ${description}`);
    }
  } catch (error) {
    // Element not found - gather debugging information
    const url = page.url();
    const title = await page.title().catch(() => 'Unknown');

    // Get page HTML (first 2000 chars) for debugging
    const html = await page.content().catch(() => 'Unable to get page content');
    const htmlPreview = html.substring(0, 2000);

    // Check for JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // Take screenshot for visual debugging
    const timestamp = Date.now();
    const screenshotPath = `test-results/debug-missing-element-${timestamp}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {
      // Screenshot might fail, that's ok
    });

    // Build comprehensive error message
    const errorDetails = [
      `\n❌ Failed to find element: ${description}`,
      `   Selector: ${selector}`,
      `   State: ${state}`,
      `   Timeout: ${timeout}ms`,
      ``,
      `📍 Page Context:`,
      `   URL: ${url}`,
      `   Title: ${title}`,
      ``,
      `🐛 Debugging Info:`,
      `   Screenshot: ${screenshotPath}`,
      `   HTML Preview (first 2000 chars): ${htmlPreview}`,
      ``
    ];

    if (jsErrors.length > 0) {
      errorDetails.push(`⚠️  JavaScript Errors:`);
      jsErrors.forEach(err => errorDetails.push(`   - ${err}`));
      errorDetails.push('');
    }

    errorDetails.push(`💡 Troubleshooting Tips:`);
    errorDetails.push(`   1. Check if element requires user interaction first`);
    errorDetails.push(`   2. Verify user has necessary permissions`);
    errorDetails.push(`   3. Check if feature is enabled on this environment`);
    errorDetails.push(`   4. Review screenshot at: ${screenshotPath}`);

    const fullErrorMessage = errorDetails.join('\n');
    console.error(fullErrorMessage);

    throw new Error(fullErrorMessage);
  }
}

/**
 * Wait for modal/dialog to open with automatic retry logic
 *
 * Modals often require specific user interactions and may not appear immediately.
 * This helper includes retry logic and comprehensive debugging.
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @returns Promise<void>
 *
 * @example
 * await clickElement(page, 'button', 'Edit Profile');
 * await waitForModal(page, { description: 'Edit Profile Modal' });
 */
export async function waitForModal(
  page: Page,
  options: {
    timeout?: number;
    description?: string;
    retries?: number;
  } = {}
): Promise<void> {
  const { timeout = 30000, description = 'Modal', retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForElementWithDebug(page, '[role="dialog"]', {
        timeout: timeout / (retries + 1),
        description: `${description} (attempt ${attempt + 1}/${retries + 1})`,
        state: 'visible'
      });
      return; // Success!
    } catch (error) {
      if (attempt === retries) {
        // Final attempt failed
        throw error;
      }

      // Wait a bit before retrying
      console.log(`[Retry] Modal not found on attempt ${attempt + 1}, retrying...`);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- retry backoff between modal detection attempts
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Click an element with built-in waiting and error handling
 *
 * Automatically waits for element to be visible and actionable before clicking.
 * Provides detailed error messages if click fails.
 *
 * @param page - Playwright page object
 * @param selector - CSS selector or role-based selector
 * @param description - Human-readable description for debugging
 * @param options - Additional options
 * @returns Promise<void>
 *
 * @example
 * await clickElement(page, 'button[type="submit"]', 'Submit Button');
 * await clickElement(page, '[data-testid="edit-profile"]', 'Edit Profile Button', { timeout: 15000 });
 */
export async function clickElement(
  page: Page,
  selector: string,
  description: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await waitForElementWithDebug(page, selector, {
    description: `${description} (before click)`,
    timeout,
    state: 'visible'
  });

  try {
    await page.locator(selector).click({ timeout });
  } catch (error) {
    throw new Error(
      `Failed to click ${description} (${selector}).\n` +
      `Element was visible but click failed. This might indicate:\n` +
      `  1. Element is obscured by another element\n` +
      `  2. Element is disabled\n` +
      `  3. Element moved after visibility check\n` +
      `Original error: ${error}`
    );
  }
}

/**
 * Wait for the authenticated OracleHomeScreen to render on the home page.
 *
 * On dev/production, the auth state from e2e/.auth/state.json may have
 * stale tokens, causing useAuth() to resolve user as null. When that
 * happens, the page shows the guest landing instead of OracleHomeScreen
 * and the OracleHero `<section role="banner">` never appears.
 *
 * This helper detects both outcomes quickly and returns false when the
 * authenticated home screen does not load, allowing tests to skip
 * gracefully instead of timing out for 30-120 seconds.
 *
 * @returns true if the authenticated home screen rendered, false otherwise
 */
export async function waitForAuthenticatedHome(page: Page): Promise<boolean> {
  // Race between authenticated home selectors and guest landing indicators.
  // Post-2026-04-25 oracle refactor: greeting-section / coast-pulse-section /
  // Time slot filter were removed from the authed home. The OracleHero
  // <section role="banner" aria-label="… surf conditions"> is the stable
  // signal that the authenticated home rendered.
  const timeout = 45000;

  try {
    await Promise.race([
      page.waitForSelector(
        'section[role="banner"][aria-label*="surf conditions"]',
        { state: 'visible', timeout }
      ),
      page.waitForSelector('[data-testid="nearby-spots-scroll"]', {
        state: 'visible',
        timeout,
      }),
      page.getByText(/couldn't find any surf spots near you right now/i).waitFor({
        state: 'visible',
        timeout,
      }),
      page.getByRole('heading', { name: /popular surf spots/i }).waitFor({
        state: 'visible',
        timeout,
      }),
    ]);
    return true;
  } catch {
    // Check if the guest landing loaded instead
    const isGuestLanding = await page.locator('nav').first().isVisible().catch(() => false);
    if (isGuestLanding) {
      return false; // Guest landing rendered — auth tokens likely stale
    }
    return false;
  }
}

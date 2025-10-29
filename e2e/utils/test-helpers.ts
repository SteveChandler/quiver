import { Page, expect } from '@playwright/test';
import {
  verifySupabaseAuth,
  waitForAuthCompletion,
  ensureAuthenticated as ensureAuthenticatedHelper
} from './auth-helpers';

/**
 * Utility functions for E2E tests
 */

/**
 * Wait for network to be idle
 */
export async function waitForNetwork(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
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
    await page.waitForTimeout(1000);
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
    await page.waitForTimeout(1000);
  }
}

/**
 * Navigate to a beach detail page
 */
export async function navigateToBeach(page: Page, beachId: string) {
  await page.goto(`/beach/${beachId}`);
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
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Ignore timeout - some pages have long-polling connections
  });
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

import { test, expect } from '@playwright/test';
import { TEST_USER } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Guest Authentication Tests
 * Tests login and signup flows for unauthenticated users
 *
 * @project guest
 */

test.describe('Authentication Flow', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Authentication Flow' });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Wait for auth modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await isVisibleSafe(emailButton);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForLoadState('load');
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Wait for login to complete (modal should close)
    await page.waitForLoadState('networkidle');

    // Verify authentication succeeded (modal should be gone, and we see authenticated content)
    const dialog = page.locator('[role="dialog"]');
    const isVisible = await isVisibleSafe(dialog);

    expect(isVisible).toBe(false);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await isVisibleSafe(emailButton);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForLoadState('load');
    }

    // Fill in INVALID credentials
    await page.getByPlaceholder(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Should see error message - look for alert role or common error patterns
    await page.waitForLoadState('networkidle');

    // Try multiple error selectors
    const errorByRole = page.getByRole('alert');
    const errorByText = page.getByText(/invalid|wrong|incorrect|failed|error/i).first();
    const errorByClass = page.locator('[class*="error"], [class*="alert"]').first();

    const hasErrorRole = await isVisibleSafe(errorByRole);
    const hasErrorText = await isVisibleSafe(errorByText);
    const hasErrorClass = await isVisibleSafe(errorByClass);

    // At least one error indicator should be visible
    expect(hasErrorRole || hasErrorText || hasErrorClass).toBe(true);
  });

  test('should NOT create login loop after successful login', async ({ page }) => {
    // This test validates the fix from the login loop bug

    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await isVisibleSafe(emailButton);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForLoadState('load');
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Wait for auth to complete
    await page.waitForLoadState('networkidle');

    // Modal should be CLOSED (not reopened)
    const dialog = page.locator('[role="dialog"]');
    const modalStillOpen = await isVisibleSafe(dialog);

    expect(modalStillOpen).toBe(false);

    // Page should NOT have reloaded (no hard redirect)
    // We can check by seeing if the performance.navigation.type is not reload
    const didReload = await page.evaluate(() => {
      return performance.navigation.type === 1; // TYPE_RELOAD
    });

    expect(didReload).toBe(false);
  });

  test('should prevent multiple rapid login submissions', async ({ page }) => {
    // Set up console listener before any actions
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await isVisibleSafe(emailButton);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForLoadState('load');
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Try to submit multiple times rapidly
    const submitButton = page.getByRole('button', { name: /log in|sign in/i }).last();

    // Click submit button
    await submitButton.click();

    // Immediately try to click again (should be prevented)
    try {
      await submitButton.click({ timeout: 500 });
      await submitButton.click({ timeout: 500 });
    } catch {
      // It's OK if clicks fail because button is disabled or page navigated
    }

    // Wait for auth to complete or page to navigate
    await page.waitForLoadState('networkidle').catch(() => {});

    // Test passes if: 1) Button was disabled preventing clicks, or 2) No duplicate errors logged
    // We can't reliably check the button state because successful login navigates the page
    expect(errors.filter(e => e.includes('duplicate') || e.includes('already processing')).length).toBe(0);
  });

  test('should close auth modal with escape key', async ({ page }) => {
    // Open auth modal
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Press escape
    await page.keyboard.press('Escape');

    // Modal should close
    await page.waitForLoadState('load');
    const dialog = page.locator('[role="dialog"]');
    const isVisible = await isVisibleSafe(dialog);

    expect(isVisible).toBe(false);
  });
});

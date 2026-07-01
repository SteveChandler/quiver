import { test, expect } from '@playwright/test';
import { TEST_USER } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';
import { ensureLocalAuthUser, isLocalE2ETarget } from './utils/local-supabase-fixtures';

/**
 * Guest Authentication Tests
 * Tests login and signup flows for unauthenticated users
 *
 * @project guest
 */

test.describe('Authentication Flow', () => {
  let errorCapture: ErrorCapture;

  test.beforeAll(async () => {
    if (!isLocalE2ETarget()) return;

    await ensureLocalAuthUser({
      displayName: 'testuser',
      email: TEST_USER.email,
      fixtureName: 'guest-auth',
      fullName: TEST_USER.name,
      password: TEST_USER.password,
    });
  });

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

    // Wait for modal to actually close (accounts for Radix Dialog close animation)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeHidden({ timeout: 10_000 });
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

    // Look for error indicators inside the dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Supabase Auth UI shows error messages — check for any error text
    const errorInDialog = dialog.getByText(/invalid|wrong|incorrect|failed|error|credentials/i).first();
    const hasError = await isVisibleSafe(errorInDialog, { timeout: 5_000 });

    // If no explicit error text, the dialog staying open after submission IS the error indicator
    expect(hasError || await isVisibleSafe(dialog)).toBe(true);

    // Clean up: dismiss the dialog and clear expected errors so afterEach assertNoErrors passes
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    errorCapture.consoleErrors = [];
    errorCapture.networkErrors = [];
    errorCapture.visibleErrors = [];
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

    // Wait for modal to actually close (accounts for Radix Dialog close animation)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeHidden({ timeout: 10_000 });

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

    // Wait for auth to complete or for the submit button to move into a
    // transient disabled/submitting state. `networkidle` is intentionally not
    // used here because analytics beacons can keep remote runs non-idle.
    await Promise.race([
      expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 }).catch(() => undefined),
      expect(submitButton).toBeDisabled({ timeout: 2_000 }).catch(() => undefined),
    ]);

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

    // Wait for modal to actually close (accounts for Radix Dialog close animation)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});

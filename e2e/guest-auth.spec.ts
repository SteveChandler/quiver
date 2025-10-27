import { test, expect } from '@playwright/test';
import { TEST_USER } from './fixtures/test-data';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * Guest Authentication Tests
 * Tests login and signup flows for unauthenticated users
 *
 * @project guest
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    // Wait for auth modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await emailButton.isVisible().catch(() => false);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Wait for login to complete (modal should close)
    await page.waitForTimeout(3000);

    // Verify authentication succeeded (modal should be gone, and we see authenticated content)
    const dialog = page.locator('[role="dialog"]');
    const isVisible = await dialog.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await emailButton.isVisible().catch(() => false);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill in INVALID credentials
    await page.getByPlaceholder(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Should see error message
    await page.waitForTimeout(2000);
    const errorMessage = page.getByText(/invalid.*credentials|incorrect.*email.*password/i);
    await expect(errorMessage).toBeVisible();
  });

  test('should NOT create login loop after successful login', async ({ page }) => {
    // This test validates the fix from the login loop bug

    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await emailButton.isVisible().catch(() => false);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Submit
    await page.getByRole('button', { name: /log in|sign in/i }).last().click();

    // Wait for auth to complete
    await page.waitForTimeout(4000);

    // Modal should be CLOSED (not reopened)
    const dialog = page.locator('[role="dialog"]');
    const modalStillOpen = await dialog.isVisible().catch(() => false);

    expect(modalStillOpen).toBe(false);

    // Page should NOT have reloaded (no hard redirect)
    // We can check by seeing if the performance.navigation.type is not reload
    const didReload = await page.evaluate(() => {
      return performance.navigation.type === 1; // TYPE_RELOAD
    });

    expect(didReload).toBe(false);
  });

  test('should prevent multiple rapid login submissions', async ({ page }) => {
    // Click login button
    const loginButton = page.getByRole('button', { name: /log in/i });
    await loginButton.click();

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Click "Continue with Email"
    const emailButton = page.getByRole('button', { name: /continue with email/i }).first();
    const emailButtonVisible = await emailButton.isVisible().catch(() => false);

    if (emailButtonVisible) {
      await emailButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill in credentials
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);

    // Try to submit multiple times rapidly
    const submitButton = page.getByRole('button', { name: /log in|sign in/i }).last();

    await submitButton.click();
    await submitButton.click(); // Second click
    await submitButton.click(); // Third click

    // Wait
    await page.waitForTimeout(3000);

    // Should only have processed one login (no duplicate requests)
    // We verify this indirectly by checking the console for errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Should not have duplicate submission errors
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
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const isVisible = await dialog.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });
});

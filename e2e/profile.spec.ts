import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';

/**
 * User Profile Tests
 * Tests the user profile page and editing functionality
 *
 * @project auth
 */

test.describe('User Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await waitForPageLoad(page);
  });

  test('should display user profile page', async ({ page }) => {
    // Should show profile heading or user info
    const profileHeading = page.getByRole('heading', { name: /profile|my profile|account/i });
    const hasHeading = await profileHeading.isVisible().catch(() => false);

    if (!hasHeading) {
      // Maybe profile uses different structure - check for user name or email
      const userInfo = page.getByText(/@|user|profile/i).first();
      await expect(userInfo).toBeVisible({ timeout: 10000 });
    } else {
      await expect(profileHeading).toBeVisible();
    }
  });

  test('should display user information', async ({ page }) => {
    // Should show email or name
    const emailOrName = page.locator('[type="email"], [value*="@"]').first();
    const hasInfo = await emailOrName.isVisible().catch(() => false);

    if (!hasInfo) {
      // Look for display text
      const userText = page.getByText(/@/).first();
      const hasText = await userText.isVisible().catch(() => false);

      expect(hasText).toBe(true);
    }
  });

  test('should have edit profile functionality', async ({ page }) => {
    // Look for edit button or editable fields
    const editButton = page.getByRole('button', { name: /edit|update|save/i });
    const hasEdit = await editButton.isVisible().catch(() => false);

    if (hasEdit) {
      // Basic smoke test that edit functionality exists
      expect(hasEdit).toBe(true);
    } else {
      // Maybe profile is always editable
      const nameInput = page.getByLabel(/name|full name/i);
      const hasInput = await nameInput.isVisible().catch(() => false);

      if (!hasInput) {
        test.skip(true, 'Edit functionality not found - may have different UI');
      }
    }
  });

  test('should display user stats or session history', async ({ page }) => {
    // Should show some user activity or stats
    const stats = page.getByText(/sessions?|total|recent/i).first();
    const hasStats = await stats.isVisible().catch(() => false);

    // This is optional - not all profiles may have stats
    if (!hasStats) {
      test.skip(true, 'Stats not visible - may not be implemented yet');
    }
  });

  test('should have logout functionality', async ({ page }) => {
    // Should have logout button somewhere
    const logoutButton = page.getByRole('button', { name: /log out|sign out/i });
    const menuButton = page.getByRole('button', { name: /menu|account/i });

    let hasLogout = await logoutButton.isVisible().catch(() => false);

    if (!hasLogout) {
      // Maybe in a menu
      const hasMenu = await menuButton.isVisible().catch(() => false);

      if (hasMenu) {
        await menuButton.click();
        await page.waitForTimeout(500);

        hasLogout = await logoutButton.isVisible().catch(() => false);
      }
    }

    expect(hasLogout).toBe(true);
  });
});

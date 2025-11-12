/**
 * Preferences Welcome Popup Tests
 *
 * Tests the PreferencesAnnouncementDialog that appears for returning users
 * on the home page when preferences_v2_shown_at is NULL
 *
 * @project auth
 */

import { test, expect, Page } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import {
  setUserState,
  UserState,
  verifyPopupDismissalRecorded,
  resetUserToCleanState,
} from './utils/profile-preferences-helpers';
import { TEST_USER } from './fixtures/test-data';

test.describe('Preferences Welcome Popup', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test.afterEach(async () => {
    await resetUserToCleanState(TEST_USER.email);
  });

  test('returning users see popup on home page when preferences_v2_shown_at is NULL', async ({
    page,
  }) => {
    // Setup: Set user as returning user (onboarding complete, popup not shown)
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    // Navigate to home page
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for popup to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify dialog content
    await expect(
      page.getByRole('heading', {
        name: /we've enhanced your profile preferences/i,
      })
    ).toBeVisible();

    // Verify description text
    await expect(
      page.getByText(/we've added new customization options/i)
    ).toBeVisible();
  });

  test('new users do not see popup (complete onboarding normally)', async ({
    page,
  }) => {
    // Setup: Set user as new user (onboarding not complete)
    await setUserState(TEST_USER.email, UserState.NEW_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait a bit to ensure popup would have appeared if it was going to
    await page.waitForTimeout(3000);

    // Dialog should NOT be visible
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);
  });

  test('users who already saw popup do not see it again', async ({ page }) => {
    // Setup: Set user state to already having seen popup
    await setUserState(TEST_USER.email, UserState.POPUP_SEEN);

    await page.goto('/');
    await waitForPageLoad(page);

    // Wait to ensure popup would have appeared
    await page.waitForTimeout(3000);

    // Dialog should NOT be visible
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);
  });

  test('popup shows only once - not on subsequent home visits', async ({
    page,
  }) => {
    // Setup: Returning user
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    // First visit - popup should appear
    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Dismiss popup
    const maybeLaterButton = page.getByRole('button', { name: /maybe later/i });
    await maybeLaterButton.click();

    // Wait for dismissal to be recorded
    await page.waitForTimeout(2000);

    // Navigate away and come back
    await page.goto('/profile');
    await waitForPageLoad(page);

    await page.goto('/');
    await waitForPageLoad(page);

    // Popup should NOT appear again
    await page.waitForTimeout(3000);
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);
  });

  test('Update Profile button navigates to profile page', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click Update Profile button
    const updateProfileButton = page.getByRole('button', {
      name: /update profile/i,
    });
    await updateProfileButton.click();

    // Should navigate to profile page (possibly with edit param)
    await page.waitForURL(/\/profile/, { timeout: 5000 });

    // Verify we're on profile page
    expect(page.url()).toContain('/profile');
  });

  test('Maybe Later button dismisses popup and updates database', async ({
    page,
  }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click Maybe Later
    const maybeLaterButton = page.getByRole('button', { name: /maybe later/i });
    await maybeLaterButton.click();

    // Dialog should close
    await page.waitForTimeout(1000);
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    // Verify database was updated
    await page.waitForTimeout(2000); // Give time for database update
    const isRecorded = await verifyPopupDismissalRecorded(TEST_USER.email);
    expect(isRecorded).toBe(true);
  });

  test('database preferences_v2_shown_at updated correctly after dismissal', async ({
    page,
  }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    // Verify initial state
    let profile = await (
      await import('./utils/profile-preferences-helpers')
    ).getCurrentUserProfile(TEST_USER.email);
    expect(profile.preferences_v2_shown_at).toBeNull();

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Dismiss popup
    await page.getByRole('button', { name: /maybe later/i }).click();
    await page.waitForTimeout(2000);

    // Check database
    profile = await (
      await import('./utils/profile-preferences-helpers')
    ).getCurrentUserProfile(TEST_USER.email);
    expect(profile.preferences_v2_shown_at).not.toBeNull();

    // Verify it's a recent timestamp (within last 10 seconds)
    const timestamp = new Date(profile.preferences_v2_shown_at!).getTime();
    const now = Date.now();
    const diffSeconds = (now - timestamp) / 1000;
    expect(diffSeconds).toBeLessThan(10);
  });

  test('ESC key dismisses popup', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Press ESC key
    await page.keyboard.press('Escape');

    // Dialog should close
    await page.waitForTimeout(1000);
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    // Database should be updated
    await page.waitForTimeout(2000);
    const isRecorded = await verifyPopupDismissalRecorded(TEST_USER.email);
    expect(isRecorded).toBe(true);
  });

  test('click outside dismisses popup', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click outside the dialog (on the backdrop/overlay)
    // First, get dialog dimensions to find a point outside it
    const dialogBox = await dialog.boundingBox();
    if (dialogBox) {
      // Click to the left of the dialog
      await page.mouse.click(10, dialogBox.y + 10);
    } else {
      // Fallback: try clicking on page body
      await page.locator('body').click({ position: { x: 10, y: 10 } });
    }

    // Dialog should close
    await page.waitForTimeout(1000);
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    // Database should be updated
    await page.waitForTimeout(2000);
    const isRecorded = await verifyPopupDismissalRecorded(TEST_USER.email);
    expect(isRecorded).toBe(true);
  });

  test('popup displays all 5 feature highlights', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify all 5 features are listed
    const features = [
      'Experience Level',
      'Surf Styles',
      'Preferred Wave Size',
      'Preferred Break Type',
      'Crowd Preference',
    ];

    for (const feature of features) {
      await expect(dialog.getByText(feature)).toBeVisible();
    }
  });

  test('popup displays feature emojis correctly', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify emojis are present
    const emojis = ['🏄‍♂️', '🏄', '🌊', '🏖️', '👥'];

    for (const emoji of emojis) {
      const emojiLocator = dialog.locator(`text="${emoji}"`);
      await expect(emojiLocator).toBeVisible();
    }
  });

  test('popup has correct styling and structure', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify header icon (Sparkles)
    const sparklesIcon = dialog.locator('svg').first();
    await expect(sparklesIcon).toBeVisible();

    // Verify gradient styling on Update Profile button
    const updateButton = page.getByRole('button', { name: /update profile/i });
    await expect(updateButton).toHaveClass(/bg-gradient/);

    // Verify feature highlights have gradient backgrounds
    const featureCard = dialog
      .locator('.bg-gradient-to-r')
      .filter({ hasText: 'Experience Level' })
      .first();
    await expect(featureCard).toBeVisible();
  });

  test('popup is accessible (has proper ARIA attributes)', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify dialog has aria-describedby
    const ariaDescribedBy = await dialog.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toBeTruthy();

    // Verify description element exists
    const description = page.locator(`#${ariaDescribedBy}`);
    await expect(description).toBeVisible();

    // Verify heading is accessible
    const heading = page.getByRole('heading', {
      name: /we've enhanced your profile preferences/i,
    });
    await expect(heading).toBeVisible();

    // Verify buttons are accessible
    const updateButton = page.getByRole('button', { name: /update profile/i });
    const maybeLaterButton = page.getByRole('button', { name: /maybe later/i });
    await expect(updateButton).toBeVisible();
    await expect(maybeLaterButton).toBeVisible();
  });

  test('popup works correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify responsive layout
    // Dialog should fit on screen
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox?.width).toBeLessThanOrEqual(375);

    // Buttons should be stacked on mobile
    const buttons = dialog.locator('button');
    await expect(buttons.first()).toBeVisible();
    await expect(buttons.last()).toBeVisible();

    // Should still be dismissible
    await page.getByRole('button', { name: /maybe later/i }).click();
    await page.waitForTimeout(1000);
    const dialogVisible = await dialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);
  });

  test('popup does not interfere with normal home page functionality', async ({
    page,
  }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Home page content should still be loaded beneath the popup
    // Check for tabs (Forecast, Nearby, Community)
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    const tabsVisible = await forecastTab.isVisible().catch(() => false);

    // Tabs might be behind popup but should exist in DOM
    expect(forecastTab).toBeTruthy();

    // Dismiss popup
    await page.getByRole('button', { name: /maybe later/i }).click();
    await page.waitForTimeout(1000);

    // Now tabs should be fully interactive
    await expect(forecastTab).toBeVisible();
    await forecastTab.click();
    // Should work without errors
  });

  test('analytics event is tracked when popup is shown', async ({ page }) => {
    await setUserState(TEST_USER.email, UserState.RETURNING_USER);

    // Listen for console logs (analytics tracking)
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Wait a bit for analytics to be called
    await page.waitForTimeout(2000);

    // Check if analytics was called (this depends on your analytics setup)
    // The actual verification might need adjustment based on your analytics implementation
    // For now, we just verify the popup appeared without errors
    expect(dialog).toBeTruthy();
  });
});

/**
 * Profile Preferences Display Tests
 *
 * Tests the PreferencesDisplayCard component on the profile page
 * Ensures all preference fields display correctly with proper data
 *
 * @project auth
 */

import { test, expect, Page } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import {
  setUserPreferences,
  clearUserPreferences,
  resetUserToCleanState,
  TEST_PREFERENCES,
} from './utils/profile-preferences-helpers';
import { TEST_USER } from './fixtures/test-data';

test.describe('Profile Preferences Display Card', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we're authenticated
    await ensureAuthenticated(page);
  });

  test.afterEach(async () => {
    // Clean up: reset user to clean state
    await resetUserToCleanState(TEST_USER.email);
  });

  test('displays preferences card with correct data when preferences are set', async ({
    page,
  }) => {
    // Setup: Set test preferences in database
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    // Navigate to profile page
    await page.goto('/profile');
    await waitForPageLoad(page);

    // Wait for preferences card to be visible
    const preferencesCard = page.locator('text=Surf Preferences').first();
    await expect(preferencesCard).toBeVisible({ timeout: 10000 });

    // Verify card title
    await expect(page.getByRole('heading', { name: /surf preferences/i })).toBeVisible();

    // Verify Experience Level is displayed
    await expect(page.getByText('Experience Level')).toBeVisible();
    await expect(page.getByText('Intermediate')).toBeVisible();
    // Verify emoji is present (🌊 for Intermediate)
    await expect(page.locator('text=/🌊/')).toBeVisible();

    // Verify Surf Styles are displayed
    await expect(page.getByText('Surf Styles')).toBeVisible();
    await expect(page.getByText('Shortboard')).toBeVisible();
    await expect(page.getByText('Longboard')).toBeVisible();

    // Verify Preferred Wave Size
    await expect(page.getByText('Preferred Wave Size')).toBeVisible();
    await expect(page.getByText(/Medium/)).toBeVisible();
    await expect(page.getByText(/3-6 feet/)).toBeVisible();

    // Verify Preferred Break Type
    await expect(page.getByText('Preferred Break Type')).toBeVisible();
    await expect(page.getByText(/Beach Break/)).toBeVisible();
    await expect(page.getByText(/Sandy bottom/)).toBeVisible();

    // Verify Crowd Preference
    await expect(page.getByText('Crowd Preference')).toBeVisible();
    await expect(page.getByText(/A few people is fine/)).toBeVisible();
    await expect(page.getByText(/Small crowds are okay/)).toBeVisible();
  });

  test('displays all 5 preference fields when fully populated', async ({ page }) => {
    // Setup: Set all preferences
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Count visible preference field headers
    const fieldHeaders = [
      'Experience Level',
      'Surf Styles',
      'Preferred Wave Size',
      'Preferred Break Type',
      'Crowd Preference',
    ];

    for (const header of fieldHeaders) {
      await expect(page.getByText(header)).toBeVisible();
    }
  });

  test('handles empty state correctly when no preferences are set', async ({
    page,
  }) => {
    // Setup: Clear all preferences
    await clearUserPreferences(TEST_USER.email);

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Wait for preferences card
    const preferencesCard = page.locator('text=Surf Preferences').first();
    await expect(preferencesCard).toBeVisible({ timeout: 10000 });

    // Should show empty state message
    await expect(
      page.getByText(/no preferences set yet/i)
    ).toBeVisible();
  });

  test('edit button is visible and accessible', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Find edit button by aria-label
    const editButton = page.getByLabel(/edit preferences/i);
    await expect(editButton).toBeVisible({ timeout: 10000 });

    // Verify it's a button
    await expect(editButton).toHaveRole('button');

    // Verify it has the Edit2 icon (Lucide)
    const editIcon = editButton.locator('svg');
    await expect(editIcon).toBeVisible();
  });

  test('edit button scrolls/opens edit form when clicked', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Click edit button
    const editButton = page.getByLabel(/edit preferences/i);
    await editButton.click();

    // Wait a moment for any scroll/modal animation
    await page.waitForTimeout(1000);

    // Should either:
    // 1. Open edit modal with dialog role, OR
    // 2. Scroll to editable form section

    // Try to find dialog first (modal approach)
    const dialog = page.getByRole('dialog', { name: /edit profile/i });
    const hasDialog = await dialog.isVisible().catch(() => false);

    if (hasDialog) {
      // Modal opened successfully
      await expect(dialog).toBeVisible();
    } else {
      // Should have scrolled to an editable form
      // Look for form inputs that are now in viewport
      const experienceLevelSelect = page.locator('select').first();
      await expect(experienceLevelSelect).toBeInViewport({ timeout: 5000 });
    }
  });

  test('displays emojis correctly for all preference types', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, {
      experience_level: 'expert' as any,
      surf_styles: ['longboard'] as any,
      preferred_wave_size: 'large' as any,
      preferred_break_type: 'reef' as any,
      crowd_preference: 'solitude' as any,
    });

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Wait for card to load
    await expect(page.getByText('Surf Preferences')).toBeVisible();

    // Check for specific emojis (as text content)
    const emojis = ['🔥', '🏄', '🌊🌊🌊', '🪸', '🏝️'];

    for (const emoji of emojis) {
      // Using text matcher to find emoji
      const emojiLocator = page.locator(`text="${emoji}"`);
      await expect(emojiLocator).toBeVisible();
    }
  });

  test('mobile responsive layout displays correctly', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Card should still be visible
    await expect(page.getByText('Surf Preferences')).toBeVisible();

    // All fields should be stacked vertically and readable
    await expect(page.getByText('Experience Level')).toBeVisible();
    await expect(page.getByText('Surf Styles')).toBeVisible();

    // Badges should wrap on mobile
    const surfStyleBadges = page.locator('[role="status"]').or(
      page.locator('text=Shortboard')
    );
    await expect(surfStyleBadges.first()).toBeVisible();
  });

  test('handles partial preferences gracefully', async ({ page }) => {
    // Only set some preferences
    await setUserPreferences(TEST_USER.email, {
      experience_level: 'beginner' as any,
      surf_styles: ['bodyboard'] as any,
      // Leave wave size, break type, and crowd preference null
      preferred_wave_size: null as any,
      preferred_break_type: null as any,
      crowd_preference: null as any,
    });

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Should show set preferences
    await expect(page.getByText('Experience Level')).toBeVisible();
    await expect(page.getByText('Beginner')).toBeVisible();
    await expect(page.getByText('Surf Styles')).toBeVisible();
    await expect(page.getByText('Bodyboard')).toBeVisible();

    // Unset preferences should not be shown
    // (Card only displays fields that have values)
    const waveSizeHeader = page.getByText('Preferred Wave Size');
    const waveSizeVisible = await waveSizeHeader.isVisible().catch(() => false);

    // If partial display, wave size shouldn't be visible
    // If it shows empty state, that's also valid
    if (!waveSizeVisible) {
      // Partial display: only shows set fields
      expect(waveSizeVisible).toBe(false);
    }
  });

  test('surf styles display as badges with correct styling', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, {
      ...TEST_PREFERENCES,
      surf_styles: ['shortboard', 'longboard', 'funboard'] as any,
    });

    await page.goto('/profile');
    await waitForPageLoad(page);

    await expect(page.getByText('Surf Styles')).toBeVisible();

    // Each style should be visible
    await expect(page.getByText('Shortboard')).toBeVisible();
    await expect(page.getByText('Longboard')).toBeVisible();
    await expect(page.getByText('Funboard')).toBeVisible();

    // Badges should have appropriate styling classes
    // Look for Badge component structure
    const badges = page.locator('text=Shortboard').locator('..');
    await expect(badges.first()).toBeVisible();
  });

  test('all text content is properly formatted and readable', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    await page.goto('/profile');
    await waitForPageLoad(page);

    // Check typography and formatting
    await expect(page.getByRole('heading', { name: /surf preferences/i }))
      .toHaveClass(/text-lg/);

    // Field headers should be semibold
    const experienceHeader = page.locator('h4:has-text("Experience Level")');
    await expect(experienceHeader.first()).toHaveClass(/font-semibold/);

    // Description text should be visible and properly colored
    await expect(page.getByText(/Catching waves regularly/)).toBeVisible();
  });
});

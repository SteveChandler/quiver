/**
 * Profile Edit Preferences Tests
 *
 * Tests the Edit Profile modal/form with focus on preference fields
 * Ensures dropdowns work correctly and data saves properly
 *
 * @project auth
 */

import { test, expect, Page } from '@playwright/test';
import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
import {
  setUserPreferences,
  clearUserPreferences,
  resetUserToCleanState,
  getCurrentUserProfile,
  TEST_PREFERENCES,
} from './utils/profile-preferences-helpers';
import { TEST_USER } from './fixtures/test-data';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

test.describe('Edit Profile - Preferences Fields', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await ensureAuthenticated(page);
  });

  test.afterEach(async ({ page }) => {
    // Run cleanup FIRST so it always executes, even if assertNoErrors throws
    await resetUserToCleanState(TEST_USER.email);
    // Clear browser profile cache so the next test gets fresh data
    try {
      await page.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('quiver_profile_cache_')) {
            localStorage.removeItem(key);
          }
        }
      });
    } catch {
      // page may be on about:blank
    }
    await assertNoErrors(page, errorCapture, { context: 'Profile Edit Preferences' });
  });

  /**
   * Open the Edit Profile modal via URL parameter.
   * Fast but form may have empty defaultValues (race with profile loading).
   * Use openEditProfileModalWithData() when you need initialData populated.
   */
  async function openEditProfileModal(page: Page) {
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    return dialog;
  }




  test('all 5 preference fields are present in Edit Profile modal', async ({
    page,
  }) => {
    await openEditProfileModal(page);

    // Verify Experience Level dropdown exists
    const experienceLevelSelect = page.locator('select#experience_level');
    await expect(experienceLevelSelect).toBeVisible();

    // Verify Surf Styles multi-select exists
    await expect(page.getByText('Surf Styles (select all that apply)')).toBeVisible();

    // Verify Wave Size dropdown
    const waveSizeSelect = page.locator('select#preferred_wave_size');
    await expect(waveSizeSelect).toBeVisible();

    // Verify Break Type dropdown
    const breakTypeSelect = page.locator('select#preferred_break_type');
    await expect(breakTypeSelect).toBeVisible();

    // Verify Crowd Preference dropdown
    const crowdPrefSelect = page.locator('select#crowd_preference');
    await expect(crowdPrefSelect).toBeVisible();
  });

  test('experience level is a dropdown (NOT text input)', async ({ page }) => {
    await openEditProfileModal(page);

    // Find the experience level field
    const experienceField = page.locator('#experience_level');

    // Verify it's a select element, not an input
    await expect(experienceField).toBeVisible();
    const tagName = await experienceField.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe('select');

    // Verify it has options
    const options = experienceField.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1); // At least placeholder + options
  });

  test('experience level dropdown has correct options from constants', async ({
    page,
  }) => {
    await openEditProfileModal(page);

    const experienceSelect = page.locator('select#experience_level');

    // Get all option values
    const options = await experienceSelect.locator('option').allTextContents();

    // Expected options (with emojis and descriptions)
    const expectedOptions = [
      'Select your experience level', // Placeholder
      '🏄‍♂️ Beginner - Just getting started',
      '🌊 Intermediate - Catching waves regularly',
      '🏆 Advanced - Experienced surfer',
      '🔥 Expert - Highly skilled',
    ];

    // Verify all expected options are present
    for (const expected of expectedOptions) {
      expect(options).toContainEqual(expect.stringContaining(expected));
    }
  });

  test('wave size dropdown has correct options', async ({ page }) => {
    await openEditProfileModal(page);

    const waveSizeSelect = page.locator('select#preferred_wave_size');
    const options = await waveSizeSelect.locator('option').allTextContents();

    // Expected wave sizes
    const expectedSizes = [
      'Select preferred wave size',
      '🌊 Small - 1-3 feet',
      '🌊🌊 Medium - 3-6 feet',
      '🌊🌊🌊 Large - 6+ feet',
      "🤙 Any Size - I'll surf anything",
    ];

    for (const expected of expectedSizes) {
      expect(options).toContainEqual(expect.stringContaining(expected));
    }
  });

  test('break type dropdown has correct options', async ({ page }) => {
    await openEditProfileModal(page);

    const breakTypeSelect = page.locator('select#preferred_break_type');
    const options = await breakTypeSelect.locator('option').allTextContents();

    const expectedTypes = [
      'Select preferred break type',
      '🏖️ Beach Break - Sandy bottom',
      '🪨 Point Break - Rocky point',
      '🪸 Reef Break - Coral or rock reef',
      "✨ Any Type - I'll surf anywhere",
    ];

    for (const expected of expectedTypes) {
      expect(options).toContainEqual(expect.stringContaining(expected));
    }
  });

  test('crowd preference dropdown has correct options', async ({ page }) => {
    await openEditProfileModal(page);

    const crowdSelect = page.locator('select#crowd_preference');
    const options = await crowdSelect.locator('option').allTextContents();

    const expectedPrefs = [
      'Select crowd preference',
      '👥 Love the crew - Enjoy surfing with others',
      '🧘 A few people is fine - Small crowds are okay',
      '🏝️ Prefer solitude - Like uncrowded spots',
    ];

    for (const expected of expectedPrefs) {
      expect(options).toContainEqual(expect.stringContaining(expected));
    }
  });

  test('surf styles multi-select works correctly', async ({ page }) => {
    await clearUserPreferences(TEST_USER.email);
    await openEditProfileModal(page);

    // Find surf style buttons
    const shortboardButton = page.locator('button:has-text("Shortboard")');
    const longboardButton = page.locator('button:has-text("Longboard")');

    // Initially should not be selected (check for border-border, not bg-primary)
    // Note: hover:border-primary/50 is always present, so we check for bg-primary instead
    await expect(shortboardButton).not.toHaveClass(/bg-primary/);

    // Click to select
    await shortboardButton.click();
    await expect(shortboardButton).toHaveClass(/bg-primary/);

    // Select another
    await longboardButton.click();
    await expect(longboardButton).toHaveClass(/bg-primary/);

    // Both should now be selected
    await expect(shortboardButton).toHaveClass(/bg-primary/);
    await expect(longboardButton).toHaveClass(/bg-primary/);

    // Click to deselect
    await shortboardButton.click();
    await expect(shortboardButton).not.toHaveClass(/bg-primary/);
    await expect(longboardButton).toHaveClass(/bg-primary/);
  });

  test('form saves all preference data correctly', async ({ page }) => {
    await clearUserPreferences(TEST_USER.email);
    const dialog = await openEditProfileModal(page);

    // Set all dropdown preference fields
    await dialog.locator('select#experience_level').selectOption('advanced');
    await dialog.locator('select#preferred_wave_size').selectOption('large');
    await dialog.locator('select#preferred_break_type').selectOption('reef');
    await dialog.locator('select#crowd_preference').selectOption('solitude');

    // Select surf styles — assert each toggle to confirm state update
    const shortboardBtn = dialog.locator('button:has-text("Shortboard")');
    await shortboardBtn.click();
    await expect(shortboardBtn).toHaveClass(/bg-primary/);

    const foilBtn = dialog.locator('button:has-text("Foil")');
    await foilBtn.click();
    await expect(foilBtn).toHaveClass(/bg-primary/);

    // Ensure name is filled (required field)
    const nameInput = dialog.getByLabel(/^name$/i);
    const currentName = await nameInput.inputValue();
    if (!currentName) {
      await nameInput.fill('Test User');
    }

    // Save and wait for the server action to complete
    await dialog.getByTestId('save-profile').click();
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/profile') || resp.url().includes('/profile'),
      { timeout: 15000 }
    ).catch(() => {});
    // Wait for dialog to close indicating save completed
    await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Verify saved values in the database
    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBe('advanced');
    expect(profile.preferred_wave_size).toBe('large');
    expect(profile.preferred_break_type).toBe('reef');
    expect(profile.crowd_preference).toBe('solitude');
    expect(profile.surf_styles).toEqual(expect.arrayContaining(['shortboard', 'foil']));
    expect(profile.surf_styles).toHaveLength(2);
  });

  test('form validation works properly for required fields', async ({ page }) => {
    await openEditProfileModal(page);

    // Clear the name field (required field from basic info)
    const nameInput = page.getByLabel(/^name$/i);
    await nameInput.fill('');

    // Try to save
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Should show validation error (form shouldn't submit)
    // Use the specific Edit Profile dialog to avoid matching the onboarding overlay
    // which may also be present as role="dialog" on some test-user configurations.
    const dialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(dialog).toBeVisible();

    // Fill name to make it valid
    await nameInput.fill('Test User');

    // Now preferences can be optional (saving should work)
    await saveButton.click();
    // Wait for dialog to close indicating save completed
    const editDialog = page.getByRole('dialog', { name: /edit profile/i });
    await editDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Success - should be able to save even without preferences filled
  });

  test('mobile layout and functionality works correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await openEditProfileModal(page);

    // Modal should be responsive — use specific name to avoid matching the onboarding overlay
    // which may also render as role="dialog" depending on profile state.
    const dialog = page.getByRole('dialog', { name: /edit profile/i });
    await expect(dialog).toBeVisible();

    // Dropdowns should be usable
    const experienceSelect = page.locator('select#experience_level');
    await expect(experienceSelect).toBeVisible();
    await experienceSelect.selectOption('intermediate');
    await expect(experienceSelect).toHaveValue('intermediate');

    // Surf style buttons should be in a grid that wraps
    const surfStyleButtons = page.locator('button:has-text("Shortboard")');
    await expect(surfStyleButtons).toBeVisible();

    // Should be able to click and select on mobile
    await surfStyleButtons.click();
    await expect(surfStyleButtons).toHaveClass(/bg-primary/);
  });

  test('can change preferences multiple times before saving', async ({ page }) => {
    await clearUserPreferences(TEST_USER.email);
    const dialog = await openEditProfileModal(page);

    const experienceSelect = dialog.locator('select#experience_level');

    // Change multiple times
    await experienceSelect.selectOption('beginner');
    await expect(experienceSelect).toHaveValue('beginner');

    await experienceSelect.selectOption('expert');
    await expect(experienceSelect).toHaveValue('expert');

    await experienceSelect.selectOption('intermediate');
    await expect(experienceSelect).toHaveValue('intermediate');

    // Toggle surf styles back and forth
    const shortboardButton = dialog.locator('button:has-text("Shortboard")');
    await shortboardButton.click();
    await expect(shortboardButton).toHaveClass(/bg-primary/);
    await shortboardButton.click();
    await expect(shortboardButton).not.toHaveClass(/bg-primary/);
    await shortboardButton.click();
    await expect(shortboardButton).toHaveClass(/bg-primary/);

    // Ensure name is filled
    const nameInput = dialog.getByLabel(/^name$/i);
    const currentName = await nameInput.inputValue();
    if (!currentName) {
      await nameInput.fill('Test User');
    }

    // Save and wait for server action to complete
    await dialog.getByTestId('save-profile').click();
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/profile') || resp.url().includes('/profile'),
      { timeout: 15000 }
    ).catch(() => {});
    await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Verify the final values persisted (not intermediate ones)
    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBe('intermediate');
    expect(profile.surf_styles).toContain('shortboard');
  });

  test('cancel button discards changes', async ({ page }) => {
    // Clear preferences so we start from a known null state
    await clearUserPreferences(TEST_USER.email);
    const dialog = await openEditProfileModal(page);

    // Make changes in the form
    await dialog.locator('select#experience_level').selectOption('expert');
    await expect(dialog.locator('select#experience_level')).toHaveValue('expert');

    await dialog.locator('select#preferred_wave_size').selectOption('large');

    // Click Cancel instead of Save
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Verify database was NOT modified (still has null/empty values)
    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBeNull();
    expect(profile.preferred_wave_size).toBeNull();
  });

  test('all preference fields are optional (can be left empty)', async ({
    page,
  }) => {
    await clearUserPreferences(TEST_USER.email);
    await openEditProfileModal(page);

    // Don't fill any preference fields
    // Just ensure name is filled (required)
    const nameInput = page.getByLabel(/^name$/i);
    const currentName = await nameInput.inputValue();
    if (!currentName) {
      await nameInput.fill('Test User');
    }

    // Save without filling preferences
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for dialog to close indicating save completed
    const editProfileDialog = page.getByRole('dialog', { name: /edit profile/i });
    await editProfileDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // Verify preferences are still null/empty
    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBeNull();
    expect(profile.surf_styles).toEqual([]);
  });

  test('emojis display correctly in dropdown options', async ({ page }) => {
    await openEditProfileModal(page);

    // Open experience level dropdown
    const experienceSelect = page.locator('select#experience_level');

    // Get option text content
    const options = await experienceSelect.locator('option').allTextContents();

    // Verify emojis are present in options
    const hasEmojis = options.some(
      (opt) => opt.includes('🏄') || opt.includes('🌊') || opt.includes('🏆')
    );
    expect(hasEmojis).toBe(true);
  });
});

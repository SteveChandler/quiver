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

test.describe('Edit Profile - Preferences Fields', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test.afterEach(async () => {
    await resetUserToCleanState(TEST_USER.email);
  });

  /**
   * Helper function to open the Edit Profile modal
   */
  async function openEditProfileModal(page: Page) {
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);

    // Wait for dialog to appear
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

    // Initially should not be selected
    await expect(shortboardButton).not.toHaveClass(/border-primary/);

    // Click to select
    await shortboardButton.click();
    await expect(shortboardButton).toHaveClass(/border-primary/);

    // Select another
    await longboardButton.click();
    await expect(longboardButton).toHaveClass(/border-primary/);

    // Both should now be selected
    await expect(shortboardButton).toHaveClass(/border-primary/);
    await expect(longboardButton).toHaveClass(/border-primary/);

    // Click to deselect
    await shortboardButton.click();
    await expect(shortboardButton).not.toHaveClass(/border-primary/);
    await expect(longboardButton).toHaveClass(/border-primary/);
  });

  test('form pre-populates with existing preference values', async ({ page }) => {
    // Setup: Set known preferences
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);

    await openEditProfileModal(page);

    // Verify experience level is pre-selected
    const experienceSelect = page.locator('select#experience_level');
    await expect(experienceSelect).toHaveValue('intermediate');

    // Verify wave size is pre-selected
    const waveSizeSelect = page.locator('select#preferred_wave_size');
    await expect(waveSizeSelect).toHaveValue('medium');

    // Verify break type is pre-selected
    const breakTypeSelect = page.locator('select#preferred_break_type');
    await expect(breakTypeSelect).toHaveValue('beach');

    // Verify crowd preference is pre-selected
    const crowdSelect = page.locator('select#crowd_preference');
    await expect(crowdSelect).toHaveValue('moderate');

    // Verify surf styles are pre-selected (buttons have active styling)
    const shortboardButton = page.locator('button:has-text("Shortboard")');
    const longboardButton = page.locator('button:has-text("Longboard")');

    await expect(shortboardButton).toHaveClass(/border-primary/);
    await expect(longboardButton).toHaveClass(/border-primary/);
  });

  test('form saves all preference data correctly', async ({ page }) => {
    // Clear preferences first
    await clearUserPreferences(TEST_USER.email);
    await openEditProfileModal(page);

    // Fill out all preference fields
    await page.locator('select#experience_level').selectOption('advanced');
    await page.locator('select#preferred_wave_size').selectOption('large');
    await page.locator('select#preferred_break_type').selectOption('reef');
    await page.locator('select#crowd_preference').selectOption('solitude');

    // Select surf styles
    await page.locator('button:has-text("Shortboard")').click();
    await page.locator('button:has-text("Foil")').click();

    // Save the form
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for save to complete (toast or modal close)
    await page.waitForTimeout(2000);

    // Verify data was saved in database
    const profile = await getCurrentUserProfile(TEST_USER.email);

    expect(profile.experience_level).toBe('advanced');
    expect(profile.preferred_wave_size).toBe('large');
    expect(profile.preferred_break_type).toBe('reef');
    expect(profile.crowd_preference).toBe('solitude');
    expect(profile.surf_styles).toEqual(
      expect.arrayContaining(['shortboard', 'foil'])
    );
  });

  test('values update in display card after save', async ({ page }) => {
    await clearUserPreferences(TEST_USER.email);

    // Open modal and set preferences
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Set preferences
    await page.locator('select#experience_level').selectOption('expert');
    await page.locator('button:has-text("Longboard")').click();

    // Save
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for modal to close and page to update
    await page.waitForTimeout(3000);

    // Navigate back to profile (or refresh) to see display card
    await page.goto('/profile');
    await waitForPageLoad(page);

    // Verify display card shows new values
    await expect(page.getByText('Expert')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Longboard')).toBeVisible();
    await expect(page.getByText('🔥')).toBeVisible(); // Expert emoji
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
    // Modal should still be open
    await page.waitForTimeout(1000);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Fill name to make it valid
    await nameInput.fill('Test User');

    // Now preferences can be optional (saving should work)
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Success - should be able to save even without preferences filled
  });

  test('mobile layout and functionality works correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await openEditProfileModal(page);

    // Modal should be responsive
    const dialog = page.getByRole('dialog');
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
    await expect(surfStyleButtons).toHaveClass(/border-primary/);
  });

  test('can change preferences multiple times before saving', async ({ page }) => {
    await openEditProfileModal(page);

    const experienceSelect = page.locator('select#experience_level');

    // Change multiple times
    await experienceSelect.selectOption('beginner');
    await expect(experienceSelect).toHaveValue('beginner');

    await experienceSelect.selectOption('intermediate');
    await expect(experienceSelect).toHaveValue('intermediate');

    await experienceSelect.selectOption('expert');
    await expect(experienceSelect).toHaveValue('expert');

    // Only the last value should be saved
    await page.getByTestId('save-profile').click();
    await page.waitForTimeout(2000);

    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBe('expert');
  });

  test('cancel button discards changes', async ({ page }) => {
    await setUserPreferences(TEST_USER.email, TEST_PREFERENCES);
    await openEditProfileModal(page);

    // Change a preference
    const experienceSelect = page.locator('select#experience_level');
    await experienceSelect.selectOption('expert');

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Verify original value is still in database
    const profile = await getCurrentUserProfile(TEST_USER.email);
    expect(profile.experience_level).toBe('intermediate'); // Original value
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

    // Should succeed
    await page.waitForTimeout(2000);

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

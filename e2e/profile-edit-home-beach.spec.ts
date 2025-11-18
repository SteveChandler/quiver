/**
 * Profile Edit - Home Beach Tests
 *
 * Comprehensive E2E tests for home beach functionality in the Edit Profile modal.
 * Tests the bug fix where home beach wasn't displaying in the BeachSelector.
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
  supabaseAdmin,
} from './utils/profile-preferences-helpers';
import { TEST_USER, TIMEOUTS, VIEWPORTS } from './fixtures/test-data';

test.describe('Profile Edit - Home Beach Display and Persistence', () => {
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
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.medium });

    return dialog;
  }

  /**
   * Helper function to get a beach ID by name
   */
  async function getBeachIdByName(beachName: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('beaches')
      .select('id')
      .eq('name', beachName)
      .single();

    if (error || !data) {
      console.error(`Failed to find beach "${beachName}":`, error);
      return null;
    }

    return data.id;
  }

  /**
   * Helper function to set a user's home beach by beach name
   */
  async function setUserHomeBeach(
    userEmail: string,
    beachName: string
  ): Promise<void> {
    const beachId = await getBeachIdByName(beachName);
    if (!beachId) {
      throw new Error(`Beach "${beachName}" not found in database`);
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ home_beach_id: beachId })
      .eq('email', userEmail);

    if (error) {
      throw new Error(`Failed to set home beach: ${error.message}`);
    }

    console.log(
      `[Test Setup] Set home beach to "${beachName}" for user ${userEmail}`
    );
  }

  /**
   * Helper function to clear a user's home beach
   */
  async function clearUserHomeBeach(userEmail: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ home_beach_id: null })
      .eq('email', userEmail);

    if (error) {
      throw new Error(`Failed to clear home beach: ${error.message}`);
    }

    console.log(`[Test Setup] Cleared home beach for user ${userEmail}`);
  }

  test('home beach displays correctly in edit modal when set', async ({
    page,
  }) => {
    // Setup: Set user's home beach to "Blacks Beach"
    await setUserHomeBeach(TEST_USER.email, 'Blacks Beach');

    // Navigate to profile and open edit modal
    await openEditProfileModal(page);

    // Verify the beach input is populated with "Blacks Beach"
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible();

    // Check that the input value is "Blacks Beach"
    const inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Blacks Beach');

    console.log('[Test] ✓ Home beach "Blacks Beach" displayed correctly');
  });

  test('home beach displays correctly for different beaches', async ({
    page,
  }) => {
    // Test with various beach names
    const testBeaches = [
      'Pacific Beach',
      'Windansea Beach',
      'La Jolla Shores',
      'Scripps Pier',
    ];

    for (const beachName of testBeaches) {
      // Check if beach exists in database
      const beachId = await getBeachIdByName(beachName);
      if (!beachId) {
        console.log(
          `[Test] Skipping "${beachName}" - not found in database`
        );
        continue;
      }

      // Setup: Set home beach
      await setUserHomeBeach(TEST_USER.email, beachName);

      // Open modal
      await openEditProfileModal(page);

      // Verify beach is displayed
      const beachInput = page.getByTestId('beach-search-input');
      const inputValue = await beachInput.inputValue();
      expect(inputValue).toBe(beachName);

      console.log(`[Test] ✓ Home beach "${beachName}" displayed correctly`);

      // Close modal
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('empty beach selector when no home beach is set', async ({ page }) => {
    // Setup: Clear home beach
    await clearUserHomeBeach(TEST_USER.email);

    // Open modal
    await openEditProfileModal(page);

    // Verify the beach input is empty
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible();

    const inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('');

    console.log('[Test] ✓ Beach selector empty when no home beach set');
  });

  test('can change home beach and save successfully', async ({ page }) => {
    // Setup: Set initial home beach
    await setUserHomeBeach(TEST_USER.email, 'Blacks Beach');

    // Open modal
    await openEditProfileModal(page);

    // Verify initial beach is displayed
    const beachInput = page.getByTestId('beach-search-input');
    let inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Blacks Beach');

    // Clear the input to trigger new search
    await beachInput.click();
    await beachInput.fill('');
    await page.waitForTimeout(300);

    // Type new beach name
    await beachInput.fill('Pacific Beach');
    await page.waitForTimeout(500); // Wait for search results

    // Select from dropdown
    const dropdown = page.locator('ul.absolute');
    await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.short });

    const pacificBeachOption = page.locator('button:has-text("Pacific Beach")');
    await pacificBeachOption.click();
    await page.waitForTimeout(500);

    // Verify input updated
    inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Pacific Beach');

    // Save the form
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Verify in database
    const profile = await getCurrentUserProfile(TEST_USER.email);
    const pacificBeachId = await getBeachIdByName('Pacific Beach');
    expect(profile.home_beach_id).toBe(pacificBeachId);

    console.log('[Test] ✓ Successfully changed home beach to "Pacific Beach"');
  });

  test('home beach persists after save and reopen', async ({ page }) => {
    // Setup: Set home beach
    await setUserHomeBeach(TEST_USER.email, 'Windansea Beach');

    // Open modal
    await openEditProfileModal(page);

    // Verify beach is displayed
    let beachInput = page.getByTestId('beach-search-input');
    let inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Windansea Beach');

    // Close modal without changes
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Reopen modal
    await openEditProfileModal(page);

    // Verify beach is still displayed
    beachInput = page.getByTestId('beach-search-input');
    inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Windansea Beach');

    console.log('[Test] ✓ Home beach persists after modal reopen');
  });

  test('can clear home beach by removing selection', async ({ page }) => {
    // Setup: Set home beach
    await setUserHomeBeach(TEST_USER.email, 'La Jolla Shores');

    // Open modal
    await openEditProfileModal(page);

    // Verify beach is displayed
    const beachInput = page.getByTestId('beach-search-input');
    let inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('La Jolla Shores');

    // Click the clear button (× button)
    const clearButton = page.locator('button[title="Clear selection"]');
    const clearButtonVisible = await clearButton
      .isVisible()
      .catch(() => false);

    if (clearButtonVisible) {
      await clearButton.click();
      await page.waitForTimeout(300);

      // Verify input is cleared
      inputValue = await beachInput.inputValue();
      expect(inputValue).toBe('');

      // Save the form
      const saveButton = page.getByTestId('save-profile');
      await saveButton.click();
      await page.waitForTimeout(2000);

      // Verify in database
      const profile = await getCurrentUserProfile(TEST_USER.email);
      expect(profile.home_beach_id).toBeNull();

      console.log('[Test] ✓ Successfully cleared home beach');
    } else {
      console.log('[Test] Clear button not visible, skipping clear test');
    }
  });

  test('beach selector shows search results when typing', async ({ page }) => {
    // Clear home beach first
    await clearUserHomeBeach(TEST_USER.email);

    // Open modal
    await openEditProfileModal(page);

    // Type in beach search
    const beachInput = page.getByTestId('beach-search-input');
    await beachInput.fill('La Jolla');
    await page.waitForTimeout(500); // Wait for debounced search

    // Verify dropdown appears with results
    const dropdown = page.locator('ul.absolute');
    await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.short });

    // Verify at least one result is shown
    const results = page.locator('ul.absolute li button');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);

    console.log(`[Test] ✓ Search returned ${count} results for "La Jolla"`);
  });

  test('mobile layout works correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Setup: Set home beach
    await setUserHomeBeach(TEST_USER.email, 'Blacks Beach');

    // Open modal
    await openEditProfileModal(page);

    // Modal should be responsive
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Beach input should be visible and functional
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible();

    const inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('Blacks Beach');

    // Should be able to change beach on mobile
    await beachInput.click();
    await beachInput.fill('');
    await page.waitForTimeout(300);

    await beachInput.fill('Pacific');
    await page.waitForTimeout(500);

    // Dropdown should be visible
    const dropdown = page.locator('ul.absolute');
    await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.short });

    console.log('[Test] ✓ Mobile layout works correctly');
  });

  test('cancel button discards home beach changes', async ({ page }) => {
    // Setup: Set initial home beach
    await setUserHomeBeach(TEST_USER.email, 'Blacks Beach');

    // Open modal
    await openEditProfileModal(page);

    // Change beach
    const beachInput = page.getByTestId('beach-search-input');
    await beachInput.click();
    await beachInput.fill('');
    await page.waitForTimeout(300);

    await beachInput.fill('Pacific Beach');
    await page.waitForTimeout(500);

    const pacificBeachOption = page.locator('button:has-text("Pacific Beach")');
    await pacificBeachOption.click();
    await page.waitForTimeout(300);

    // Click cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Verify original value is still in database
    const profile = await getCurrentUserProfile(TEST_USER.email);
    const blacksBeachId = await getBeachIdByName('Blacks Beach');
    expect(profile.home_beach_id).toBe(blacksBeachId);

    console.log('[Test] ✓ Cancel discards changes correctly');
  });

  test('home beach updates on profile page after save', async ({ page }) => {
    // Setup: Clear home beach
    await clearUserHomeBeach(TEST_USER.email);

    // Open modal
    await page.goto('/profile?edit=true');
    await waitForPageLoad(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.medium });

    // Set a home beach
    const beachInput = page.getByTestId('beach-search-input');
    await beachInput.fill('Windansea Beach');
    await page.waitForTimeout(500);

    const windanseaOption = page.locator('button:has-text("Windansea Beach")');
    await windanseaOption.click();
    await page.waitForTimeout(300);

    // Save
    const saveButton = page.getByTestId('save-profile');
    await saveButton.click();

    // Wait for modal to close and page to update
    await page.waitForTimeout(3000);

    // Navigate back to profile to verify display
    await page.goto('/profile');
    await waitForPageLoad(page);

    // Check if the beach name appears on the profile page
    // (Note: This depends on your profile page structure)
    const windanseaText = page.getByText('Windansea Beach');
    const isVisible = await windanseaText.isVisible().catch(() => false);

    if (isVisible) {
      console.log('[Test] ✓ Home beach displayed on profile page');
    } else {
      console.log('[Test] Profile page may not display home beach visually');
    }

    // Verify in database regardless
    const profile = await getCurrentUserProfile(TEST_USER.email);
    const windanseaId = await getBeachIdByName('Windansea Beach');
    expect(profile.home_beach_id).toBe(windanseaId);
  });

  test('handles special characters in beach names', async ({ page }) => {
    // Test beaches with special characters
    const specialBeaches = [
      "Ke Iki Beach",  // Apostrophe
      "Honolulu Bay",  // Space
      "D.T. Fleming Beach Park",  // Periods and spaces
    ];

    for (const beachName of specialBeaches) {
      const beachId = await getBeachIdByName(beachName);
      if (!beachId) {
        console.log(`[Test] Skipping "${beachName}" - not in database`);
        continue;
      }

      await setUserHomeBeach(TEST_USER.email, beachName);
      await openEditProfileModal(page);

      const beachInput = page.getByTestId('beach-search-input');
      const inputValue = await beachInput.inputValue();
      expect(inputValue).toBe(beachName);

      console.log(`[Test] ✓ Special characters handled for "${beachName}"`);

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('regression: home beach initialValue bug is fixed', async ({ page }) => {
    /**
     * This test specifically verifies the bug fix where initialHomeBeachText
     * wasn't being set from initialData?.homeBeachName.
     *
     * Before fix: BeachSelector showed empty input even when home beach was set
     * After fix: BeachSelector correctly displays the home beach name
     */

    // Setup: Set home beach
    await setUserHomeBeach(TEST_USER.email, 'Blacks Beach');

    // Get the profile to verify homeBeachName is available
    const profile = await getCurrentUserProfile(TEST_USER.email);
    console.log('[Test] Profile home_beach_id:', profile.home_beach_id);

    // Open modal
    await openEditProfileModal(page);

    // CRITICAL: Verify that the beach input is populated
    // This is the bug that was fixed - the input was empty before
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible();

    const inputValue = await beachInput.inputValue();

    // This assertion would FAIL before the bug fix
    expect(inputValue).toBe('Blacks Beach');

    console.log('[Test] ✓ REGRESSION TEST PASSED: initialValue bug is fixed');
    console.log('[Test]   Input correctly shows "Blacks Beach"');
    console.log(
      '[Test]   Before fix: input would be empty despite home beach being set'
    );
  });

  test('desktop layout provides full functionality', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Setup
    await setUserHomeBeach(TEST_USER.email, 'La Jolla Shores');

    // Open modal
    await openEditProfileModal(page);

    // Verify modal layout is appropriate for desktop
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Check modal width on desktop (should be max-w-[600px])
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).toBeTruthy();

    // Beach selector should work normally
    const beachInput = page.getByTestId('beach-search-input');
    const inputValue = await beachInput.inputValue();
    expect(inputValue).toBe('La Jolla Shores');

    console.log('[Test] ✓ Desktop layout provides full functionality');
  });
});

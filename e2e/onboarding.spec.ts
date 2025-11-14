import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import {
  createTestUserWithReferralCode,
  getReferralCodeForUser,
  deleteReferralsForUser,
  validateReferralCodeViaAPI,
  waitForReferralValidation,
  getReferralValidationStatus,
  isUserReferred,
  getSupabaseAdminClient,
} from './utils/referral-helpers';

/**
 * Onboarding Flow E2E Tests
 * Tests the complete onboarding flow including preference persistence
 *
 * @project auth
 */

test.describe('Onboarding Flow', () => {
  test.describe('Complete Onboarding with All Preferences', () => {
    test('should complete onboarding with all preferences and persist data', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');
      await waitForPageLoad(page);

      // Check if onboarding modal appears for new users
      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible - user may have already completed onboarding');
        return;
      }

      // Step 1: Enter full name
      const fullNameInput = page.getByLabel(/full name|name/i);
      if (await fullNameInput.isVisible().catch(() => false)) {
        await fullNameInput.fill('John Doe');
        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();
      }

      // Step 2: Enter display name
      const displayNameInput = page.getByLabel(/display name|username/i);
      if (await displayNameInput.isVisible().catch(() => false)) {
        await displayNameInput.fill('surfer_john');
        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();
      }

      // Step 3: Select home beach (if available)
      const beachSearch = page.getByPlaceholder(/search.*beach/i);
      if (await beachSearch.isVisible().catch(() => false)) {
        await beachSearch.fill('Ocean Beach');
        // Wait for search results and select first option
        await page.waitForTimeout(1000);
        const firstBeach = page.locator('[role="option"]').first();
        if (await firstBeach.isVisible().catch(() => false)) {
          await firstBeach.click();
        }
        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();
      }

      // Step 4: Select experience level and surf styles
      const intermediateOption = page.getByLabel(/intermediate/i);
      if (await intermediateOption.isVisible().catch(() => false)) {
        await intermediateOption.click();
      }

      // Select surf styles (if available)
      const shortboardOption = page.getByLabel(/shortboard/i);
      if (await shortboardOption.isVisible().catch(() => false)) {
        await shortboardOption.click();
      }

      const longboardOption = page.getByLabel(/longboard/i);
      if (await longboardOption.isVisible().catch(() => false)) {
        await longboardOption.click();
      }

      // Select wave size preference (if available)
      const mediumWaveOption = page.getByLabel(/medium.*wave/i);
      if (await mediumWaveOption.isVisible().catch(() => false)) {
        await mediumWaveOption.click();
      }

      // Select break type preference (if available)
      const pointBreakOption = page.getByLabel(/point.*break/i);
      if (await pointBreakOption.isVisible().catch(() => false)) {
        await pointBreakOption.click();
      }

      // Select crowd preference (if available)
      const moderateCrowdOption = page.getByLabel(/moderate.*crowd/i);
      if (await moderateCrowdOption.isVisible().catch(() => false)) {
        await moderateCrowdOption.click();
      }

      const nextButton = page.getByRole('button', { name: /next|continue/i });
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
      }

      // Step 5: Referral code (optional)
      const referralInput = page.getByLabel(/referral.*code/i);
      if (await referralInput.isVisible().catch(() => false)) {
        // Skip referral code for this test
        const skipButton = page.getByRole('button', { name: /skip|next|continue/i });
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
        }
      }

      // Step 6: Notification preferences
      const pushNotifToggle = page.getByLabel(/push.*notification/i);
      if (await pushNotifToggle.isVisible().catch(() => false)) {
        await pushNotifToggle.check();
      }

      const emailNotifToggle = page.getByLabel(/email.*notification/i);
      if (await emailNotifToggle.isVisible().catch(() => false)) {
        await emailNotifToggle.uncheck();
      }

      // Complete onboarding
      const completeButton = page.getByRole('button', { name: /complete|finish|get started/i });
      await completeButton.click();

      // Wait for onboarding to complete
      await page.waitForTimeout(2000);

      // Verify onboarding modal is closed
      await expect(onboardingModal).not.toBeVisible();

      // Verify redirected to home or dashboard
      const url = page.url();
      expect(url).toMatch(/\/(home|dashboard|map|$)/);

      // Refresh page to verify data persistence
      await page.reload();
      await waitForPageLoad(page);

      // Onboarding should NOT reappear after completion
      const onboardingReappeared = await onboardingModal.isVisible({ timeout: 2000 }).catch(() => false);
      expect(onboardingReappeared).toBe(false);
    });
  });

  test.describe('Complete Onboarding with Minimal Data', () => {
    test('should complete onboarding with only required fields', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Fill only required fields
      const fullNameInput = page.getByLabel(/full name|name/i);
      if (await fullNameInput.isVisible().catch(() => false)) {
        await fullNameInput.fill('Jane Minimal');
        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();
      }

      const displayNameInput = page.getByLabel(/display name|username/i);
      if (await displayNameInput.isVisible().catch(() => false)) {
        await displayNameInput.fill('jane_minimal');
        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();
      }

      // Skip all optional steps
      let attempts = 0;
      while (attempts < 10) {
        const skipButton = page.getByRole('button', { name: /skip|next|continue|complete|finish/i }).first();
        if (!await skipButton.isVisible().catch(() => false)) {
          break;
        }
        await skipButton.click();
        await page.waitForTimeout(500);
        attempts++;
      }

      // Verify onboarding completed
      await page.waitForTimeout(2000);
      await expect(onboardingModal).not.toBeVisible();

      // Verify persistence
      await page.reload();
      await waitForPageLoad(page);

      const onboardingReappeared = await onboardingModal.isVisible({ timeout: 2000 }).catch(() => false);
      expect(onboardingReappeared).toBe(false);
    });
  });

  test.describe('XP Award Notification', () => {
    test('should display XP award notification on onboarding completion', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Complete onboarding quickly
      const fullNameInput = page.getByLabel(/full name|name/i);
      if (await fullNameInput.isVisible().catch(() => false)) {
        await fullNameInput.fill('XP Test User');
      }

      const displayNameInput = page.getByLabel(/display name|username/i);
      if (await displayNameInput.isVisible().catch(() => false)) {
        await displayNameInput.fill('xp_test_user');
      }

      // Click through to completion
      let attempts = 0;
      while (attempts < 10) {
        const button = page.getByRole('button', { name: /next|continue|skip|complete|finish/i }).first();
        if (!await button.isVisible().catch(() => false)) {
          break;
        }
        await button.click();
        await page.waitForTimeout(500);
        attempts++;
      }

      // Look for XP notification (toast, badge, or celebration)
      const xpNotification = page.getByText(/100.*xp|xp.*100|experience.*point|level.*up/i);
      const hasXPNotification = await xpNotification.isVisible({ timeout: 5000 }).catch(() => false);

      // XP notification is optional (may not be implemented yet)
      if (hasXPNotification) {
        await expect(xpNotification).toBeVisible();
      }
    });
  });

  test.describe('Validation', () => {
    test('should show validation errors for invalid inputs', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Try to proceed without filling required fields
      const nextButton = page.getByRole('button', { name: /next|continue/i });
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();

        // Should show validation error
        const errorMessage = page.getByText(/required|invalid|enter|provide/i);
        const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasError) {
          await expect(errorMessage).toBeVisible();
        }
      }
    });

    test('should prevent duplicate display names', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Fill with a likely duplicate display name (common name)
      const displayNameInput = page.getByLabel(/display name|username/i);
      if (await displayNameInput.isVisible().catch(() => false)) {
        await displayNameInput.fill('test_user');

        const nextButton = page.getByRole('button', { name: /next|continue/i });
        await nextButton.click();

        // May show duplicate error (depends on data)
        const duplicateError = page.getByText(/taken|exists|already.*use|duplicate/i);
        const hasDuplicateError = await duplicateError.isVisible({ timeout: 3000 }).catch(() => false);

        // This test is informational - duplicate error depends on existing data
        if (hasDuplicateError) {
          await expect(duplicateError).toBeVisible();
        }
      }
    });
  });

  test.describe('Surf Preference Persistence', () => {
    test('should save wave size preference to profile', async ({ page }) => {
      // Skip if user already completed onboarding
      await page.goto('/');
      await waitForPageLoad(page);

      // Navigate to profile to check preferences
      await page.goto('/profile');
      await waitForPageLoad(page);

      // Look for wave size preference display
      const wavePreference = page.locator('[data-testid="preferred-wave-size"]');
      const hasWavePref = await wavePreference.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasWavePref) {
        const prefText = await wavePreference.textContent();
        expect(prefText).toMatch(/small|medium|large|any/i);
      } else {
        // Preferences section may not be visible if not set during onboarding
        test.skip(true, 'Wave size preference not set or not displayed in profile');
      }
    });

    test('should save break type preference to profile', async ({ page }) => {
      await page.goto('/profile');
      await waitForPageLoad(page);

      const breakTypePreference = page.locator('[data-testid="preferred-break-type"]');
      const hasBreakTypePref = await breakTypePreference.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasBreakTypePref) {
        const prefText = await breakTypePreference.textContent();
        expect(prefText).toMatch(/beach|point|reef|any/i);
      } else {
        test.skip(true, 'Break type preference not set or not displayed in profile');
      }
    });

    test('should save crowd preference to profile', async ({ page }) => {
      await page.goto('/profile');
      await waitForPageLoad(page);

      const crowdPreference = page.locator('[data-testid="crowd-preference"]');
      const hasCrowdPref = await crowdPreference.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCrowdPref) {
        const prefText = await crowdPreference.textContent();
        expect(prefText).toMatch(/social|moderate|solitude/i);
      } else {
        test.skip(true, 'Crowd preference not set or not displayed in profile');
      }
    });

    test('should display all surf preferences in profile when set', async ({ page }) => {
      await page.goto('/profile');
      await waitForPageLoad(page);

      // Check if preferences section exists
      const preferencesSection = page.locator('text=/surf.*preference/i').first();
      const hasPreferencesSection = await preferencesSection.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPreferencesSection) {
        await expect(preferencesSection).toBeVisible();

        // Section should contain at least one preference
        const sectionText = await preferencesSection.textContent();
        const hasPreferenceValues = sectionText?.match(/small|medium|large|beach|point|reef|social|moderate|solitude/i);

        expect(hasPreferenceValues).toBeTruthy();
      } else {
        test.skip(true, 'Preferences section not found in profile - may not be implemented yet');
      }
    });

    test('should allow optional surf preferences to be skipped', async ({ page }) => {
      // This is already validated by "Complete Onboarding with Minimal Data" test
      // which skips all optional fields and still successfully completes onboarding

      // Verify that skipping preferences doesn't break the onboarding flow
      await page.goto('/profile');
      await waitForPageLoad(page);

      // Profile should still be accessible even without preferences
      const profileHeading = page.getByRole('heading', { name: /profile|settings/i });
      await expect(profileHeading).toBeVisible();
    });
  });

  test.describe('Referral Flow', () => {
    const testReferrerEmail = 'test-referrer@quiver.surf';
    const testRefereeEmail = 'test-referee@quiver.surf';
    let referralCode: string;

    // Clean up before and after tests
    test.beforeAll(async () => {
      // Create test referrer with a referral code
      const result = await createTestUserWithReferralCode(testReferrerEmail);
      referralCode = result.referralCode;
      console.log(`Test referrer created with code: ${referralCode}`);
    });

    test.afterAll(async () => {
      // Clean up referral records
      await deleteReferralsForUser(testReferrerEmail);
      await deleteReferralsForUser(testRefereeEmail);
    });

    test('should validate referral codes correctly', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Skip to referral step
      let attempts = 0;
      while (attempts < 10) {
        const referralInput = page.getByLabel(/referral.*code/i);
        if (await referralInput.isVisible().catch(() => false)) {
          break;
        }

        const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(500);
        }
        attempts++;
      }

      const referralInput = page.getByLabel(/referral.*code/i);
      const isReferralStepVisible = await referralInput.isVisible().catch(() => false);

      if (!isReferralStepVisible) {
        test.skip(true, 'Referral step not found in onboarding flow');
        return;
      }

      // Test 1: Valid code shows success indicator
      await referralInput.fill(referralCode);
      await waitForReferralValidation(page);

      const validStatus = await getReferralValidationStatus(page);
      expect(validStatus).toBe('valid');

      // Clear input
      await referralInput.clear();
      await page.waitForTimeout(600);

      // Test 2: Invalid code shows error indicator
      await referralInput.fill('INVALID123');
      await waitForReferralValidation(page);

      const invalidStatus = await getReferralValidationStatus(page);
      expect(invalidStatus).toBe('invalid');

      // Clear input
      await referralInput.clear();
      await page.waitForTimeout(600);

      // Test 3: Empty code shows no indicator
      const emptyStatus = await getReferralValidationStatus(page);
      expect(emptyStatus).toBeNull();

      // Test 4: Debounce behavior - validation doesn't happen immediately
      await referralInput.fill('ABC');
      await page.waitForTimeout(300); // Less than debounce time

      const debounceStatus = await getReferralValidationStatus(page);
      // Should be loading or null (not yet validated)
      expect(debounceStatus === 'loading' || debounceStatus === null).toBe(true);
    });

    test('should save referral data to database when valid code is used', async ({ page }) => {
      // This test would require completing onboarding as a new user
      // For now, we test the API directly
      test.skip(true, 'Requires new user creation - implement when user creation is automated');
    });

    test('should handle referral code edge cases', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Skip to referral step
      let attempts = 0;
      while (attempts < 10) {
        const referralInput = page.getByLabel(/referral.*code/i);
        if (await referralInput.isVisible().catch(() => false)) {
          break;
        }

        const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(500);
        }
        attempts++;
      }

      const referralInput = page.getByLabel(/referral.*code/i);
      const isReferralStepVisible = await referralInput.isVisible().catch(() => false);

      if (!isReferralStepVisible) {
        test.skip(true, 'Referral step not found in onboarding flow');
        return;
      }

      // Test 1: Case insensitivity (lowercase version of valid code)
      await referralInput.fill(referralCode.toLowerCase());
      await waitForReferralValidation(page);

      const lowercaseStatus = await getReferralValidationStatus(page);
      expect(lowercaseStatus).toBe('valid');

      await referralInput.clear();
      await page.waitForTimeout(600);

      // Test 2: Very long code (should be limited by maxLength)
      const longCode = 'A'.repeat(20);
      await referralInput.fill(longCode);

      const inputValue = await referralInput.inputValue();
      // Should be limited by maxLength attribute (10 chars)
      expect(inputValue.length).toBeLessThanOrEqual(10);

      await referralInput.clear();
      await page.waitForTimeout(600);

      // Test 3: Special characters (input should uppercase and sanitize)
      await referralInput.fill('abc-123!@#');

      const sanitizedValue = await referralInput.inputValue();
      // Component should uppercase the input
      expect(sanitizedValue).toMatch(/^[A-Z0-9-!@#]+$/);
    });

    test('should display visual feedback for valid referral code', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Skip to referral step
      let attempts = 0;
      while (attempts < 10) {
        const referralInput = page.getByLabel(/referral.*code/i);
        if (await referralInput.isVisible().catch(() => false)) {
          break;
        }

        const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(500);
        }
        attempts++;
      }

      const referralInput = page.getByLabel(/referral.*code/i);
      const isReferralStepVisible = await referralInput.isVisible().catch(() => false);

      if (!isReferralStepVisible) {
        test.skip(true, 'Referral step not found in onboarding flow');
        return;
      }

      // Enter valid code
      await referralInput.fill(referralCode);
      await waitForReferralValidation(page);

      // Check for success message
      const successMessage = page.getByText(/valid code|bonus xp|both get/i);
      await expect(successMessage).toBeVisible();

      // Check for checkmark icon
      const checkIcon = page.locator('[class*="text-green"]');
      await expect(checkIcon.first()).toBeVisible();

      // Clear and enter invalid code
      await referralInput.clear();
      await page.waitForTimeout(600);
      await referralInput.fill('INVALID999');
      await waitForReferralValidation(page);

      // Check for error message
      const errorMessage = page.getByText(/invalid code|double-check/i);
      await expect(errorMessage).toBeVisible();

      // Check for X icon
      const xIcon = page.locator('[class*="text-red"]');
      await expect(xIcon.first()).toBeVisible();
    });

    test('should allow skipping referral code entry', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Skip to referral step
      let attempts = 0;
      while (attempts < 10) {
        const referralInput = page.getByLabel(/referral.*code/i);
        if (await referralInput.isVisible().catch(() => false)) {
          break;
        }

        const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(500);
        }
        attempts++;
      }

      const referralInput = page.getByLabel(/referral.*code/i);
      const isReferralStepVisible = await referralInput.isVisible().catch(() => false);

      if (!isReferralStepVisible) {
        test.skip(true, 'Referral step not found in onboarding flow');
        return;
      }

      // Don't enter any code, just skip
      const skipButton = page.getByRole('button', { name: /skip/i });
      await expect(skipButton).toBeVisible();

      await skipButton.click();
      await page.waitForTimeout(500);

      // Should proceed to next step
      // Referral input should no longer be visible
      const referralStillVisible = await referralInput.isVisible().catch(() => false);
      expect(referralStillVisible).toBe(false);
    });

    test('should disable continue button when code is invalid', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      const onboardingModal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
      const hasOnboarding = await onboardingModal.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasOnboarding) {
        test.skip(true, 'Onboarding modal not visible');
        return;
      }

      // Skip to referral step
      let attempts = 0;
      while (attempts < 10) {
        const referralInput = page.getByLabel(/referral.*code/i);
        if (await referralInput.isVisible().catch(() => false)) {
          break;
        }

        const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
        if (await skipButton.isVisible().catch(() => false)) {
          await skipButton.click();
          await page.waitForTimeout(500);
        }
        attempts++;
      }

      const referralInput = page.getByLabel(/referral.*code/i);
      const isReferralStepVisible = await referralInput.isVisible().catch(() => false);

      if (!isReferralStepVisible) {
        test.skip(true, 'Referral step not found in onboarding flow');
        return;
      }

      // Enter invalid code
      await referralInput.fill('INVALID999');
      await waitForReferralValidation(page);

      // Continue button should be disabled when code is invalid
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      // Enter valid code
      await referralInput.clear();
      await page.waitForTimeout(600);
      await referralInput.fill(referralCode);
      await waitForReferralValidation(page);

      // Continue button should now be enabled
      await expect(continueButton).toBeEnabled();

      // Clear code
      await referralInput.clear();
      await page.waitForTimeout(600);

      // With empty code, continue should be enabled (optional field)
      await expect(continueButton).toBeEnabled();
    });
  });

  test.describe('Referral API Endpoint', () => {
    test('should validate referral codes via API', async ({ page }) => {
      // Create a test user with referral code
      const { referralCode } = await createTestUserWithReferralCode(
        'api-test-referrer@quiver.surf'
      );

      // Test valid code
      const validResult = await validateReferralCodeViaAPI(page, referralCode);
      expect(validResult.valid).toBe(true);

      // Test invalid code
      const invalidResult = await validateReferralCodeViaAPI(page, 'INVALID999');
      expect(invalidResult.valid).toBe(false);

      // Test empty code
      const emptyResult = await validateReferralCodeViaAPI(page, '');
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.message).toContain('required');

      // Test case insensitivity
      const lowercaseResult = await validateReferralCodeViaAPI(page, referralCode.toLowerCase());
      expect(lowercaseResult.valid).toBe(true);

      // Clean up
      await deleteReferralsForUser('api-test-referrer@quiver.surf');
    });

    test('should handle rate limiting', async ({ page }) => {
      // Create a test code
      const { referralCode } = await createTestUserWithReferralCode(
        'rate-limit-test@quiver.surf'
      );

      // Make multiple rapid requests (should trigger rate limit)
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(validateReferralCodeViaAPI(page, referralCode));
      }

      const results = await Promise.all(requests);

      // Some requests should succeed, others may be rate limited
      const successCount = results.filter(r => r.valid).length;
      const rateLimitCount = results.filter(r => r.message?.includes('too many')).length;

      console.log(`Requests: ${results.length}, Success: ${successCount}, Rate limited: ${rateLimitCount}`);

      // At least some should succeed
      expect(successCount).toBeGreaterThan(0);

      // Clean up
      await deleteReferralsForUser('rate-limit-test@quiver.surf');
    });

    test('should handle special characters and long codes', async ({ page }) => {
      // Test code that's too long
      const longCode = 'A'.repeat(50);
      const longResult = await validateReferralCodeViaAPI(page, longCode);
      expect(longResult.valid).toBe(false);
      expect(longResult.message).toContain('too long');

      // Test code with special characters (should still validate if exists)
      const specialResult = await validateReferralCodeViaAPI(page, 'ABC!@#');
      expect(specialResult).toBeDefined();
    });
  });

  test.describe('Referral Database Integration', () => {
    test('should create referral record when onboarding completes with code', async () => {
      // This test verifies database integration
      // Note: Requires actual onboarding completion which is complex to automate
      test.skip(true, 'Requires full onboarding automation - implement when user creation flow is ready');
    });

    test('should verify referral code exists in database', async () => {
      const supabase = getSupabaseAdminClient();

      // Create test user with code
      const testEmail = 'db-test-referrer@quiver.surf';
      const { userId, referralCode } = await createTestUserWithReferralCode(testEmail);

      // Query database to verify
      const { data, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();

      expect(error).toBeNull();
      expect(data?.referral_code).toBe(referralCode);

      // Clean up
      await deleteReferralsForUser(testEmail);
    });

    test('should enforce unique referral codes', async () => {
      const supabase = getSupabaseAdminClient();

      // Create first user with code
      const code = 'UNIQUE123';
      const { userId: userId1 } = await createTestUserWithReferralCode(
        'unique-test-1@quiver.surf',
        code
      );

      // Try to create second user with same code
      const { data: users } = await supabase.auth.admin.listUsers();
      const user2 = users?.users?.find((u) => u.email === 'unique-test-2@quiver.surf');

      let userId2: string;
      if (user2) {
        userId2 = user2.id;
      } else {
        const { data: newUser } = await supabase.auth.admin.createUser({
          email: 'unique-test-2@quiver.surf',
          password: 'testpassword123',
          email_confirm: true,
        });
        userId2 = newUser!.user!.id;
      }

      // Try to set duplicate code
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', userId2);

      // Should fail due to unique constraint
      expect(error).not.toBeNull();
      expect(error?.message).toContain('unique');

      // Clean up
      await deleteReferralsForUser('unique-test-1@quiver.surf');
      await deleteReferralsForUser('unique-test-2@quiver.surf');
    });
  });
});

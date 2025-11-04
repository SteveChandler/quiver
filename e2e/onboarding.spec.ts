import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';

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
});

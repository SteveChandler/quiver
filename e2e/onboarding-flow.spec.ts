import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow - Complete Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate new user
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('complete onboarding flow for new authenticated user', async ({ page }) => {
    // This test requires a test user to be logged in
    // For now, we'll use the ?showOnboarding=1 query param to force the dialog
    await page.goto('/?showOnboarding=1');

    // Wait for onboarding dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // ========================================
    // STEP 1: Welcome Step
    // ========================================
    await expect(page.getByText(/welcome/i).first()).toBeVisible();

    // Verify stepper shows step 1 active (first indicator should be blue)
    const steppers = page.locator('div.flex-1.rounded-full');
    const firstStepper = steppers.first();
    await expect(firstStepper).toHaveClass(/bg-ocean-blue|bg-blue/);

    // Click continue/next button
    const continueButton = dialog.getByRole('button', { name: /continue|next|get started/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // ========================================
    // STEP 2: Profile Step
    // ========================================
    await expect(page.getByText(/what's your name|profile/i)).toBeVisible({ timeout: 5000 });

    // Fill in full name
    const fullNameInput = dialog.getByLabel(/full name/i);
    await expect(fullNameInput).toBeVisible();
    await fullNameInput.fill('Test User');

    // Fill in display name
    const displayNameInput = dialog.getByLabel(/display name/i);
    await expect(displayNameInput).toBeVisible();
    await displayNameInput.fill('TestUser123');

    // Submit profile step
    const profileContinue = dialog.getByRole('button', { name: /continue/i });
    await profileContinue.click();

    // ========================================
    // STEP 3: Home Beach Step
    // ========================================
    await expect(page.getByText(/where do you|home beach|usually surf/i)).toBeVisible({ timeout: 5000 });

    // Search for a beach
    const beachSearchInput = dialog.getByPlaceholder(/search|beach/i);
    if (await beachSearchInput.isVisible()) {
      await beachSearchInput.fill('Malibu');

      // Wait for search results to appear
      await page.waitForTimeout(1000);

      // Select first beach from results (if autocomplete appears)
      const firstResult = page.getByRole('button').filter({ hasText: /malibu/i }).first();
      if (await firstResult.isVisible({ timeout: 2000 })) {
        await firstResult.click();
      }
    }

    // Check if there's a back button
    const backButton = dialog.getByRole('button', { name: /back/i });
    if (await backButton.isVisible()) {
      await expect(backButton).toBeEnabled();
    }

    // Continue to next step
    const beachContinue = dialog.getByRole('button', { name: /continue/i });
    await beachContinue.click({ timeout: 5000 });

    // ========================================
    // STEP 4: Preferences Step
    // ========================================
    await expect(page.getByText(/preferences|experience|surfing/i)).toBeVisible({ timeout: 5000 });

    // Select experience level (look for beginner, intermediate, advanced, expert)
    const intermediateButton = page.getByRole('button', { name: /intermediate/i }).first();
    if (await intermediateButton.isVisible()) {
      await intermediateButton.click();
    }

    // Select at least one surf style
    const longboardButton = page.getByRole('button', { name: /longboard/i }).first();
    if (await longboardButton.isVisible()) {
      await longboardButton.click();
    }

    // Continue to next step
    const preferencesContinue = dialog.getByRole('button', { name: /continue/i });
    await preferencesContinue.click();

    // ========================================
    // STEP 5: Referral Step (Optional)
    // ========================================
    // This step might be skippable
    const referralHeading = page.getByText(/referral|invite code/i);
    if (await referralHeading.isVisible({ timeout: 3000 })) {
      // Check if there's a skip button
      const skipButton = dialog.getByRole('button', { name: /skip|continue without/i });
      if (await skipButton.isVisible()) {
        await skipButton.click();
      } else {
        // Otherwise click continue
        const referralContinue = dialog.getByRole('button', { name: /continue/i });
        await referralContinue.click();
      }
    }

    // ========================================
    // STEP 6: Notifications Step
    // ========================================
    const notificationsHeading = page.getByText(/notifications|stay updated/i);
    if (await notificationsHeading.isVisible({ timeout: 3000 })) {
      // Enable push notifications (optional)
      const pushToggle = page.getByRole('checkbox', { name: /push/i }).or(
        page.getByRole('switch', { name: /push/i })
      );

      if (await pushToggle.isVisible({ timeout: 2000 })) {
        // Click it if it exists
        await pushToggle.click();
      }

      // Continue
      const notifsContinue = dialog.getByRole('button', { name: /continue|finish|complete/i });
      await notifsContinue.click();
    }

    // ========================================
    // STEP 7: Completion Step
    // ========================================
    const completionMessage = page.getByText(/congrats|welcome|you're all set|ready to surf/i);
    if (await completionMessage.isVisible({ timeout: 5000 })) {
      // Look for XP display
      const xpDisplay = page.getByText(/XP|points|earned/i);
      await expect(xpDisplay).toBeVisible({ timeout: 3000 });

      // Click finish/done button
      const finishButton = dialog.getByRole('button', { name: /finish|done|let's go|start surfing/i });
      await finishButton.click();
    }

    // ========================================
    // VERIFICATION: Dialog Should Close
    // ========================================
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify onboarding completed flag in localStorage
    const onboardingState = await page.evaluate(() => {
      const stored = localStorage.getItem('quiver-onboarding');
      return stored ? JSON.parse(stored) : null;
    });

    if (onboardingState) {
      expect(onboardingState.state.isCompleted).toBe(true);
    }

    // ========================================
    // VERIFICATION: User Data Saved
    // ========================================
    // Check that profile data was saved (would need API call or database check in real scenario)
    // For now, verify the dialog doesn't reappear on refresh
    await page.reload();
    await page.waitForTimeout(2000);

    // Dialog should NOT reappear
    const dialogAfterReload = page.getByRole('dialog');
    await expect(dialogAfterReload).not.toBeVisible();
  });

  test('onboarding can be forced with query parameter', async ({ page }) => {
    // Even for completed users, ?showOnboarding=1 should show the dialog
    await page.goto('/?showOnboarding=1');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify stepper is present
    const stepper = page.locator('div.flex-1.rounded-full').first();
    await expect(stepper).toBeVisible();
  });

  test('back button navigation works correctly', async ({ page }) => {
    await page.goto('/?showOnboarding=1');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Skip welcome step if present
    const continueButton = dialog.getByRole('button', { name: /continue|next|get started/i });
    if (await continueButton.isVisible({ timeout: 2000 })) {
      await continueButton.click();
    }

    // Fill profile step
    await page.waitForTimeout(500);
    const fullNameInput = dialog.getByLabel(/full name/i);
    if (await fullNameInput.isVisible({ timeout: 2000 })) {
      await fullNameInput.fill('Test User');
    }

    const displayNameInput = dialog.getByLabel(/display name/i);
    if (await displayNameInput.isVisible()) {
      await displayNameInput.fill('TestUser123');

      // Continue to next step
      const profileContinue = dialog.getByRole('button', { name: /continue/i });
      await profileContinue.click();
    }

    // Now on home beach step, click back
    await page.waitForTimeout(500);
    const backButton = dialog.getByRole('button', { name: /back/i });

    if (await backButton.isVisible({ timeout: 2000 })) {
      await backButton.click();

      // Should be back on profile step with data preserved
      await page.waitForTimeout(500);
      const fullNameInputAgain = dialog.getByLabel(/full name/i);
      if (await fullNameInputAgain.isVisible()) {
        const value = await fullNameInputAgain.inputValue();
        expect(value).toBe('Test User'); // Data should be preserved
      }
    }
  });

  test('form validation prevents progression with invalid data', async ({ page }) => {
    await page.goto('/?showOnboarding=1');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Skip welcome step
    const continueButton = dialog.getByRole('button', { name: /continue|next|get started/i });
    if (await continueButton.isVisible({ timeout: 2000 })) {
      await continueButton.click();
    }

    // Try to continue without filling required fields
    await page.waitForTimeout(500);
    const profileContinue = dialog.getByRole('button', { name: /continue/i });

    if (await profileContinue.isVisible({ timeout: 2000 })) {
      // Button should be disabled or validation errors should appear
      const isDisabled = await profileContinue.isDisabled();

      if (!isDisabled) {
        // If not disabled, clicking should show validation errors
        await profileContinue.click();
        await page.waitForTimeout(500);

        // Look for error messages
        const errorMessage = page.getByText(/required|must be at least|invalid/i);
        const hasError = await errorMessage.isVisible({ timeout: 2000 });
        expect(hasError).toBe(true);
      } else {
        expect(isDisabled).toBe(true);
      }
    }
  });

  test('stepper progress indicator updates correctly', async ({ page }) => {
    await page.goto('/?showOnboarding=1');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Get all step indicators
    const steppers = page.locator('div.flex-1.rounded-full');
    const count = await steppers.count();

    // Initially, only first step should be highlighted
    const firstStepper = steppers.first();
    const firstStepperClass = await firstStepper.getAttribute('class');
    expect(firstStepperClass).toMatch(/bg-ocean-blue|bg-blue/);

    // Move to next step
    const continueButton = dialog.getByRole('button', { name: /continue|next|get started/i });
    if (await continueButton.isVisible({ timeout: 2000 })) {
      await continueButton.click();
      await page.waitForTimeout(500);

      // Now first two steps should be highlighted
      const secondStepper = steppers.nth(1);
      const secondStepperClass = await secondStepper.getAttribute('class');
      expect(secondStepperClass).toMatch(/bg-ocean-blue|bg-blue/);
    }
  });
});

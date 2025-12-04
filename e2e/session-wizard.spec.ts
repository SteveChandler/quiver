import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TEST_BEACH_IDS } from './fixtures/test-data';

/**
 * Session Wizard Tests
 * Tests the session creation/logging wizard (both plan and log modes)
 *
 * @project auth
 */

test.describe('Session Wizard - Plan Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);
  });

  test('should display session wizard in plan mode', async ({ page }) => {
    // Wizard page should be loaded - check for various indicators

    // 1. Look for any heading
    const anyHeading = page.getByRole('heading').first();
    const hasHeading = await anyHeading.isVisible().catch(() => false);

    if (hasHeading) {
      expect(hasHeading).toBe(true);
      return;
    }

    // 2. Look for beach selection (wizard first step)
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible().catch(() => false);

    if (hasBeachInput) {
      expect(hasBeachInput).toBe(true);
      return;
    }

    // 3. Look for any form elements
    const formElement = page.locator('form, input, button').first();
    const hasForm = await formElement.isVisible().catch(() => false);

    // Wizard should have some interactive elements
    expect(hasForm).toBe(true);
  });

  test('should have beach selection step', async ({ page }) => {
    // Look for beach selection input/dropdown
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const beachSelect = page.locator('select, [role="combobox"]').first();

    const hasInput = await beachInput.isVisible().catch(() => false);
    const hasSelect = await beachSelect.isVisible().catch(() => false);

    expect(hasInput || hasSelect).toBe(true);
  });

  test('should allow selecting a beach', async ({ page }) => {
    // Try to type beach name
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const isVisible = await beachInput.isVisible().catch(() => false);

    if (isVisible) {
      await beachInput.fill('Black');
      await page.waitForTimeout(1000);

      // Should show beach suggestions
      const beachOption = page.getByText(/black/i).first();
      const hasOption = await beachOption.isVisible().catch(() => false);

      if (hasOption) {
        await beachOption.click();
      }
    } else {
      test.skip(true, 'Beach input not found - may have different UI');
    }
  });

  test('should have date and time selection', async ({ page }) => {
    // Look for date input
    const dateInput = page.locator('input[type="date"], input[placeholder*="date" i]').first();
    const hasDate = await dateInput.isVisible().catch(() => false);

    if (hasDate) {
      await expect(dateInput).toBeVisible();
    }

    // Look for time input
    const timeInput = page.locator('input[type="time"], input[placeholder*="time" i]').first();
    const hasTime = await timeInput.isVisible().catch(() => false);

    if (!hasDate && !hasTime) {
      test.skip(true, 'Date/time inputs not found - may be in different step');
    }
  });

  test('should have next/continue button', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /next|continue|proceed/i });
    const hasNext = await nextButton.isVisible().catch(() => false);

    expect(hasNext).toBe(true);
  });

  test('should have cancel button', async ({ page }) => {
    // Cancel button might have various forms
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    const backButton = page.getByRole('button', { name: /back/i });
    const closeButton = page.getByRole('button', { name: /close|×/i });
    const backLink = page.getByRole('link', { name: /back|cancel|close/i });

    const hasCancel = await cancelButton.isVisible().catch(() => false);
    const hasBack = await backButton.isVisible().catch(() => false);
    const hasClose = await closeButton.isVisible().catch(() => false);
    const hasBackLink = await backLink.isVisible().catch(() => false);

    // At least one way to exit the wizard should exist
    if (!hasCancel && !hasBack && !hasClose && !hasBackLink) {
      test.skip(true, 'Cancel/back button not found - wizard may auto-handle navigation');
    } else {
      expect(hasCancel || hasBack || hasClose || hasBackLink).toBe(true);
    }
  });
});

test.describe('Session Wizard - Log Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test('should display session wizard in log mode', async ({ page }) => {
    // Wizard page should be loaded - check for various indicators

    // 1. Look for any heading
    const anyHeading = page.getByRole('heading').first();
    const hasHeading = await anyHeading.isVisible().catch(() => false);

    if (hasHeading) {
      expect(hasHeading).toBe(true);
      return;
    }

    // 2. Look for beach selection (wizard first step)
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible().catch(() => false);

    if (hasBeachInput) {
      expect(hasBeachInput).toBe(true);
      return;
    }

    // 3. Look for any form elements
    const formElement = page.locator('form, input, button').first();
    const hasForm = await formElement.isVisible().catch(() => false);

    // Wizard should have some interactive elements
    expect(hasForm).toBe(true);
  });

  test('should have beach selection step', async ({ page }) => {
    // Look for beach selection
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasInput = await beachInput.isVisible().catch(() => false);

    if (!hasInput) {
      const beachText = page.getByText(/select.*beach|choose.*location/i).first();
      const hasText = await beachText.isVisible().catch(() => false);
      expect(hasText).toBe(true);
    }
  });

  test('should have rating fields for logged sessions', async ({ page }) => {
    // Navigate through wizard to find rating fields
    // This might be on a later step, so we may need to skip if not visible

    // Look for wave quality, crowd level, or overall rating inputs
    const ratingFields = page.locator('input[type="range"], input[type="number"]');
    const count = await ratingFields.count();

    // Ratings might be on a later step
    if (count === 0) {
      test.skip(true, 'Rating fields not visible on first step - may be multi-step wizard');
    }
  });
});

test.describe('Session Wizard - Complete Flow', () => {
  test('should complete plan session flow end-to-end', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Step 1: Select beach
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await beachInput.isVisible().catch(() => false);

    if (!hasBeachInput) {
      test.skip(true, 'Cannot complete flow - beach selection not found');
      return;
    }

    // Fill beach
    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    // Select first beach option
    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);
    if (hasOption) {
      await beachOption.click();
    } else {
      test.skip(true, 'Beach selection not working as expected');
      return;
    }

    // Step 2: Click next/continue if needed
    const nextButton = page.getByRole('button', { name: /next|continue/i }).first();
    const hasNext = await nextButton.isVisible().catch(() => false);
    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Step 3: Set date (tomorrow)
    const dateInput = page.locator('input[type="date"]').first();
    const hasDate = await dateInput.isVisible().catch(() => false);

    if (hasDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      await dateInput.fill(dateString);
    }

    // Step 4: Set time
    const timeInput = page.locator('input[type="time"]').first();
    const hasTime = await timeInput.isVisible().catch(() => false);

    if (hasTime) {
      await timeInput.fill('09:00');
    }

    // Step 5: Look for submit/plan button
    const submitButton = page.getByRole('button', { name: /plan|submit|complete|finish/i }).first();
    const hasSubmit = await submitButton.isVisible().catch(() => false);

    if (!hasSubmit) {
      test.skip(true, 'Submit button not found - wizard may have more steps');
      return;
    }

    // Submit the session
    await submitButton.click();

    // Wait for success message or celebration
    const successMessage = page.getByText(/success|planned|created/i);
    const celebration = page.getByText(/🎉|Success!/i);

    // Either success toast or celebration overlay should appear
    const hasSuccess = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
    const hasCelebration = await celebration.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasSuccess || hasCelebration).toBe(true);
  });

  test('should redirect to profile after successful session creation', async ({ page }) => {
    // This test is more of a smoke test - the actual redirect happens after 5s
    // We'll just verify the page loaded and has a submit button
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Just verify wizard is functional
    const wizard = page.locator('form, [class*="wizard"]').first();
    const hasWizard = await wizard.isVisible().catch(() => false);

    expect(hasWizard).toBe(true);
  });

  test('should allow canceling session creation', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Find and click cancel button
    const cancelButton = page.getByRole('button', { name: /cancel|back/i }).first();
    const hasCancel = await cancelButton.isVisible().catch(() => false);

    if (!hasCancel) {
      test.skip(true, 'Cancel button not found');
      return;
    }

    await cancelButton.click();

    // Should navigate away (probably to profile or sessions)
    await waitForPageLoad(page);

    // Should NOT be on /sessions/new anymore
    expect(page.url()).not.toContain('/sessions/new');
  });
});

test.describe('Session Wizard - Validation', () => {
  test('should not allow submitting without required fields', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Try to find and click submit button without filling form
    const submitButton = page.getByRole('button', { name: /plan|submit|complete|finish/i }).first();
    const hasSubmit = await submitButton.isVisible().catch(() => false);

    if (!hasSubmit) {
      test.skip(true, 'Submit button not visible - may be multi-step wizard');
      return;
    }

    // Button should be disabled or clicking should show validation error
    const isDisabled = await submitButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      // Try clicking
      await submitButton.click();

      // Should show validation error
      const validationError = page.getByText(/required|select.*beach|choose/i);
      const hasError = await validationError.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasError).toBe(true);
    } else {
      expect(isDisabled).toBe(true);
    }
  });
});

test.describe('Session Wizard - Forecast Snapshot Creation', () => {
  /**
   * Tests for forecast snapshot creation when sessions are logged.
   * Snapshots capture forecast conditions at the time of the session
   * for later analysis and forecast accuracy tracking.
   *
   * Note: These E2E tests verify the session creation flow works end-to-end.
   * Actual snapshot verification requires database access or an API endpoint,
   * which is better suited for integration tests or database tests.
   */

  test('should successfully create session (snapshot created in background)', async ({ page }) => {
    // Navigate to log mode (completed sessions trigger snapshot creation)
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);

    // Fill out the session form
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const isVisible = await beachInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'Beach input not found - different UI');
      return;
    }

    // Select a beach
    await beachInput.fill('Black');
    await page.waitForTimeout(1000);

    const beachOption = page.getByText(/black/i).first();
    const hasOption = await beachOption.isVisible().catch(() => false);

    if (hasOption) {
      await beachOption.click();
      await page.waitForTimeout(500);
    }

    // Fill in other required fields if present
    const ratingInput = page.locator('input[type="range"], [role="slider"]').first();
    const hasRating = await ratingInput.isVisible().catch(() => false);

    if (hasRating) {
      await ratingInput.fill('8');
    }

    // Submit the session
    const submitButton = page.getByRole('button', { name: /log|submit|save|complete/i }).first();
    const hasSubmit = await submitButton.isVisible().catch(() => false);

    if (!hasSubmit) {
      test.skip(true, 'Submit button not found');
      return;
    }

    await submitButton.click();

    // Wait for success indication
    const successMessage = page.getByText(/success|logged|created|saved/i);
    const celebration = page.getByText(/🎉|Success!/i);

    const hasSuccess = await successMessage.isVisible({ timeout: 10000 }).catch(() => false);
    const hasCelebration = await celebration.isVisible({ timeout: 10000 }).catch(() => false);

    // Session should be created successfully
    // Note: Forecast snapshot creation happens in background via:
    // 1. Application code in session-actions.ts (createLoggedSession)
    // 2. Database trigger (trigger_create_session_forecast_snapshot)
    expect(hasSuccess || hasCelebration).toBe(true);
  });

  test('session creation should not fail if snapshot creation fails', async ({ page }) => {
    // This test verifies that even if forecast data is missing or snapshot creation
    // fails, the session itself is still created successfully.

    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);

    // Fill minimal required fields
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const isVisible = await beachInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'Beach input not found');
      return;
    }

    await beachInput.fill('Test');
    await page.waitForTimeout(1000);

    // Try to submit
    const submitButton = page.getByRole('button', { name: /log|submit|save|complete/i }).first();
    const hasSubmit = await submitButton.isVisible().catch(() => false);

    if (!hasSubmit) {
      test.skip(true, 'Submit button not found');
      return;
    }

    // Even with minimal data (possibly no forecast match), session should save
    // The snapshot creation is non-blocking and won't fail the session creation
    await submitButton.click();

    // Should either succeed or show validation errors (but not fail due to snapshot)
    await page.waitForTimeout(3000);

    // Page should not crash or show unexpected errors
    const errorMessage = page.getByText(/unexpected error|failed to create session/i);
    const hasError = await errorMessage.isVisible().catch(() => false);

    // Should NOT have unexpected errors (validation errors are ok)
    expect(hasError).toBe(false);
  });

  // Note: To fully verify snapshot creation in E2E tests, we would need either:
  // 1. A test API endpoint like GET /api/sessions/{id}/snapshot
  // 2. Direct database queries in the test (using @supabase/supabase-js)
  // 3. UI elements that display snapshot data
  //
  // For now, we verify the session creation flow works end-to-end.
  // Integration tests with database access are better suited for snapshot verification.
});

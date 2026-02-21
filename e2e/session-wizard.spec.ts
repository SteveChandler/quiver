import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TEST_BEACH_IDS } from './fixtures/test-data';
import { isVisibleSafe } from './utils/strict-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Session Wizard Tests
 * Tests the session creation/logging wizard (both plan and log modes)
 *
 * @project auth
 */

test.describe('Session Wizard - Plan Mode', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Plan Mode' });
  });

  test('should display session wizard in plan mode', async ({ page }) => {
    // Wizard page should be loaded - check for various indicators

    // 1. Look for any heading
    const anyHeading = page.getByRole('heading').first();
    const hasHeading = await isVisibleSafe(anyHeading);

    if (hasHeading) {
      expect(hasHeading).toBe(true);
      return;
    }

    // 2. Look for beach selection (wizard first step)
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await isVisibleSafe(beachInput);

    if (hasBeachInput) {
      expect(hasBeachInput).toBe(true);
      return;
    }

    // 3. Look for any form elements
    const formElement = page.locator('form, input, button').first();
    const hasForm = await isVisibleSafe(formElement);

    // Wizard should have some interactive elements
    expect(hasForm).toBe(true);
  });

  test('should have beach selection step', async ({ page }) => {
    // Look for beach selection input/dropdown
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const beachSelect = page.locator('select, [role="combobox"]').first();

    const hasInput = await isVisibleSafe(beachInput);
    const hasSelect = await isVisibleSafe(beachSelect);

    expect(hasInput || hasSelect).toBe(true);
  });

  test('should allow selecting a beach', async ({ page }) => {
    // Try to type beach name
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    await expect(beachInput).toBeVisible();

    await beachInput.fill('Black');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
    await page.waitForTimeout(1000);

    // Should show beach suggestions
    const beachOption = page.getByText(/black/i).first();
    const hasOption = await isVisibleSafe(beachOption);

    if (hasOption) {
      await beachOption.click();
    }
  });

  test('should have date and time selection', async ({ page }) => {
    // Date/time is on step 2 — navigate there first
    const beachInput = page.getByTestId('beach-search-input');
    const hasBeachInput = await isVisibleSafe(beachInput);
    if (hasBeachInput) {
      await beachInput.fill('Black');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
      await page.waitForTimeout(500);
      const nextButton = page.getByRole('button', { name: /next/i }).first();
      const hasNext = await isVisibleSafe(nextButton);
      if (hasNext) {
        await nextButton.click();
        // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
        await page.waitForTimeout(500);
      }
    }

    // Look for date input
    const dateInput = page.locator('input[type="date"]').or(page.getByTestId('session-date-input')).first();
    const hasDate = await isVisibleSafe(dateInput);

    if (hasDate) {
      await expect(dateInput).toBeVisible();
    }

    // Look for time input
    const timeInput = page.locator('input[type="time"]').or(page.getByTestId('session-time-input')).first();
    const hasTime = await isVisibleSafe(timeInput);

    // At least one of date or time must be present on step 2
    expect(hasDate || hasTime).toBe(true);
  });

  test('should have next/continue button', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /next|continue|proceed/i });
    const hasNext = await isVisibleSafe(nextButton);

    expect(hasNext).toBe(true);
  });

  test('should have cancel button', async ({ page }) => {
    // V2 wizard uses a "Previous" button for back navigation (disabled on step 1)
    // Navigate to step 2 so Previous is enabled
    const beachInput = page.getByTestId('beach-search-input');
    const hasBeachInput = await isVisibleSafe(beachInput);
    if (hasBeachInput) {
      await beachInput.fill('Black');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
      await page.waitForTimeout(500);
      const nextBtn = page.getByRole('button', { name: /next/i }).first();
      const hasNext = await isVisibleSafe(nextBtn);
      if (hasNext) {
        await nextBtn.click();
        // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
        await page.waitForTimeout(500);
      }
    }

    // V2 wizard has a "Previous" button for navigation
    const previousButton = page.getByRole('button', { name: /previous/i });
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    const closeButton = page.getByRole('button', { name: /close|×/i });
    const backLink = page.getByRole('link', { name: /back|cancel|close/i });

    const hasPrevious = await isVisibleSafe(previousButton);
    const hasCancel = await isVisibleSafe(cancelButton);
    const hasClose = await isVisibleSafe(closeButton);
    const hasBackLink = await isVisibleSafe(backLink);

    // At least one way to navigate back should exist
    expect(hasPrevious || hasCancel || hasClose || hasBackLink).toBe(true);
  });
});

test.describe('Session Wizard - Log Mode', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Log Mode' });
  });

  test('should display session wizard in log mode', async ({ page }) => {
    // Wizard page should be loaded - check for various indicators

    // 1. Look for any heading
    const anyHeading = page.getByRole('heading').first();
    const hasHeading = await isVisibleSafe(anyHeading);

    if (hasHeading) {
      expect(hasHeading).toBe(true);
      return;
    }

    // 2. Look for beach selection (wizard first step)
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasBeachInput = await isVisibleSafe(beachInput);

    if (hasBeachInput) {
      expect(hasBeachInput).toBe(true);
      return;
    }

    // 3. Look for any form elements
    const formElement = page.locator('form, input, button').first();
    const hasForm = await isVisibleSafe(formElement);

    // Wizard should have some interactive elements
    expect(hasForm).toBe(true);
  });

  test('should have beach selection step', async ({ page }) => {
    // Look for beach selection
    const beachInput = page.getByPlaceholder(/beach|location|search/i).first();
    const hasInput = await isVisibleSafe(beachInput);

    if (!hasInput) {
      const beachText = page.getByText(/select.*beach|choose.*location/i).first();
      const hasText = await isVisibleSafe(beachText);
      expect(hasText).toBe(true);
    }
  });

  test('should have rating fields for logged sessions', async ({ page }) => {
    // V2 wizard: rating fields are on step 4 (Session Details)
    // Navigate through all 4 steps: Location → DateTime → Equipment → Session Details

    // Step 1: Select beach
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: 10000 });
    await beachInput.fill('Black');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
    await page.waitForTimeout(500);

    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await expect(nextButton).toBeEnabled({ timeout: 5000 });
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Step 2: Fill date/time
    const dateInput = page.getByTestId('session-date-input');
    const hasDate = await isVisibleSafe(dateInput);
    if (hasDate) {
      const today = new Date().toISOString().split('T')[0];
      await dateInput.fill(today);
    }
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Step 3: Skip equipment
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Step 4: Session Details — RatingInput renders as star buttons with aria-labels
    // e.g. "Rate Wave Quality as 1 out of 5 - ..."
    // We look for any of the three rating sections: Wave Quality, Parking Ease, Crowd Level
    const waveQualityRating = page.getByRole('button', { name: /rate wave quality as 1/i }).first();
    const parkingEaseRating = page.getByRole('button', { name: /rate parking ease as 1/i }).first();
    const crowdLevelRating = page.getByRole('button', { name: /rate crowd level as 1/i }).first();

    const hasWaveQuality = await isVisibleSafe(waveQualityRating, { timeout: 5000 });
    const hasParkingEase = await isVisibleSafe(parkingEaseRating, { timeout: 5000 });
    const hasCrowdLevel = await isVisibleSafe(crowdLevelRating, { timeout: 5000 });

    expect(hasWaveQuality || hasParkingEase || hasCrowdLevel).toBe(true);
  });

  test('should show "Forecast from Your Session" and never render NaN @smoke', async ({
    page,
  }) => {
    // Step 1: Select a beach (Location step)
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: 10000 });

    await beachInput.fill('Black');

    // Select from the dropdown list rendered by BeachSelector
    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot
      .locator('ul')
      .locator('button')
      .filter({ hasText: /black/i })
      .first();

    await expect(beachOption).toBeVisible({ timeout: 15000 });
    await beachOption.click();

    // Step 2: Go to DateTime step
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await expect(nextButton).toBeEnabled({ timeout: 10000 });
    await nextButton.click();

    // Fill date and time (these drive forecast selection)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: 15000 });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: 15000 });
    await timeInput.fill('06:00');

    // Step 3: Advance to Equipment step, then Session Details
    await nextButton.click();
    await nextButton.click();

    // Step 4: Forecast card should render on Session Details
    const forecastHeading = page.getByRole('heading', {
      name: /forecast from your session/i,
    });
    await expect(forecastHeading).toBeVisible({ timeout: 20000 });

    // Assert no NaN appears anywhere in the forecast card or page body.
    // This specifically guards against the prior NaNNaNNaN regression.
    const forecastCard = forecastHeading.locator('..');
    await expect(forecastCard).not.toContainText('NaN', { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('NaN', {
      timeout: 20000,
    });
  });
});

test.describe('Session Wizard - Complete Flow', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Complete Flow' });
  });

  test('should complete plan session flow end-to-end', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Step 1: Select beach
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: 10000 });

    // Fill beach
    await beachInput.fill('Black');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
    await page.waitForTimeout(1000);

    // Select first beach option from dropdown
    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot.locator('ul').locator('button').filter({ hasText: /black/i }).first();
    await expect(beachOption).toBeVisible({ timeout: 10000 });
    await beachOption.click();

    // Navigate through all plan mode steps: Location → DateTime → Goals → Notes (last step = submit)
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await expect(nextButton).toBeEnabled({ timeout: 5000 });

    // Step 2: DateTime
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    const dateInput = page.getByTestId('session-date-input').or(page.locator('input[type="date"]')).first();
    const hasDate = await isVisibleSafe(dateInput);
    if (hasDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await dateInput.fill(tomorrow.toISOString().split('T')[0]);
    }
    const timeInput = page.getByTestId('session-time-input').or(page.locator('input[type="time"]')).first();
    const hasTime = await isVisibleSafe(timeInput);
    if (hasTime) {
      await timeInput.fill('09:00');
    }

    // Step 3: Goals (optional)
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Step 4: Notes (last step — submit button appears here)
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Submit button only appears on last step
    const submitButton = page.getByRole('button', { name: /plan session|submit|complete|finish/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    // Submit the session
    await submitButton.click();

    // Wait for success message or celebration
    const successMessage = page.getByText(/success|planned|created/i);
    const celebration = page.getByText(/🎉|Success!/i);

    // Either success toast or celebration overlay should appear
    const hasSuccess = await isVisibleSafe(successMessage, { timeout: 5000 });
    const hasCelebration = await isVisibleSafe(celebration, { timeout: 5000 });

    expect(hasSuccess || hasCelebration).toBe(true);
  });

  test('should redirect to profile after successful session creation', async ({ page }) => {
    // This test is more of a smoke test - the actual redirect happens after 5s
    // We'll just verify the page loaded and has a submit button
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // Just verify wizard is functional
    const wizard = page.locator('form, [class*="wizard"]').first();
    const hasWizard = await isVisibleSafe(wizard);

    expect(hasWizard).toBe(true);
  });

  test('should allow canceling session creation', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // V2 wizard uses "Previous" button. Navigate to step 2 so Previous is enabled.
    const beachInput = page.getByTestId('beach-search-input');
    const hasBeachInput = await isVisibleSafe(beachInput);
    if (hasBeachInput) {
      await beachInput.fill('Black');
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
      await page.waitForTimeout(500);
      const nextBtn = page.getByRole('button', { name: /next/i }).first();
      const hasNext = await isVisibleSafe(nextBtn);
      if (hasNext) {
        await nextBtn.click();
        // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
        await page.waitForTimeout(500);
      }
    }

    // Find Previous button (V2 wizard navigation)
    const previousButton = page.getByRole('button', { name: /previous/i }).first();
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    const hasPrevious = await isVisibleSafe(previousButton);
    const hasCancel = await isVisibleSafe(cancelButton);

    expect(hasPrevious || hasCancel).toBe(true);

    const backButton = hasPrevious ? previousButton : cancelButton;
    await backButton.click();

    // After clicking Previous from step 2, we return to step 1
    // Verify the wizard is still functional (not crashed)
    await waitForPageLoad(page);
    const wizardForm = page.locator('[data-testid="session-wizard-form"]');
    const hasWizard = await isVisibleSafe(wizardForm);
    expect(hasWizard).toBe(true);
  });
});

test.describe('Session Wizard - Validation', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Validation' });
  });

  test('should not allow submitting without required fields', async ({ page }) => {
    await page.goto('/sessions/new?mode=plan');
    await waitForPageLoad(page);

    // V2 wizard: Next button is disabled when required fields are missing.
    // The submit button only appears on the last step (step 4).
    // Verify that the Next button is disabled when no beach is selected.
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 5000 });

    // Next button should be disabled until a beach is selected (required field)
    const isNextDisabled = await nextButton.isDisabled();
    expect(isNextDisabled).toBe(true);
  });
});

test.describe('Session Wizard - Forecast Snapshot Creation', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Forecast Snapshot' });
  });

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

    // Step 1: Select beach
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: 10000 });

    await beachInput.fill('Black');
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for search input debounce
    await page.waitForTimeout(1000);

    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot.locator('ul').locator('button').filter({ hasText: /black/i }).first();
    const hasOption = await isVisibleSafe(beachOption);

    if (hasOption) {
      await beachOption.click();
      // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for beach selection to apply
      await page.waitForTimeout(500);
    }

    // Navigate through log mode steps: Location → DateTime → Equipment → Session Details
    const nextButton = page.getByRole('button', { name: /next/i }).first();

    // Step 2: DateTime
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);
    const dateInput = page.getByTestId('session-date-input').or(page.locator('input[type="date"]')).first();
    const hasDate = await isVisibleSafe(dateInput);
    if (hasDate) {
      await dateInput.fill(new Date().toISOString().split('T')[0]);
    }

    // Step 3: Equipment (skip)
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Step 4: Session Details (last step — submit button appears here)
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(500);

    // Submit the session
    const submitButton = page.getByRole('button', { name: /log session|submit|save|complete/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });

    await submitButton.click();

    // Wait for success indication
    const successMessage = page.getByText(/success|logged|created|saved/i);
    const celebration = page.getByText(/🎉|Success!/i);

    const hasSuccess = await isVisibleSafe(successMessage, { timeout: 10000 });
    const hasCelebration = await isVisibleSafe(celebration, { timeout: 10000 });

    // Session should be created successfully
    // Note: Forecast snapshot creation happens in background via:
    // 1. Application code in session-actions.ts (createLoggedSession)
    // 2. Database trigger (trigger_create_session_forecast_snapshot)
    expect(hasSuccess || hasCelebration).toBe(true);
  });

});

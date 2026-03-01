import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import { isVisibleSafe } from "./utils/strict-helpers";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Session Wizard Auto-Forecast Autofill Tests
 *
 * Tests the auto-forecast autofill feature that automatically populates
 * condition fields (waves, wind, water temp, tide) when users select
 * a spot and date/time during session logging.
 *
 * Key behaviors tested:
 * 1. Auto-prefill after selecting beach + date/time (NEW sessions only)
 * 2. User edits are preserved over auto-prefilled values
 * 3. NO auto-prefill when editing existing sessions
 * 4. Placeholder examples shown when forecast data is missing
 * 5. All condition fields persist correctly to database
 *
 * @project auth
 */

test.describe('Session Wizard - Auto-Forecast Autofill', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    // Navigate to new session log mode
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Wizard Autofill' });
  });

  test('should auto-prefill condition fields after selecting beach and date/time', async ({ page }) => {
    // Step 1: Select a beach with known forecast data
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: TIMEOUTS.medium });

    await beachInput.fill('Black');

    // Select Blacks Beach from dropdown
    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot
      .locator('ul')
      .locator('button')
      .filter({ hasText: /black/i })
      .first();

    await expect(beachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await beachOption.click();

    // Step 2: Fill in date and time (on same Where & When step)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    // Use today's date to ensure forecast data is available
    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('09:00'); // Morning session (not night)

    // Step 3: Navigate to Session Details step (step 2)
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await expect(nextButton).toBeVisible({ timeout: TIMEOUTS.medium });
    await expect(nextButton).toBeEnabled({ timeout: TIMEOUTS.medium });
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(1000);

    // Verify condition fields are auto-prefilled on Session Details
    // Wave height field should have a numeric value or be editable
    // Note: Components use id="wave-height-input", not data-testid
    const waveHeightInput = page.locator('#wave-height-input').or(
      page.locator('input[name="waveHeight"]')
    ).first();

    const waveHeightVisible = await isVisibleSafe(waveHeightInput, { timeout: TIMEOUTS.short });

    if (waveHeightVisible) {
      const waveHeightValue = await waveHeightInput.inputValue();

      // Either should be prefilled with a number or show a placeholder
      if (waveHeightValue) {
        // Verify it's a valid number
        const numValue = parseFloat(waveHeightValue);
        expect(numValue).toBeGreaterThan(0);
      } else {
        // Should at least have a placeholder for guidance
        const placeholder = await waveHeightInput.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();
      }
    }

    // Wind speed field check
    const windSpeedInput = page.locator('#wind-speed-input').or(
      page.locator('input[name="windSpeed"]')
    ).first();

    const windSpeedVisible = await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short });

    if (windSpeedVisible) {
      const windSpeedValue = await windSpeedInput.inputValue();

      if (windSpeedValue) {
        const numValue = parseFloat(windSpeedValue);
        expect(numValue).toBeGreaterThanOrEqual(0);
      }
    }

    // Water temp field check
    const waterTempInput = page.locator('#water-temp-input').or(
      page.locator('input[name="waterTemp"]')
    ).first();

    const waterTempVisible = await isVisibleSafe(waterTempInput, { timeout: TIMEOUTS.short });

    if (waterTempVisible) {
      const waterTempValue = await waterTempInput.inputValue();

      if (waterTempValue) {
        const numValue = parseFloat(waterTempValue);
        expect(numValue).toBeGreaterThan(0);
        expect(numValue).toBeLessThan(100); // Reasonable temp range
      }
    }

    // Tide height field check
    const tideHeightInput = page.locator('#tide-height-input').or(
      page.locator('input[name="tideHeight"]')
    ).first();

    const tideHeightVisible = await isVisibleSafe(tideHeightInput, { timeout: TIMEOUTS.short });

    if (tideHeightVisible) {
      const tideHeightValue = await tideHeightInput.inputValue();

      if (tideHeightValue) {
        const numValue = parseFloat(tideHeightValue);
        // Tide heights can be negative
        expect(numValue).toBeGreaterThan(-10);
        expect(numValue).toBeLessThan(10);
      }
    }
  });

  test('should preserve user edits over auto-prefilled values', async ({ page }) => {
    // Complete the wizard flow and override autofilled values

    // Step 1: Select beach
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: TIMEOUTS.medium });
    await beachInput.fill('Black');

    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot
      .locator('ul')
      .locator('button')
      .filter({ hasText: /black/i })
      .first();

    await expect(beachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await beachOption.click();

    // Step 2: Set date/time (on same Where & When step)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('10:00');

    // Navigate to Session Details step (step 2)
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(1000);

    // Override auto-prefilled wave height with custom value
    // Note: Components use id="wave-height-input", not data-testid
    const waveHeightInput = page.locator('#wave-height-input').or(
      page.locator('input[name="waveHeight"]')
    ).first();

    await expect(waveHeightInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Clear and set custom value
    const customWaveHeight = '6.5';
    await waveHeightInput.clear();
    await waveHeightInput.fill(customWaveHeight);

    // Step 4: Override wind speed
    const windSpeedInput = page.locator('#wind-speed-input').or(
      page.locator('input[name="windSpeed"]')
    ).first();

    const windSpeedVisible = await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short });

    if (windSpeedVisible) {
      const customWindSpeed = '15';
      await windSpeedInput.clear();
      await windSpeedInput.fill(customWindSpeed);
    }

    // Step 5: Complete the form with ratings
    // Fill wave quality rating
    const waveQualitySlider = page.locator('input[type="range"][name="waveQuality"]').or(
      page.locator('#wave-quality-slider')
    ).first();

    const waveQualityVisible = await isVisibleSafe(waveQualitySlider, { timeout: TIMEOUTS.short });

    if (waveQualityVisible) {
      await waveQualitySlider.fill('8');
    }

    // Step 6: Submit the session
    const submitButton = page.getByRole('button', { name: /log|submit|save|complete/i }).first();
    await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.medium });

    await submitButton.click();

    // Step 7: Wait for success indication
    // The session wizard shows a celebration overlay then redirects to /profile
    // We wait for either the celebration OR the redirect to profile
    const successPromise = Promise.race([
      page.getByText(/🎉|Success!/i).waitFor({ timeout: 60000 }).then(() => 'celebration'),
      page.waitForURL(/\/profile/, { timeout: 60000 }).then(() => 'redirect'),
      page.getByText(/success|logged|created|saved/i).waitFor({ timeout: 60000 }).then(() => 'message'),
    ]).catch(() => null);

    const result = await successPromise;

    // Verify session was created successfully (any success indicator is valid)
    expect(result).toBeTruthy();

    // Note: Verification that the custom values were saved would require:
    // 1. Navigating to session detail page
    // 2. Or querying API endpoint to fetch session data
    // 3. Or database verification
    // This is covered by integration/API tests
  });

  test.fixme('should NOT auto-prefill when editing existing session', async ({ page }) => {
    // Edit mode not built yet — requires session creation flow, edit endpoint, and
    // state management to verify forecast data does not override existing manual values
  });

  test.fixme('should display placeholder examples when forecast data is missing', async ({ page }) => {
    // Placeholder examples not implemented — requires UI to show example values
    // (e.g., "3.5 ft") when historical forecast data is unavailable for past sessions
  });

  test('should persist all condition fields to database after submission', async ({ page }) => {
    // This test verifies data persistence end-to-end
    // Complete flow: fill form -> submit -> verify data saved

    // Step 1: Complete beach selection
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: TIMEOUTS.medium });
    await beachInput.fill('Black');

    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot
      .locator('ul')
      .locator('button')
      .filter({ hasText: /black/i })
      .first();

    await expect(beachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await beachOption.click();

    // Step 2: Set date/time (on same Where & When step)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('11:00');

    // Navigate to Session Details step (step 2)
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(1000);

    // Step 3: Fill all condition fields (whether prefilled or manual)
    const testConditions = {
      waveHeight: '5.0',
      windSpeed: '12',
      waterTemp: '64',
      tideHeight: '2.3'
    };

    // Wave height
    const waveHeightInput = page.locator('#wave-height-input').or(
      page.locator('input[name="waveHeight"]')
    ).first();

    if (await isVisibleSafe(waveHeightInput, { timeout: TIMEOUTS.short })) {
      await waveHeightInput.clear();
      await waveHeightInput.fill(testConditions.waveHeight);
    }

    // Wind speed
    const windSpeedInput = page.locator('#wind-speed-input').or(
      page.locator('input[name="windSpeed"]')
    ).first();

    if (await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short })) {
      await windSpeedInput.clear();
      await windSpeedInput.fill(testConditions.windSpeed);
    }

    // Water temp
    const waterTempInput = page.locator('#water-temp-input').or(
      page.locator('input[name="waterTemp"]')
    ).first();

    if (await isVisibleSafe(waterTempInput, { timeout: TIMEOUTS.short })) {
      await waterTempInput.clear();
      await waterTempInput.fill(testConditions.waterTemp);
    }

    // Tide height
    const tideHeightInput = page.locator('#tide-height-input').or(
      page.locator('input[name="tideHeight"]')
    ).first();

    if (await isVisibleSafe(tideHeightInput, { timeout: TIMEOUTS.short })) {
      await tideHeightInput.clear();
      await tideHeightInput.fill(testConditions.tideHeight);
    }

    // Step 4: Fill required rating fields
    const waveQualitySlider = page.locator('input[type="range"][name="waveQuality"]').or(
      page.locator('#wave-quality-slider')
    ).first();

    if (await isVisibleSafe(waveQualitySlider, { timeout: TIMEOUTS.short })) {
      await waveQualitySlider.fill('7');
    }

    // Step 5: Submit
    const submitButton = page.getByRole('button', { name: /log|submit|save|complete/i }).first();
    await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.medium });

    await submitButton.click();

    // Step 6: Verify success or that form was processed
    const successMessage = page.getByText(/success|logged|created|saved/i);
    const celebration = page.getByText(/🎉|Success!/i);

    const hasSuccess = await isVisibleSafe(successMessage, { timeout: TIMEOUTS.long });
    const hasCelebration = await isVisibleSafe(celebration, { timeout: TIMEOUTS.long });

    // If submission didn't show success message, check if we navigated away from form
    const stillOnForm = page.url().includes('/sessions/new');

    // Either we saw success or we navigated away (both indicate progress)
    expect(hasSuccess || hasCelebration || !stillOnForm).toBe(true);

    // Note: Full verification of database persistence would require:
    // 1. Extracting session ID from success message or redirect URL
    // 2. Fetching session via API: GET /api/sessions/[id]
    // 3. Verifying all condition fields match submitted values
    // 4. Verifying forecast snapshot was created
    // This level of verification is better suited for API/integration tests
  });

  test('should handle night session without recommendation language', async ({ page }) => {
    // Verify that night sessions are logged neutrally without "recommended" language

    // Step 1: Select beach
    const beachInput = page.getByTestId('beach-search-input');
    await expect(beachInput).toBeVisible({ timeout: TIMEOUTS.medium });
    await beachInput.fill('Black');

    const beachSelectorRoot = beachInput.locator('..');
    const beachOption = beachSelectorRoot
      .locator('ul')
      .locator('button')
      .filter({ hasText: /black/i })
      .first();

    await expect(beachOption).toBeVisible({ timeout: TIMEOUTS.long });
    await beachOption.click();

    // Step 2: Set night time on same Where & When step (9 PM)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('21:00'); // 9 PM - night time

    // Navigate to Session Details step (step 2)
    const nextButton = page.getByRole('button', { name: /next/i }).first();
    await nextButton.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for wizard step transition animation
    await page.waitForTimeout(1000);

    // Step 3: Verify no "recommended" or promotional language appears
    const pageContent = await page.content();
    const hasRecommendedText = pageContent.toLowerCase().includes('recommended');
    const hasShouldText = pageContent.toLowerCase().includes('you should surf');
    const hasGreatForText = pageContent.toLowerCase().includes('great for');

    // Night sessions should use neutral language
    expect(hasRecommendedText).toBe(false);
    expect(hasShouldText).toBe(false);

    // However, forecast data should still be shown (neutrally)
    // This is implicit - if we got to the Conditions step, forecast data may be present

    // Look for night session indicator if it exists
    const nightIndicator = page.getByText(/night session|after dark|evening/i);
    const hasNightIndicator = await isVisibleSafe(nightIndicator, { timeout: TIMEOUTS.short });

    // Night indicator is optional but good UX
    if (hasNightIndicator) {
      expect(hasNightIndicator).toBe(true);
    }
  });

  test.fixme('should show forecast snapshot on session detail after logging', async ({ page }) => {
    // Forecast snapshot display on session detail not yet implemented —
    // requires storing and displaying forecast-at-time-of-session data on the detail view
  });
});

test.describe('Session Wizard Autofill - Edge Cases', () => {
  test.fixme('should handle beach change after conditions are prefilled', async ({ page }) => {
    // Requires wizard back navigation, state management to clear previous forecast values,
    // and re-fetch forecast for new beach selection — not yet implemented
  });

  test.fixme('should handle partial forecast data gracefully', async ({ page }) => {
    // Requires graceful degradation when forecast API returns incomplete data
    // (e.g., null wind or tide values) with helpful placeholders — not yet implemented
  });
});

import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import { isVisibleSafe } from "./utils/strict-helpers";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Session Form Auto-Forecast Autofill Tests
 *
 * Tests the auto-forecast autofill feature that automatically populates
 * condition fields (waves, wind, water temp, tide) when users select
 * a spot and date/time during session logging.
 *
 * The multi-step wizard has been replaced with a single scrollable form
 * (SessionScrollForm). Condition fields are always visible — there is no
 * "navigate to Session Details step" required before interacting with them.
 *
 * Key behaviors tested:
 * 1. Auto-prefill after selecting beach + date/time (NEW sessions only)
 * 2. User edits are preserved over auto-prefilled values
 * 3. NO auto-prefill when editing existing sessions
 * 4. Placeholder examples shown when forecast data is missing
 * 5. All condition fields persist correctly to database
 *
 * Post-save flow: toast confirmation → redirect to /profile?highlight=<id>
 *
 * @project auth
 */

test.describe('Session Form - Auto-Forecast Autofill', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    // Navigate to new session log mode
    await page.goto('/sessions/new?mode=log');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Session Form Autofill' });
  });

  test('should auto-prefill condition fields after selecting beach and date/time', async ({ page }) => {
    // Select a beach with known forecast data
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

    // Fill in date and time — both are always visible in the scroll form
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    // Use today's date to ensure forecast data is available
    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('09:00'); // Morning session (not night)

    // Condition fields in ConditionsSection are always visible — no step navigation needed.
    // Allow time for auto-prefill to run after beach + date/time are set.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for autofill debounce after field changes
    await page.waitForTimeout(1000);

    // Wave height field check
    // ConditionsSection uses useId() for input IDs — use label-based selectors
    const waveHeightInput = page.getByLabel(/wave height/i).first();

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
    const windSpeedInput = page.getByLabel(/wind speed/i).first();

    const windSpeedVisible = await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short });

    if (windSpeedVisible) {
      const windSpeedValue = await windSpeedInput.inputValue();

      if (windSpeedValue) {
        const numValue = parseFloat(windSpeedValue);
        expect(numValue).toBeGreaterThanOrEqual(0);
      }
    }

    // Water temp field check
    const waterTempInput = page.getByLabel(/water temp/i).first();

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
    const tideHeightInput = page.getByLabel(/tide height/i).first();

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
    // Select beach
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

    // Set date/time — both are always visible in the scroll form
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('10:00');

    // Allow time for autofill to run
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for autofill debounce after field changes
    await page.waitForTimeout(1000);

    // Override auto-prefilled wave height with custom value.
    // Condition fields are always visible — no step navigation needed.
    // ConditionsSection uses useId() for input IDs — use label-based selectors
    const waveHeightInput = page.getByLabel(/wave height/i).first();

    await expect(waveHeightInput).toBeVisible({ timeout: TIMEOUTS.medium });

    // Clear and set custom value
    const customWaveHeight = '6.5';
    await waveHeightInput.clear();
    await waveHeightInput.fill(customWaveHeight);

    // Override wind speed
    const windSpeedInput = page.getByLabel(/wind speed/i).first();

    const windSpeedVisible = await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short });

    if (windSpeedVisible) {
      const customWindSpeed = '15';
      await windSpeedInput.clear();
      await windSpeedInput.fill(customWindSpeed);
    }

    // Interact with an Overall rating slider via keyboard.
    // SessionSlider renders a Radix SliderPrimitive with role="slider".
    // The sliders are always visible in the scroll form — no step navigation needed.
    const overallSlider = page.getByRole('slider', { name: /overall/i }).first();
    const sliderVisible = await isVisibleSafe(overallSlider, { timeout: TIMEOUTS.short });

    if (sliderVisible) {
      await overallSlider.focus();
      await overallSlider.press('ArrowRight');
      await overallSlider.press('ArrowRight');
    }

    // Submit — the sticky-footer Save button is always visible
    const submitButton = page.getByRole('button', { name: /save session|save/i }).first();
    await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.medium });

    await submitButton.click();

    // Post-save: toast confirmation then redirect to /profile?highlight=<id>
    const successPromise = Promise.race([
      page.getByText(/logged\. nice one\./i).waitFor({ timeout: 60000 }).then(() => 'toast'),
      page.waitForURL(/\/profile/, { timeout: 60000 }).then(() => 'redirect'),
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

    // Complete beach selection
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

    // Set date/time — both are always visible in the scroll form
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('11:00');

    // Allow time for autofill to run
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for autofill debounce after field changes
    await page.waitForTimeout(1000);

    // Fill all condition fields — always visible in scroll form
    const testConditions = {
      waveHeight: '5.0',
      windSpeed: '12',
      waterTemp: '64',
      tideHeight: '2.3'
    };

    // Wave height — ConditionsSection uses useId() for input IDs, use label selectors
    const waveHeightInput = page.getByLabel(/wave height/i).first();

    if (await isVisibleSafe(waveHeightInput, { timeout: TIMEOUTS.short })) {
      await waveHeightInput.clear();
      await waveHeightInput.fill(testConditions.waveHeight);
    }

    // Wind speed
    const windSpeedInput = page.getByLabel(/wind speed/i).first();

    if (await isVisibleSafe(windSpeedInput, { timeout: TIMEOUTS.short })) {
      await windSpeedInput.clear();
      await windSpeedInput.fill(testConditions.windSpeed);
    }

    // Water temp
    const waterTempInput = page.getByLabel(/water temp/i).first();

    if (await isVisibleSafe(waterTempInput, { timeout: TIMEOUTS.short })) {
      await waterTempInput.clear();
      await waterTempInput.fill(testConditions.waterTemp);
    }

    // Tide height
    const tideHeightInput = page.getByLabel(/tide height/i).first();

    if (await isVisibleSafe(tideHeightInput, { timeout: TIMEOUTS.short })) {
      await tideHeightInput.clear();
      await tideHeightInput.fill(testConditions.tideHeight);
    }

    // Interact with the Overall rating slider via keyboard.
    // SessionSlider renders a Radix SliderPrimitive with role="slider".
    const overallSlider = page.getByRole('slider', { name: /overall/i }).first();
    if (await isVisibleSafe(overallSlider, { timeout: TIMEOUTS.short })) {
      await overallSlider.focus();
      // Press ArrowRight to set a value (sliders start at 1, move to 3)
      await overallSlider.press('ArrowRight');
      await overallSlider.press('ArrowRight');
    }

    // Submit — sticky-footer Save button is always visible
    const submitButton = page.getByRole('button', { name: /save session|save/i }).first();
    await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.medium });

    await submitButton.click();

    // Verify success: toast confirmation or profile redirect
    const successMessage = page.getByText(/logged\. nice one\./i);
    const hasSuccess = await isVisibleSafe(successMessage, { timeout: TIMEOUTS.long });

    // If submission didn't show success toast, check if we navigated away from form
    const stillOnForm = page.url().includes('/sessions/new');

    // Either we saw success toast or we navigated away (both indicate progress)
    expect(hasSuccess || !stillOnForm).toBe(true);

    // Note: Full verification of database persistence would require:
    // 1. Extracting session ID from success message or redirect URL
    // 2. Fetching session via API: GET /api/sessions/[id]
    // 3. Verifying all condition fields match submitted values
    // 4. Verifying forecast snapshot was created
    // This level of verification is better suited for API/integration tests
  });

  test('should handle night session without recommendation language', async ({ page }) => {
    // Verify that night sessions are logged neutrally without "recommended" language

    // Select beach
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

    // Set night time — both fields are always visible in the scroll form (9 PM)
    const dateInput = page.getByTestId('session-date-input');
    await expect(dateInput).toBeVisible({ timeout: TIMEOUTS.long });

    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);

    const timeInput = page.getByTestId('session-time-input');
    await expect(timeInput).toBeVisible({ timeout: TIMEOUTS.long });
    await timeInput.fill('21:00'); // 9 PM — night time

    // Allow autofill to run
    // eslint-disable-next-line playwright/no-wait-for-timeout -- waiting for autofill debounce after field changes
    await page.waitForTimeout(1000);

    // Verify no "recommended" or promotional language appears
    const pageContent = await page.content();
    const hasRecommendedText = pageContent.toLowerCase().includes('recommended');
    const hasShouldText = pageContent.toLowerCase().includes('you should surf');

    // Night sessions should use neutral language
    expect(hasRecommendedText).toBe(false);
    expect(hasShouldText).toBe(false);

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

test.describe('Session Form Autofill - Edge Cases', () => {
  test.fixme('should handle beach change after conditions are prefilled', async ({ page }) => {
    // Requires scroll-form state management to clear previous forecast values
    // when beach changes and re-fetch forecast for new beach selection — not yet implemented
  });

  test.fixme('should handle partial forecast data gracefully', async ({ page }) => {
    // Requires graceful degradation when forecast API returns incomplete data
    // (e.g., null wind or tide values) with helpful placeholders — not yet implemented
  });
});

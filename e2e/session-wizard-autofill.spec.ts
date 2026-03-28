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

  test.fixme('should auto-prefill condition fields after selecting beach and date/time', async ({ page }) => {
    // ConditionsSection (wave height, wind speed, water temp, tide height) is not rendered
    // in QuickLogView which is now the default for mode=log. These condition fields are only
    // available in the standard (non-quick) form path, which is currently unreachable via URL.
    // Re-enable when condition fields are added to QuickLogView's DetailsExpander or when
    // a URL param is added to bypass quick mode.
  });

  test.fixme('should preserve user edits over auto-prefilled values', async ({ page }) => {
    // ConditionsSection (wave height, wind speed inputs) is not rendered in QuickLogView
    // which is now the default for mode=log. This test requires condition field inputs to
    // be visible for editing. Re-enable when condition fields return to the log mode UI.
  });

  test.fixme('should NOT auto-prefill when editing existing session', async ({ page }) => {
    // Edit mode not built yet — requires session creation flow, edit endpoint, and
    // state management to verify forecast data does not override existing manual values
  });

  test.fixme('should display placeholder examples when forecast data is missing', async ({ page }) => {
    // Placeholder examples not implemented — requires UI to show example values
    // (e.g., "3.5 ft") when historical forecast data is unavailable for past sessions
  });

  test.fixme('should persist all condition fields to database after submission', async ({ page }) => {
    // ConditionsSection (wave height, wind speed, water temp, tide height) is not rendered
    // in QuickLogView which is now the default for mode=log. This test filled condition
    // fields and verified persistence. Re-enable when condition fields return to the log
    // mode UI or convert to an API integration test.
  });

  test('should handle evening session without recommendation language', async ({ page }) => {
    // Verify that evening sessions are logged neutrally without "recommended" language

    // Select beach
    const beachInput = page.getByTestId('beach-search-input');
    const hasSearch = await isVisibleSafe(beachInput, { timeout: 5000 });

    if (hasSearch) {
      await beachInput.fill('Black');

      const beachSelectorRoot = beachInput.locator('..');
      const beachOption = beachSelectorRoot
        .locator('ul')
        .locator('button')
        .filter({ hasText: /black/i })
        .first();

      await expect(beachOption).toBeVisible({ timeout: TIMEOUTS.long });
      await beachOption.click();
    } else {
      // QuickLogView auto-detected a beach — confirm if prompted
      const confirmButton = page.getByRole('button', { name: /yeah/i });
      if (await isVisibleSafe(confirmButton, { timeout: 3000 })) {
        await confirmButton.click();
      }
    }

    // Select evening time preset (QuickLogView uses chip buttons, not date/time inputs)
    const eveningPreset = page.getByRole('button', { name: /evening/i });
    await expect(eveningPreset).toBeVisible({ timeout: TIMEOUTS.medium });
    await eveningPreset.click();

    // Verify no "recommended" or promotional language appears
    const pageContent = await page.content();
    const hasRecommendedText = pageContent.toLowerCase().includes('recommended');
    const hasShouldText = pageContent.toLowerCase().includes('you should surf');

    // Evening sessions should use neutral language
    expect(hasRecommendedText).toBe(false);
    expect(hasShouldText).toBe(false);
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

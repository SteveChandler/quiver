import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import { isVisibleSafe } from "./utils/strict-helpers";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Session Form QuickLogView Tests
 *
 * Tests the QuickLogView session logging flow (beach → time preset → rating).
 * ConditionsSection auto-prefill tests were removed — those fields are not
 * rendered in QuickLogView which is now the default for mode=log.
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
});

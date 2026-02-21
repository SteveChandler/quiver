import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

/**
 * Authenticated Spot Surf Report Tests
 *
 * Verifies that authenticated users do NOT see the sign-in CTA
 * on the surf report card.
 *
 * @project auth
 */

test.describe('Spot Surf Report (Authenticated)', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Spot Surf Report (Authenticated)' });
  });

  test('authenticated users do not see PublicContentGate CTA on surf report', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    if (isVisible) {
      // PublicContentGate renders its CTA only for unauthenticated users.
      // For authenticated users the gate is bypassed and conditions are shown directly.
      const gateTitle = surfReport.getByRole('heading', { name: /see today's best window/i });
      await expect(gateTitle).not.toBeVisible();

      // Conditions content (wave height, wind, best window, or why sentence) should be
      // accessible without blur or an overlay CTA
      const signUpButton = surfReport.getByRole('button', { name: /sign up free/i });
      await expect(signUpButton).not.toBeVisible();
    }
  });
});

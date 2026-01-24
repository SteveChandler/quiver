import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';

/**
 * Authenticated Spot Surf Report Tests
 *
 * Verifies that authenticated users do NOT see the sign-in CTA
 * on the surf report card.
 *
 * @project auth
 */

test.describe('Spot Surf Report (Authenticated)', () => {
  test('authenticated users do not see sign-in CTA', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await surfReport.isVisible().catch(() => false);

    if (isVisible) {
      const ctaLink = surfReport.getByRole('link', { name: /sign in for your call/i });
      await expect(ctaLink).not.toBeVisible();
    }
  });
});

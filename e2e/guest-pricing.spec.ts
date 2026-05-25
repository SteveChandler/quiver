import { test, expect } from '@playwright/test';

import {
  assertNoErrors,
  ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from './utils/error-detection';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Pricing Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/pricing');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Pricing page cleanup' });
  });

  test('renders the founding access waitlist without live purchase claims', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /join early and help the forecast learn from real sessions/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /join the founding access waitlist/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/log 5 surf sessions to qualify for pro for lifetime/i),
    ).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/monthly|annual|checkout|buy now|\$\d+/i);
    await expect(page.locator('a[href*="checkout"], a[href*="stripe"]')).toHaveCount(0);
  });

  test('links to founding access from the landing page', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/');

    await expect(page.getByTestId('landing-pricing-teaser')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /see founding access/i }),
    ).toHaveAttribute('href', '/pricing');
  });
});

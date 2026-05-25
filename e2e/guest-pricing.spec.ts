import { test, expect } from '@playwright/test';

import {
  assertNoErrors,
  ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from './utils/error-detection';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Plans Page', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/plans');
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Plans page cleanup' });
  });

  test('renders the App Store trial and Android waitlist without web checkout', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: /get quiver/i,
      }),
    ).toBeVisible();

    await expect(page.getByText(/14 days free/i).first()).toBeVisible();
    await expect(page.getByText(/pro membership includes/i)).toBeVisible();
    await expect(page.getByText(/personal forecasting/i)).toBeVisible();
    await expect(page.getByText(/best spot \+ paddle window/i)).toBeVisible();
    await expect(page.getByText(/board-aware picks/i)).toBeVisible();
    await expect(page.getByText(/similarity alerts/i)).toBeVisible();
    await expect(page.getByText(/custom spots/i)).toBeVisible();
    await expect(page.getByText(/unlimited favorites/i)).toBeVisible();
    await expect(page.getByText(/offline session saving/i)).toBeVisible();
    await expect(page.getByText(/day 12/i)).toBeVisible();
    await expect(
      page.getByRole('link', {
        name: /open app store/i,
      }),
    ).toHaveAttribute('href', /apps\.apple\.com\/us\/app\/surf-forecast-quiver\/id6759300320/);
    await expect(
      page.getByRole('button', {
        name: /join android waitlist/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/android is coming soon/i).first()).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/monthly|annual|checkout|buy now|lifetime pro|\$\d+/i);
    await expect(page.locator('a[href*="checkout"], a[href*="stripe"]')).toHaveCount(0);
  });

  test('links to app options from the landing page', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/');

    await expect(page.getByTestId('landing-pricing-teaser')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /see app options/i }),
    ).toHaveAttribute('href', '/plans');
  });
});

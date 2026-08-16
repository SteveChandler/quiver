import { test, expect } from '@playwright/test';

import { IOS_APP_STORE_WEB_REDIRECT_PATH } from '../lib/constants/app-store';
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

  test('renders the App Store trial and Android beta without web checkout', async ({ page }) => {
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
    ).toHaveAttribute('href', IOS_APP_STORE_WEB_REDIRECT_PATH);
    await expect(
      page.getByRole('link', {
        name: /get the android beta/i,
      }),
    ).toHaveAttribute(
      'href',
      /^\/android-beta\?source=plans-android-waitlist&surface=plans-page&placement=plans_compact&campaign=app_first_v1$/,
    );
    await expect(page.getByText(/android beta is open/i).first()).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/android is coming soon|android waitlist/i);
    expect(bodyText).not.toMatch(/monthly|annual|checkout|buy now|lifetime pro|\$\d+/i);
    await expect(page.locator('a[href*="checkout"], a[href*="stripe"]')).toHaveCount(0);
  });

  test('links to app options from the landing page', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/');

    const audienceAccess = page.getByTestId('field-guide-audience-access');
    await expect(audienceAccess).toBeVisible();
    await expect(
      audienceAccess.getByRole('link', { name: /see plans/i }),
    ).toHaveAttribute('href', '/plans');
  });
});

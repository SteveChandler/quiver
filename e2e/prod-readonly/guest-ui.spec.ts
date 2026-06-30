import { expect, test } from '@playwright/test';
import {
  assertNoErrors,
  type ErrorCapture,
  gotoWithErrorCheck,
  setupErrorDetection,
} from '../utils/error-detection';
import { dismissMapEntryOverlay } from '../utils/map-helpers';
import { isVisibleSafe } from '../utils/strict-helpers';

const PROD_BLACKS_URL = '/ca/san-diego/blacks';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Prod Read-Only Guest UI', () => {
  // This suite targets the deployed production app and is run via the dedicated
  // prod read-only command (PLAYWRIGHT_PROD_READONLY=true). Skip it in standard
  // local/dev guest runs, where the app-first landing differs (e.g. no web
  // signup modal) and these prod-shaped assertions don't apply.
  // eslint-disable-next-line playwright/no-skipped-test -- prod-readonly assertions target deployed prod copy/routes only.
  test.skip(
    process.env.PLAYWRIGHT_PROD_READONLY !== 'true',
    'Prod read-only suite runs only against the deployed prod app (PLAYWRIGHT_PROD_READONLY=true).',
  );

  let errorCapture: ErrorCapture | null;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (!errorCapture) {
      return;
    }

    if (testInfo.title.includes('public beach detail route')) {
      await assertNoErrors(page, errorCapture, {
        context: 'Prod read-only guest beach detail',
        checkConsole: false,
      });
      return;
    }

    if (testInfo.title.includes('404 route')) {
      return;
    }

    await assertNoErrors(page, errorCapture, { context: 'Prod read-only guest flow' });
  });

  test('landing page loads for guests without redirecting into authenticated routes', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/');

    expect(page.url()).not.toContain('/profile');
    expect(page.url()).not.toContain('/sessions');
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('login modal opens from the landing page without submitting credentials', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/');

    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('app CTA opens the download handoff without submitting credentials', async ({
    page,
  }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/');

    const appCta = page.getByRole('link', { name: /get the app/i }).first();
    await expect(appCta).toBeVisible();
    await appCta.click();

    await expect(page).toHaveURL(/\/download|apps\.apple\.com/);
  });

  test('features page renders meaningful content', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/features');

    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('map page renders a visible map surface', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture!, '/map');
    await dismissMapEntryOverlay(page);

    const mapSurface = page
      .locator('.mapboxgl-canvas, [class*="map-container"], canvas')
      .first();
    await expect(mapSurface).toBeVisible({ timeout: 10000 });
  });

  test('public beach detail route renders stable guest content', async ({ page }) => {
    await page.goto(PROD_BLACKS_URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 15000 });

    await expect(page.getByRole('heading', { name: /blacks/i, level: 1 })).toBeVisible({
      timeout: 10000,
    });

    const statsGrid = page.locator('[data-testid="beach-stats-grid"]');
    const beachActions = page.locator('[data-testid="beach-actions"]');
    const signupCta = page.locator('[data-testid="inline-signup-cta"]');
    const surfCall = page.locator('section[aria-label="Today\'s surf call"]');

    const hasStableSection =
      (await isVisibleSafe(statsGrid, { timeout: 15000 })) ||
      (await isVisibleSafe(beachActions, { timeout: 15000 })) ||
      (await isVisibleSafe(signupCta, { timeout: 15000 })) ||
      (await isVisibleSafe(surfCall, { timeout: 10000 }));

    expect(hasStableSection).toBe(true);
  });

  test('404 route returns a graceful page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    expect(response).not.toBeNull();
    expect(response?.status()).toBe(404);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, h2, main, [role="main"]').first()).toBeVisible();
  });
});

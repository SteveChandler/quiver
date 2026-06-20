/**
 * Guest PBSC event route tests.
 *
 * @project guest
 */

import { expect, test } from '@playwright/test';

import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from './utils/error-detection';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest PBSC event route', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'PBSC event route' });
  });

  test.describe('iPhone scanners', () => {
    test.use({
      userAgent: IPHONE_UA,
      viewport: { width: 390, height: 844 },
    });

    test('see the App Store primary action without Android or web fallback', async ({
      page,
    }) => {
      const response = await page.goto('/pbsc', {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });
      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      await page.waitForLoadState('load', { timeout: 15000 });

      await expect(
        page.getByRole('heading', {
          name: /tag your best days/i,
        }),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole('link', { name: /open quiver on iphone/i }).first(),
      ).toHaveAttribute(
        'href',
        /apps\.apple\.com\/us\/app\/surf-forecast-quiver\/id6759300320/,
      );
      await expect(
        page.getByRole('button', { name: /join android waitlist/i }),
      ).toHaveCount(0);
      await expect(page.getByText(/use quiver on web/i)).toHaveCount(0);
    });
  });

  test.describe('Android scanners', () => {
    test.use({
      userAgent: ANDROID_UA,
      viewport: { width: 412, height: 915 },
    });

    test('see the Android waitlist primary action without App Store or web fallback', async ({
      page,
    }) => {
      const response = await page.goto('/pbsc', {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });
      expect(response).not.toBeNull();
      expect(response!.status()).toBe(200);
      await page.waitForLoadState('load', { timeout: 15000 });

      await expect(
        page.getByRole('button', { name: /join android waitlist/i }).first(),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole('link', { name: /open quiver on iphone/i }),
      ).toHaveCount(0);
      await expect(page.getByText(/use quiver on web/i)).toHaveCount(0);
    });
  });

  test('defaults desktop scanners to Android waitlist without web fallback', async ({
    page,
  }) => {
    const response = await page.goto('/pbsc', {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await page.waitForLoadState('load', { timeout: 15000 });

    await expect(
      page.getByRole('button', { name: /join android waitlist/i }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/use quiver on web/i)).toHaveCount(0);
  });
});

/**
 * Guest PBSC welcome route tests.
 *
 * @project guest
 */

import { expect, test, type Page } from '@playwright/test';

import { buildAppHandoffPath } from '@/lib/constants/app-handoff';
import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from './utils/error-detection';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const HERO_HANDOFF_PATH = buildAppHandoffPath({
  source: 'pbsc-flyer',
  surface: 'pbsc-page',
  placement: 'hero_primary',
  utm_source: 'pbsc_qr',
  utm_medium: 'flyer',
  utm_campaign: 'pbsc_2026',
});

async function gotoPbsc(page: Page): Promise<void> {
  const response = await page.goto('/pbsc', {
    timeout: 15000,
    waitUntil: 'domcontentloaded',
  });
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);
  await page.waitForLoadState('load', { timeout: 15000 });
}

async function expectHeroHandoffLink(
  page: Page,
  label: RegExp,
): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
  await expect(link).toBeVisible({ timeout: 10000 });
  await expect(link).toHaveAttribute('href', HERO_HANDOFF_PATH);
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest PBSC welcome route', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'PBSC welcome route' });
  });

  test.describe('iPhone scanners', () => {
    test.use({
      userAgent: IPHONE_UA,
      viewport: { width: 390, height: 844 },
    });

    test('see the App Store handoff action on the PBSC welcome page', async ({
      page,
    }) => {
      await gotoPbsc(page);

      await expect(
        page.getByRole('heading', {
          name: /A surf memory machine for the days worth chasing/i,
        }),
      ).toBeVisible({ timeout: 10000 });
      await expectHeroHandoffLink(page, /Get it on the App Store/i);
      await expect(
        page.getByRole('link', { name: /Get it on Google Play/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /Get the Android beta/i }),
      ).toHaveCount(0);
    });
  });

  test.describe('Android scanners', () => {
    test.use({
      userAgent: ANDROID_UA,
      viewport: { width: 412, height: 915 },
    });

    test('see the Google Play handoff action on the PBSC welcome page', async ({
      page,
    }) => {
      await gotoPbsc(page);

      await expectHeroHandoffLink(page, /Get it on Google Play/i);
      await expect(
        page.getByRole('link', { name: /Get it on the App Store/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /Get the Android beta/i }),
      ).toHaveCount(0);
    });
  });

  test('defaults desktop scanners to the generic app handoff action', async ({
    page,
  }) => {
    await gotoPbsc(page);

    await expectHeroHandoffLink(page, /Get the app/i);
    const heroWords = page.getByLabel('Welcome to Quiver.');
    await expect(heroWords).toBeVisible({ timeout: 10000 });
    await expect(heroWords).toContainText('WELCOME TO');
    await expect(heroWords).toContainText('QUIVER');
    await expect(page.getByText('YOU FOUND IT')).toHaveCount(0);
    await expect(page.getByText('MEET QUIVER')).toHaveCount(0);
    await expect(page.getByTestId('pbsc-video-frame')).toHaveCSS(
      'aspect-ratio',
      '9 / 16',
    );
    await expect(
      page.getByLabel('Animated Quiver buoy loop preview'),
    ).toHaveCSS('object-fit', 'contain');
    await expect(page.getByText(/Your good days, on repeat/i).first()).toBeVisible(
      { timeout: 10000 },
    );
    await expect(page.getByText(/June 13, 2026/i)).toHaveCount(0);
    await expect(page.getByText(/Tourmaline live issue no\. 001/i)).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: /Get the Android beta/i }),
    ).toHaveCount(0);
  });
});

/**
 * Partner QR Flow E2E
 *
 * Covers the anonymous partner-QR landing at /p/[partnerCode]. The landing has
 * no auth or email-token dependency — any valid code renders an attributed
 * install page whose QR + CTAs drive the app handoff. Invalid codes redirect
 * home. Attribution rides on utm_content and the anonymous-allowed handoff
 * event family (no schema change).
 *
 * @project guest
 */

import { test, expect } from './fixtures/auth-fixture';
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from './utils/error-detection';

const PARTNER_CODE = 'SURF12';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Partner QR landing flow', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: 'Partner QR landing flow',
    });
  });

  test('guest valid partner code renders the QR landing and fires attributed handoff event', async ({
    page,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');

    const handoffEvent = page.waitForRequest(
      (request) =>
        request.url().includes('/api/events') &&
        request.method() === 'POST' &&
        isPartnerQrRenderedBody(request.postData()),
      { timeout: 15_000 },
    );

    await page.goto(`/p/${PARTNER_CODE}?utm_source=partner_qr`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('heading', { name: /wants you on quiver/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: /open app store/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /already have the app/i }),
    ).toHaveAttribute('href', `quiver://p/${PARTNER_CODE}`);
    await expect(
      page.getByRole('link', { name: /continue on web/i }),
    ).toBeVisible();

    // Desktop viewport shows the scannable QR carrying the attributed URL.
    await expect(page.locator('svg[data-smart-url]')).toHaveAttribute(
      'data-smart-url',
      new RegExp(`/p/${PARTNER_CODE}\\?.*ref=${PARTNER_CODE}.*utm_content=${PARTNER_CODE}`),
    );

    const request = await handoffEvent;
    const body = JSON.parse(request.postData() || '{}');
    expect(body.metadata).toEqual(
      expect.objectContaining({
        surface: 'partner_landing',
        partner_code: PARTNER_CODE,
      }),
    );
  });

  test('guest invalid partner code redirects home cleanly', async ({
    page,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');

    await page.goto('/p/ab', { waitUntil: 'domcontentloaded' });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/');
  });

  test('guest valid partner code renders the printable flyer route', async ({
    page,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');

    const response = await page.goto(`/p/${PARTNER_CODE}/flyer`, {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: /scan for\s+the surf call/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('partner-flyer-qr')).toBeVisible();
    await expect(page.getByText(PARTNER_CODE, { exact: true })).toBeVisible();
  });

  test('guest partner ref sets the referral cookie for signup credit', async ({
    page,
    context,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');

    await context.addCookies([
      {
        name: 'qvr_referral_code',
        value: 'OLD999',
        url: BASE_URL,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    ]);

    await page.goto(`/p/${PARTNER_CODE}?ref=${PARTNER_CODE}`, {
      waitUntil: 'domcontentloaded',
    });

    // Referral code cookies are intentionally last-touch: a fresh valid ?ref=
    // overwrites an existing qvr_referral_code, while UTM cookies stay first-touch.
    const cookies = await context.cookies(BASE_URL);
    expect(cookies).toContainEqual(
      expect.objectContaining({
        name: 'qvr_referral_code',
        value: PARTNER_CODE,
      }),
    );
  });
});

function isPartnerQrRenderedBody(postData: string | null): boolean {
  if (!postData) return false;
  try {
    const body = JSON.parse(postData);
    return (
      body.eventType === 'app_handoff_qr_rendered' &&
      body.metadata?.surface === 'partner_landing'
    );
  } catch {
    return false;
  }
}

function skipWhen(condition: boolean, reason: string) {
  // eslint-disable-next-line playwright/no-skipped-test -- spec is registered in the guest project; skip in others.
  test.skip(condition, reason);
}

/**
 * Guest Smoke Tests: Critical Pages
 *
 * Tests the highest-traffic guest-accessible routes that must load without errors.
 * These complement the Lighthouse CI audits by providing Playwright validation
 * for the same URLs, plus additional SEO infrastructure checks.
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';
import { TEST_BEACHES } from './fixtures/test-data';
import { buildBeachUrl } from '@/lib/utils/beach-url-utils';
import {
  APP_FIRST_CAMPAIGN,
  iosAppStoreUrlWithCampaign,
} from '@/lib/constants/app-store';
import { isVisibleSafe } from './utils/strict-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Smoke: Critical Pages', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('Features page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/features', { timeout: 15000 });

    await expect(
      page.getByRole('heading', { name: /a surf app that gets personal/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: /personal forecasting and the loop/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /not a report\. a forecast that knows your breaks/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /this is why quiver isn't another surf report you check and forget/i,
      ),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /custom spots/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /custom alerts/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /open app store/i }).first(),
    ).toHaveAttribute('href', iosAppStoreUrlWithCampaign(APP_FIRST_CAMPAIGN));
    await expect(
      page.getByRole('link', { name: /get the android beta/i }).first(),
    ).toHaveAttribute('href', '/android-beta');
    await expect(page.getByText(/home-break finder/i)).toHaveCount(0);

    // Page should have substantive content
    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    await assertNoErrors(page, errorCapture, { context: 'Features page' });
  });

  test('Map page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/map', { timeout: 15000 });

    // Map canvas or container should render
    const mapCanvas = page.locator('.mapboxgl-canvas, [class*="map-container"], canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    await assertNoErrors(page, errorCapture, { context: 'Map page' });
  });

  test('Beach detail page loads without errors @smoke', async ({ page }) => {
    // Cannot use gotoWithErrorCheck here — guest visitors trigger 401s from
    // auth-dependent APIs (/api/profile, /api/user/*, etc.) that are not in
    // the isIgnorableNetworkError allowlist. checkConsole: false on assertNoErrors
    // suppresses the corresponding console errors at the end.
    const beachUrl = buildBeachUrl(TEST_BEACHES.blacks);
    await page.goto(beachUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 15000 });

    // Beach name heading should be visible
    const heading = page.getByRole('heading', { name: /blacks/i, level: 1 });
    await expect(heading).toBeVisible({ timeout: 10000 });

    const zinePage = page.locator('.zine-page').first();
    const zinePaper = page.locator('.zine-paper').first();
    const hasZinePage = await isVisibleSafe(zinePage, { timeout: 15000 });
    const hasZinePaper = await isVisibleSafe(zinePaper, { timeout: 15000 });

    expect(hasZinePage || hasZinePaper).toBe(true);

    // Skip console checks — guest visitors trigger expected 401s from auth-dependent APIs
    await assertNoErrors(page, errorCapture, {
      context: 'Beach detail page',
      checkConsole: false,
    });
  });

  test('404 page renders gracefully @smoke', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    expect(response).not.toBeNull();
    expect(response!.status()).toBe(404);

    // Page should not crash — some content should render
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should have a heading or meaningful text (not a blank error page)
    const hasContent = page.locator('h1, h2, main, [role="main"]').first();
    await expect(hasContent).toBeVisible({ timeout: 5000 });

    // No visible error assertions — 404 console/network errors are expected
  });
});

test.describe('Guest Smoke: SEO Infrastructure', () => {
  test('Sitemap returns valid XML response @smoke', async ({ request }) => {
    const response = await request.get('/sitemap.xml', { timeout: 10000 });

    const status = response.status();
    // eslint-disable-next-line playwright/no-conditional-in-test -- local dev can 500 here on stale sitemap cache; CI still requires 200.
    const isExpectedLocalCacheFailure = status === 500 && !process.env.CI;
    expect(status === 200 || isExpectedLocalCacheFailure).toBe(true);

    const content = await response.text();
    // Should be a valid sitemap or sitemap index
    expect(status !== 200 || /<urlset|<sitemapindex/.test(content)).toBe(true);
    expect(status !== 200 || /<url>/.test(content)).toBe(true);
  });

  test('OG image endpoint returns valid image @smoke', async ({ request }) => {
    const response = await request.get('/api/og/beach?slug=blacks');

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });

  test('Thin-content pages have noindex meta or valid content @smoke', async ({ request }) => {
    // Use a valid skill-intent + city route that exercises the thin-content logic.
    // The noindex mechanism triggers for skill intents (beginner, longboard) when
    // a city has no matching beaches. Either outcome validates the infrastructure:
    // - noindex present -> thin-content protection is working
    // - noindex absent + content visible -> page has matching beaches and renders
    const response = await request.get('/longboard/san-diego', {
      timeout: 10000,
    });
    const html = await response.text();
    const hasNoindexMeta = /<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)/i.test(html);
    const hasH1 = /<h1\b/i.test(html);

    expect(response.status()).toBe(200);
    expect(hasNoindexMeta || hasH1).toBe(true);
  });
});

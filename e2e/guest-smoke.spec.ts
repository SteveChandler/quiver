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
import { isVisibleSafe } from './utils/strict-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Smoke: Critical Pages', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('Features page loads without errors @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/features', { timeout: 15000 });

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

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

    // Forecast section or wave info should render
    const forecastArea = page
      .locator(
        '[data-testid="spot-overview"], [data-testid="forecast"], [class*="forecast"], [class*="surf-report"]'
      )
      .first();
    const hasForecast = await isVisibleSafe(forecastArea, { timeout: 5000 });

    const waveInfo = page.getByText(/ft|swell|wave/i).first();
    const hasWaveInfo = await isVisibleSafe(waveInfo);

    expect(hasForecast || hasWaveInfo).toBe(true);

    // Skip console checks — guest visitors trigger expected 401s from auth-dependent APIs
    await assertNoErrors(page, errorCapture, {
      context: 'Beach detail page',
      checkConsole: false,
    });
  });

  test('Intent state page renders with heading and structured data @smoke', async ({ page }) => {
    await gotoWithErrorCheck(page, errorCapture, '/beginner/ca', { timeout: 10000 });

    // H1 should contain the state name and intent keyword
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 10000 });
    const h1Text = await h1.textContent();
    expect(h1Text?.toLowerCase()).toContain('california');
    expect(h1Text?.toLowerCase()).toContain('beginner');

    // JSON-LD structured data should exist
    const jsonLd = page.locator('script[type="application/ld+json"]').first();
    await expect(jsonLd).toBeAttached();

    await assertNoErrors(page, errorCapture, { context: 'Intent state page' });
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
  test('Sitemap returns valid XML response @smoke', async ({ page }) => {
    const response = await page.goto('/sitemap.xml', { timeout: 10000 });

    expect(response).not.toBeNull();
    const status = response!.status();
    if (status === 500 && !process.env.CI) {
      // Local dev environment — sitemap generation may fail due to stale build cache
      // In CI, a sitemap 500 is a real failure and should not be silently passed
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Sitemap 500 in local dev is expected (stale build cache)',
      });
      return;
    }
    expect(status).toBe(200);

    const content = await page.content();
    // Should be a valid sitemap or sitemap index
    expect(content).toMatch(/<urlset|<sitemapindex/);
    expect(content).toMatch(/<url>/);
  });

  test('OG image endpoint returns valid image @smoke', async ({ request }) => {
    const response = await request.get('/api/og/beach?slug=blacks');

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/image\/(png|jpeg|webp)/);
  });
});

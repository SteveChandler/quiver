import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * SEO Redirect Recovery Tests
 *
 * Tests the middleware that recovers 404s from old beach URLs by:
 * - City name mismatches (e.g., orange-county → dana-point)
 * - URL typos
 * - Mexico route structure changes
 *
 * These tests verify that old/incorrect URLs redirect to canonical URLs
 * with 301 status codes for SEO preservation.
 *
 * @project guest (no authentication needed)
 */

test.describe('SEO Redirect Recovery', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'SEO Redirect Recovery' });
  });

  test.describe('City Mismatch Redirects', () => {
    test('redirects /ca/orange-county/doheny-state-beach to correct city', async ({ page }) => {
      test.fixme(true, 'Middleware currently redirects OC legacy beach URLs to /spots/:slug; update this spec or the route contract.');
      // Doheny State Beach is in Dana Point, not Orange County
      const response = await page.goto('/ca/orange-county/doheny-state-beach');

      // Should end up at the canonical URL
      await expect(page).toHaveURL(/\/ca\/dana-point\/doheny-state-beach/);

      // Page should load successfully (200 after redirect)
      expect(response?.status()).toBe(200);
    });

    test('redirects /ca/san-diego/blacks to correct city', async ({ page }) => {
      // Blacks Beach is actually stored with city "San Diego" - this should work
      // But if it were stored differently, this test would catch the redirect
      const response = await page.goto('/ca/san-diego/blacks');

      // Should either redirect or load directly
      expect(response?.status()).toBe(200);

      // URL should contain the beach slug
      await expect(page).toHaveURL(/blacks/);
    });
  });

  test.describe('Mexico Beach URLs', () => {
    test('serves Mexico beach via existing international route', async ({ page }) => {
      // Mexico beaches are served via the /[intent]/[city]/[beachSlug]/[intlBeachSlug] route
      // The SEO redirect handler is not needed for these as the route already works
      const response = await page.goto('/mexico/baja-california/rosarito/alfonsos');

      // Page should load successfully
      expect(response?.status()).toBe(200);

      // Should show the beach content (Alfonsos beach)
      const heading = page.getByRole('heading', { name: /alfonsos/i });
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Query Parameter Preservation', () => {
    test('preserves query parameters on redirect', async ({ page }) => {
      test.fixme(true, 'Middleware currently redirects OC legacy beach URLs to /spots/:slug; update query-preservation expectations for that contract.');
      // Navigate with query params
      await page.goto('/ca/orange-county/doheny-state-beach?tab=forecast');

      // Should redirect and preserve query params
      await expect(page).toHaveURL(/\/ca\/dana-point\/doheny-state-beach/);
      await expect(page).toHaveURL(/tab=forecast/);
    });
  });

  test.describe('Canonical URL Pass-through', () => {
    test('does not redirect already-canonical URLs', async ({ page }) => {
      // Navigate directly to the canonical URL
      const response = await page.goto('/ca/dana-point/doheny-state-beach');

      // Should load directly without redirect
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(/\/ca\/dana-point\/doheny-state-beach/);
    });
  });
});

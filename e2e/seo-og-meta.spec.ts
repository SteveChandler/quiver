/**
 * SEO & OG Meta Tag Tests
 *
 * Tests that beach pages render correct meta tags for social sharing:
 * - og:image points to the dynamic OG image endpoint with absolute URL
 * - og:title matches page title format
 * - Twitter card meta tags present
 * - Title format: "{Beach Name} — X ft Today | Crowd & Wind Intel | {City} | Quiver"
 *   (CTR-optimized format with dynamic wave height)
 *
 * @project guest (public pages)
 */

import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Beach Page SEO & OG Meta Tags', () => {
  test.describe('Beach Detail Page (/beach/[slug])', () => {
    test('should have correct title format', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const title = await page.title();

      // CTR-optimized format: "{Beach Name} — X ft Today | Crowd & Wind Intel | {City} | Quiver"
      expect(title).toContain('Blacks');
      expect(title).toContain('Quiver');
      // Should contain dynamic wave height (e.g., "3.1 ft")
      expect(title).toMatch(/\d+(\.\d+)?(-\d+)?\s*ft/i);
    });

    test('should have og:image meta tag with absolute URL', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const ogImage = await page
        .locator('meta[property="og:image"]')
        .getAttribute('content');

      expect(ogImage).not.toBeNull();
      // Must be absolute URL for social crawlers
      expect(ogImage).toMatch(/^https?:\/\//);
      // Must point to our OG endpoint
      expect(ogImage).toContain('/api/og/beach');
      expect(ogImage).toContain(`slug=${TEST_BEACHES.blacks.slug}`);
    });

    test('should have og:title meta tag', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const ogTitle = await page
        .locator('meta[property="og:title"]')
        .getAttribute('content');

      expect(ogTitle).not.toBeNull();
      // CTR-optimized: "{Beach Name} — X ft Today | Crowd & Wind Intel | {City}"
      expect(ogTitle).toContain('Blacks');
      // Should contain dynamic wave height
      expect(ogTitle).toMatch(/\d+(\.\d+)?(-\d+)?\s*ft/i);
    });

    test('should have og:description meta tag', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const ogDescription = await page
        .locator('meta[property="og:description"]')
        .getAttribute('content');

      expect(ogDescription).not.toBeNull();
      // CTR-optimized: "{Beach} is showing X ft waves. Free 7-day forecast..."
      expect(ogDescription).toMatch(/\d+(\.\d+)?\s*ft\s*(waves)?/i);
      expect(ogDescription).toContain('forecast');
    });

    test('should have og:image dimensions', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const width = await page
        .locator('meta[property="og:image:width"]')
        .getAttribute('content');
      const height = await page
        .locator('meta[property="og:image:height"]')
        .getAttribute('content');

      expect(width).toBe('1200');
      expect(height).toBe('630');
    });

    test('should have twitter card meta tags', async ({ page }) => {
      await page.goto(`${BASE_URL}/beach/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const twitterCard = await page
        .locator('meta[name="twitter:card"]')
        .getAttribute('content');
      const twitterImage = await page
        .locator('meta[name="twitter:image"]')
        .getAttribute('content');

      expect(twitterCard).not.toBeNull();
      expect(twitterImage).not.toBeNull();
      expect(twitterImage).toContain('/api/og/beach');
    });
  });

  test.describe('Intent Beach Page (/[state]/[city]/[beachSlug])', () => {
    test('should have correct title format', async ({ page }) => {
      const state = TEST_BEACHES.blacks.state?.toLowerCase() || 'ca';
      const city = TEST_BEACHES.blacks.city?.toLowerCase().replace(/\s+/g, '-') || 'san-diego';

      await page.goto(`${BASE_URL}/${state}/${city}/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const title = await page.title();

      // CTR-optimized format: "{Beach Name} — X ft Today | Crowd & Wind Intel | {City} | Quiver"
      expect(title).toContain('Blacks');
      expect(title).toContain('Quiver');
      // Should contain dynamic wave height
      expect(title).toMatch(/\d+(\.\d+)?(-\d+)?\s*ft/i);
    });

    test('should have og:image meta tag with absolute URL', async ({ page }) => {
      const state = TEST_BEACHES.blacks.state?.toLowerCase() || 'ca';
      const city = TEST_BEACHES.blacks.city?.toLowerCase().replace(/\s+/g, '-') || 'san-diego';

      await page.goto(`${BASE_URL}/${state}/${city}/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const ogImage = await page
        .locator('meta[property="og:image"]')
        .getAttribute('content');

      expect(ogImage).not.toBeNull();
      expect(ogImage).toMatch(/^https?:\/\//);
      expect(ogImage).toContain('/api/og/beach');
      expect(ogImage).toContain(`slug=${TEST_BEACHES.blacks.slug}`);
    });

    test('should have description mentioning waves and forecast', async ({ page }) => {
      const state = TEST_BEACHES.blacks.state?.toLowerCase() || 'ca';
      const city = TEST_BEACHES.blacks.city?.toLowerCase().replace(/\s+/g, '-') || 'san-diego';

      await page.goto(`${BASE_URL}/${state}/${city}/${TEST_BEACHES.blacks.slug}`);
      await page.waitForLoadState('domcontentloaded');

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');

      expect(description).not.toBeNull();
      // CTR-optimized: "{Beach} is showing X ft waves. Free 7-day forecast..."
      expect(description).toMatch(/\d+(\.\d+)?\s*ft\s*(waves)?/i);
      expect(description).toContain('forecast');
    });
  });
});

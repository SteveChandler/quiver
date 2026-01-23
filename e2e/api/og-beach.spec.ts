/**
 * Beach OG Image API Contract Tests
 *
 * Tests the API contract for the beach Open Graph image generation endpoint:
 * - Returns valid PNG images for known beach slugs
 * - Returns fallback images for invalid/missing slugs
 * - Proper cache headers for CDN optimization
 * - Input validation (slug format, length)
 * - No authentication required (public endpoint)
 *
 * @project guest (public endpoint)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OG_BEACH_ENDPOINT = `${BASE_URL}/api/og/beach`;

test.describe('Beach OG Image API Contract', () => {
  test.describe('Valid Beach Slug', () => {
    test('should return 200 with image/png content type for a known beach slug', async ({
      playwright,
    }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=blacks`);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });

    test('should return non-empty image body', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=blacks`);
      const body = await response.body();

      expect(body.length).toBeGreaterThan(1000); // Real images are much larger than 1KB
    });

    test('should set cache-control headers for CDN caching', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=blacks`);
      const cacheControl = response.headers()['cache-control'] || '';

      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('max-age=86400');
      expect(cacheControl).toContain('stale-while-revalidate');
    });
  });

  test.describe('Fallback Behavior', () => {
    test('should return 200 with fallback image when no slug provided', async ({
      playwright,
    }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(OG_BEACH_ENDPOINT);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });

    test('should return fallback image for non-existent beach slug', async ({
      playwright,
    }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(
        `${OG_BEACH_ENDPOINT}?slug=this-beach-does-not-exist-99999`
      );

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });

    test('should return fallback image for empty slug', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=`);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  });

  test.describe('Input Validation', () => {
    test('should reject slugs with uppercase characters', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=Ocean-Beach`);

      // Should still return 200 with fallback (never 4xx for crawlers)
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });

    test('should reject slugs with special characters', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(
        `${OG_BEACH_ENDPOINT}?slug=ocean<script>alert(1)</script>`
      );

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });

    test('should reject extremely long slugs', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const longSlug = 'a'.repeat(250);
      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=${longSlug}`);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  });

  test.describe('Authentication', () => {
    test('should NOT require authentication', async ({ playwright }) => {
      const unauthContext = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await unauthContext.get(`${OG_BEACH_ENDPOINT}?slug=blacks`);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Image Dimensions', () => {
    test('should return image with expected dimensions (1200x630 OG standard)', async ({
      playwright,
    }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(`${OG_BEACH_ENDPOINT}?slug=blacks`);
      const body = await response.body();

      // PNG header check: bytes 16-23 contain width (4 bytes) and height (4 bytes) in big-endian
      // PNG signature: 8 bytes, then IHDR chunk: 4 bytes length + 4 bytes type + 4 bytes width + 4 bytes height
      const width = body.readUInt32BE(16);
      const height = body.readUInt32BE(20);

      expect(width).toBe(1200);
      expect(height).toBe(630);
    });

    test('fallback image should also have OG dimensions', async ({ playwright }) => {
      const context = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });

      const response = await context.get(OG_BEACH_ENDPOINT);
      const body = await response.body();

      const width = body.readUInt32BE(16);
      const height = body.readUInt32BE(20);

      expect(width).toBe(1200);
      expect(height).toBe(630);
    });
  });
});

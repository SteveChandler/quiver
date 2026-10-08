/**
 * Favorites Management API Contract Tests
 *
 * Tests the API contract for favorites endpoints to ensure:
 * - Proper authentication requirements
 * - Response structure remains stable
 * - Toggle logic works correctly
 * - Data quality meets requirements
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '../fixtures/auth-fixture';
import type { APIRequestContext } from '@playwright/test';
import { TEST_BEACHES } from '../fixtures/test-data';
import {
  getLocalBeachBySlug,
  isLocalE2ETarget,
} from '../utils/local-supabase-fixtures';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const FAVORITES_ENDPOINT = `${BASE_URL}/api/beaches/favorites`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveBeachUuid(
  request: APIRequestContext,
  beach: { id: string; slug?: string }
): Promise<string> {
  // Dev fixtures already provide UUIDs.
  if (UUID_REGEX.test(beach.id)) return beach.id;

  if (isLocalE2ETarget()) {
    const localBeach = await getLocalBeachBySlug(beach.slug ?? beach.id);
    if (UUID_REGEX.test(localBeach.id)) return localBeach.id;
  }

  // Local fixtures use slugs as "id". Resolve to a UUID by listing beaches.
  const response = await request.get(`${BASE_URL}/api/beaches`);
  const json = await response.json();

  const beaches: any[] = json?.data?.beaches ?? [];
  const slug = beach.slug ?? beach.id;
  const match = beaches.find((b) => b?.slug === slug);

  if (!match?.id || !UUID_REGEX.test(match.id)) {
    throw new Error(`Could not resolve UUID for beach slug="${slug}"`);
  }

  return match.id;
}

test.describe('Favorites Management API', () => {
  // Intentionally not serial: tests should be safe under parallel workers.

  test.describe('GET /api/beaches/favorites', () => {
    test.describe('Authentication Requirements', () => {
      test.describe('Unauthenticated', () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test('should require authentication', async ({ request }) => {
          const response = await request.get(FAVORITES_ENDPOINT);

          expect(response.status()).toBe(401);

          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toBeDefined();
        });
      });

      test('should return 200 for authenticated users', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return beaches array in data', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('beaches');
        expect(Array.isArray(json.data.beaches)).toBe(true);
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      });
    });

    test.describe('Beach Object Schema', () => {
      test('each favorite beach should have required id field', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();
        const beaches = json.data.beaches;

        beaches.forEach((beach: any) => {
          expect(beach).toHaveProperty('id');
          expect(typeof beach.id).toBe('string');
          expect(beach.id).toMatch(UUID_REGEX);
        });
      });

      test('each favorite beach should have required name field', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();
        const beaches = json.data.beaches;

        beaches.forEach((beach: any) => {
          expect(beach).toHaveProperty('name');
          expect(typeof beach.name).toBe('string');
          expect(beach.name.trim().length).toBeGreaterThan(0);
        });
      });

      test('each favorite beach should have location fields', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();
        const beaches = json.data.beaches;

        beaches.forEach((beach: any) => {
          expect(beach).toHaveProperty('city');
          expect(beach).toHaveProperty('state');

          if (beach.city !== null) {
            expect(typeof beach.city).toBe('string');
          }
          if (beach.state !== null) {
            expect(typeof beach.state).toBe('string');
          }
        });
      });
    });

    test.describe('Data Quality', () => {
      test('should not contain duplicate beach IDs', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();
        const beaches = json.data.beaches;

        const ids = beaches.map((b: any) => b.id);
        const uniqueIds = new Set(ids);

        expect(ids.length).toBe(uniqueIds.size);
      });

      test('should handle empty favorites gracefully', async ({ request }) => {
        const response = await request.get(FAVORITES_ENDPOINT);
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.beaches)).toBe(true);
        expect(json.data.beaches.length).toBeGreaterThanOrEqual(0);
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(FAVORITES_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(FAVORITES_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(FAVORITES_ENDPOINT);

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(FAVORITES_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Favorites List] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });
  });

});

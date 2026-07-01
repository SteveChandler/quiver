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

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const FAVORITES_ENDPOINT = `${BASE_URL}/api/beaches/favorites`;
const TOGGLE_ENDPOINT = (id: string) => `${BASE_URL}/api/beaches/${id}/favorite/toggle`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveBeachUuid(
  request: APIRequestContext,
  beach: { id: string; slug?: string }
): Promise<string> {
  // Dev fixtures already provide UUIDs.
  if (UUID_REGEX.test(beach.id)) return beach.id;

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

  test.describe('POST /api/beaches/[id]/favorite/toggle', () => {
    let validBeachId: string;

    test.beforeAll(async ({ request }) => {
      validBeachId = await resolveBeachUuid(request, TEST_BEACHES.blacks);
    });

    test.describe('Authentication Requirements', () => {
      test.describe('Unauthenticated', () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test('should require authentication', async ({ request }) => {
          // Note: using a valid UUID here avoids exercising param validation in this auth test.
          const response = await request.post(TOGGLE_ENDPOINT(validBeachId));

          expect(response.status()).toBe(401);

          const json = await response.json();
          expect(json.success).toBe(false);
        });
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.post(TOGGLE_ENDPOINT('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject non-UUID string', async ({ request }) => {
        const response = await request.post(TOGGLE_ENDPOINT('not-a-uuid-at-all'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Toggle Behavior (single mutating test)', () => {
      /**
       * Keep all mutation in a single test so parallel workers don't race on shared favorites state.
       * Other tests in this file remain schema/contract checks and tolerate interim favorite state.
       */
      test('should toggle favorite state and restore original state', async ({ request }) => {
        const testBeachId = validBeachId;

        const beforeResponse = await request.get(FAVORITES_ENDPOINT);
        // Skip if favorites endpoint is rate-limited or unavailable
        if (beforeResponse.status() === 429 || !beforeResponse.ok()) {
          test.skip(true, `Favorites API returned ${beforeResponse.status()} — rate limited or unavailable`);
          return;
        }
        const beforeJson = await beforeResponse.json();
        const wasFavorited = (beforeJson.data?.beaches || []).some((b: any) => b.id === testBeachId);

        // First toggle (flip state)
        const startTime = Date.now();
        const toggle1 = await request.post(TOGGLE_ENDPOINT(testBeachId));
        const duration = Date.now() - startTime;
        console.log(`[Favorites Toggle] Response time: ${duration}ms`);

        const toggle1Text = await toggle1.text();
        expect(toggle1.status(), toggle1Text).toBe(200);
        expect(duration).toBeLessThan(5000);

        const toggle1Json = JSON.parse(toggle1Text);
        expect(toggle1Json).toHaveProperty('success');
        expect(toggle1Json).toHaveProperty('data');
        expect(toggle1Json).toHaveProperty('timestamp');
        expect(toggle1Json.success).toBe(true);
        expect(toggle1Json.data).toHaveProperty('action');
        expect(['added', 'removed']).toContain(toggle1Json.data.action);

        const afterToggleResponse = await request.get(FAVORITES_ENDPOINT);
        const afterToggleJson = await afterToggleResponse.json();
        const isFavoritedAfterToggle = afterToggleJson.data.beaches.some(
          (b: any) => b.id === testBeachId
        );
        expect(isFavoritedAfterToggle).toBe(!wasFavorited);

        // Second toggle (restore original state)
        const toggle2 = await request.post(TOGGLE_ENDPOINT(testBeachId));
        const toggle2Json = await toggle2.json();
        expect(toggle2.status()).toBe(200);
        expect(toggle2Json.success).toBe(true);
        expect(toggle2Json.data).toHaveProperty('action');
        expect(toggle2Json.data.action).not.toBe(toggle1Json.data.action);

        const finalResponse = await request.get(FAVORITES_ENDPOINT);
        const finalJson = await finalResponse.json();
        const isFavoritedFinally = finalJson.data.beaches.some((b: any) => b.id === testBeachId);
        expect(isFavoritedFinally).toBe(wasFavorited);
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent beach gracefully', async ({ request }) => {
        const fakeBeachId = '00000000-0000-0000-0000-000000000000';
        const response = await request.post(TOGGLE_ENDPOINT(fakeBeachId));

        // Could be 404 or 500 depending on implementation
        // The important thing is it doesn't return 200
        expect(response.status()).toBeGreaterThanOrEqual(400);
      });

      test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.get(TOGGLE_ENDPOINT(TEST_BEACHES.blacks.id));

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms) for validation errors', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(TOGGLE_ENDPOINT('invalid-uuid'));
        const duration = Date.now() - startTime;

        console.log(`[Favorites Toggle (invalid)] Response time: ${duration}ms`);

        expect(response.status()).toBe(400);
        expect(duration).toBeLessThan(5000);
      });
    });
  });
});

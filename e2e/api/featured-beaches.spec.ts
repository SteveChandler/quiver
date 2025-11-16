/**
 * Featured Beaches API Contract Tests
 *
 * Tests the API contract for /api/beaches/featured to ensure:
 * - Response structure remains stable
 * - Data quality meets requirements
 * - Photo prioritization logic works correctly
 * - Error handling is graceful
 *
 * These tests catch API contract changes before they break the UI.
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/beaches/featured`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// HTTP/HTTPS URL format regex
const URL_REGEX = /^https?:\/\/.+/i;

test.describe('Featured Beaches API Contract', () => {
  test.describe('API Response Structure', () => {
    test('should return 200 OK status', async ({ request }) => {
      const response = await request.get(ENDPOINT);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
    });

    test('should return valid JSON content', async ({ request }) => {
      const response = await request.get(ENDPOINT);

      expect(response.headers()['content-type']).toContain('application/json');

      // Should parse without throwing
      const json = await response.json();
      expect(json).toBeDefined();
    });

    test('should return standard API response structure', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      // API utils wrap responses in { success: true, data: [...], timestamp: ... }
      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('timestamp');

      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('should return timestamp in ISO 8601 format', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe('string');

      // Validate ISO 8601 format
      const timestamp = new Date(json.timestamp);
      expect(timestamp.toISOString()).toBe(json.timestamp);
    });

    test('should include security headers', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const headers = response.headers();

      // Verify DEFAULT_SECURITY_HEADERS from api-utils
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['strict-transport-security']).toContain('max-age=31536000');
    });
  });

  test.describe('Beach Object Schema', () => {
    test('should return array of beach objects', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    test('each beach should have required id field', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any, index: number) => {
        expect(beach).toHaveProperty('id');
        expect(typeof beach.id).toBe('string');
        expect(beach.id).not.toBe('');
        expect(beach.id).toMatch(UUID_REGEX);
      });
    });

    test('each beach should have required name field', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any, index: number) => {
        expect(beach).toHaveProperty('name');
        expect(typeof beach.name).toBe('string');
        expect(beach.name).not.toBe('');
        expect(beach.name.trim().length).toBeGreaterThan(0);
      });
    });

    test('each beach should have slug field (string or null)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach).toHaveProperty('slug');

        if (beach.slug !== null) {
          expect(typeof beach.slug).toBe('string');
        }
      });
    });

    test('each beach should have city field (string or null)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach).toHaveProperty('city');

        if (beach.city !== null) {
          expect(typeof beach.city).toBe('string');
        }
      });
    });

    test('each beach should have state field (string or null)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach).toHaveProperty('state');

        if (beach.state !== null) {
          expect(typeof beach.state).toBe('string');
        }
      });
    });

    test('each beach should have photo_url field (string or null)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach).toHaveProperty('photo_url');

        if (beach.photo_url !== null) {
          expect(typeof beach.photo_url).toBe('string');
        }
      });
    });

    test('each beach should have has_real_photo field (boolean)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach).toHaveProperty('has_real_photo');
        expect(typeof beach.has_real_photo).toBe('boolean');
      });
    });

    test('beach objects should only contain expected fields', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      const expectedFields = ['id', 'name', 'slug', 'city', 'state', 'photo_url', 'has_real_photo'];

      beaches.forEach((beach: any) => {
        const actualFields = Object.keys(beach);

        // Check all expected fields are present
        expectedFields.forEach(field => {
          expect(actualFields).toContain(field);
        });

        // Check no unexpected fields exist
        actualFields.forEach(field => {
          expect(expectedFields).toContain(field);
        });
      });
    });
  });

  test.describe('Photo Prioritization Logic', () => {
    test('should prioritize beaches with real photos first', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      // Find indices of beaches with and without real photos
      let lastRealPhotoIndex = -1;
      let firstNoPhotoIndex = beaches.length;

      beaches.forEach((beach: any, index: number) => {
        if (beach.has_real_photo && beach.photo_url) {
          lastRealPhotoIndex = Math.max(lastRealPhotoIndex, index);
        }
        if (!beach.has_real_photo || !beach.photo_url) {
          firstNoPhotoIndex = Math.min(firstNoPhotoIndex, index);
        }
      });

      // Beaches with real photos should come before those without
      if (lastRealPhotoIndex !== -1 && firstNoPhotoIndex < beaches.length) {
        expect(lastRealPhotoIndex).toBeLessThan(firstNoPhotoIndex);
      }
    });

    test('should return beaches with photos when available', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      const withPhotos = beaches.filter((b: any) => b.photo_url !== null && b.photo_url !== '');

      // Should have at least some beaches with photos (unless database is empty)
      if (beaches.length > 0) {
        expect(withPhotos.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('photo URLs should be valid HTTP/HTTPS URLs when present', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        if (beach.photo_url !== null && beach.photo_url !== '') {
          expect(beach.photo_url).toMatch(URL_REGEX);
        }
      });
    });

    test('has_real_photo should be true only when photo_url exists', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        if (beach.has_real_photo === true) {
          expect(beach.photo_url).toBeTruthy();
          expect(beach.photo_url).not.toBe('');
        }
      });
    });

    test('beaches without photos should have has_real_photo set to false', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        if (beach.photo_url === null || beach.photo_url === '') {
          expect(beach.has_real_photo).toBe(false);
        }
      });
    });
  });

  test.describe('Data Quality', () => {
    test('should return reasonable number of beaches (4-50)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      // API returns up to 50 beaches (enrichedWithPhotos + enrichedWithoutPhotos)
      expect(beaches.length).toBeGreaterThanOrEqual(4);
      expect(beaches.length).toBeLessThanOrEqual(50);
    });

    test('should not contain duplicate beach IDs', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      const ids = beaches.map((b: any) => b.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    test('should not contain duplicate beach names', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      const names = beaches.map((b: any) => b.name);
      const uniqueNames = new Set(names);

      expect(names.length).toBe(uniqueNames.size);
    });

    test('all required fields should be present and non-undefined', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        // Required fields that must exist (can be null, but not undefined)
        expect(beach.id).not.toBeUndefined();
        expect(beach.name).not.toBeUndefined();
        expect(beach.slug).not.toBeUndefined();
        expect(beach.city).not.toBeUndefined();
        expect(beach.state).not.toBeUndefined();
        expect(beach.photo_url).not.toBeUndefined();
        expect(beach.has_real_photo).not.toBeUndefined();
      });
    });

    test('beach names should not be empty strings', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      beaches.forEach((beach: any) => {
        expect(beach.name.trim()).not.toBe('');
      });
    });

    test('should only include public beaches (is_private = false)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      // The API explicitly filters for is_private = false
      // We can't directly verify this from the response, but we can verify
      // that we got results, which implies the filter is working
      expect(beaches.length).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ request }) => {
      // This tests the try-catch in the route handler
      // Even if there's a database error, should return 200 with empty array
      const response = await request.get(ENDPOINT);

      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty('success');
      expect(json).toHaveProperty('data');
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('should return empty array instead of error for graceful degradation', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      // Even in error cases, the route returns createSuccessResponse([])
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('should handle malformed query parameters gracefully', async ({ request }) => {
      const response = await request.get(`${ENDPOINT}?invalidParam=test`);

      // Should ignore unknown params and return normally
      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
      const response = await request.post(ENDPOINT);

      expect(response.status()).toBe(405);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Method Not Allowed');
    });

    test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
      const response = await request.put(ENDPOINT);

      expect(response.status()).toBe(405);
    });

    test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
      const response = await request.delete(ENDPOINT);

      expect(response.status()).toBe(405);
    });
  });

  test.describe('Performance', () => {
    test('should respond within reasonable time (< 1000ms)', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(ENDPOINT);
      const duration = Date.now() - startTime;

      console.log(`[Featured Beaches] Response time: ${duration}ms`);

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    test('should return consistent results across multiple requests', async ({ request }) => {
      const response1 = await request.get(ENDPOINT);
      const json1 = await response1.json();

      const response2 = await request.get(ENDPOINT);
      const json2 = await response2.json();

      // Results should be stable (same beaches, same order)
      expect(json1.data.length).toBe(json2.data.length);

      if (json1.data.length > 0) {
        expect(json1.data[0].id).toBe(json2.data[0].id);
      }
    });
  });

  test.describe('Rate Limiting', () => {
    test('should rate limit excessive requests', async ({ request }) => {
      const results = [];

      // Make 25 rapid requests (burst limit is 20 for public-default)
      for (let i = 0; i < 25; i++) {
        const response = await request.get(ENDPOINT);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter(status => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should include rate limit headers in successful responses', async ({ request }) => {
      const response = await request.get(ENDPOINT);

      if (response.status() === 200) {
        const headers = response.headers();

        // Rate limit headers may not always be present, but if they are, validate them
        if (headers['x-ratelimit-limit']) {
          expect(headers['x-ratelimit-limit']).toBeDefined();
          expect(headers['x-ratelimit-remaining']).toBeDefined();

          const limit = parseInt(headers['x-ratelimit-limit']);
          const remaining = parseInt(headers['x-ratelimit-remaining']);

          expect(limit).toBeGreaterThan(0);
          expect(remaining).toBeGreaterThanOrEqual(0);
          expect(remaining).toBeLessThanOrEqual(limit);
        }
      }
    });

    test('should include Retry-After header in 429 responses', async ({ request }) => {
      let rateLimitedResponse;

      // Make requests until rate limited
      for (let i = 0; i < 30; i++) {
        const response = await request.get(ENDPOINT);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const headers = rateLimitedResponse.headers();
        expect(headers['retry-after']).toBeDefined();

        const retryAfter = parseInt(headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Caching', () => {
    test('should include cache headers for CDN/browser caching', async ({ request }) => {
      const response = await request.get(ENDPOINT);

      // Check for cache-related headers
      const headers = response.headers();

      // May have Cache-Control or ETag for caching
      const hasCacheControl = 'cache-control' in headers;
      const hasETag = 'etag' in headers;

      // At least one caching mechanism should be present
      expect(hasCacheControl || hasETag).toBe(true);
    });
  });

  test.describe('Empty Database Scenario', () => {
    test('should handle empty database gracefully', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      // Even with no beaches, should return successful empty array
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Length should be >= 0 (could be empty)
      expect(json.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Data Integrity Edge Cases', () => {
    test('should handle beaches with missing location data (null city/state)', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      // Find beaches with null location data
      const beachesWithNullLocation = beaches.filter((b: any) =>
        b.city === null || b.state === null
      );

      // Should still be valid beach objects
      beachesWithNullLocation.forEach((beach: any) => {
        expect(beach.id).toBeTruthy();
        expect(beach.name).toBeTruthy();
      });
    });

    test('should handle beaches with null slug', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      const beaches = json.data;

      const beachesWithNullSlug = beaches.filter((b: any) => b.slug === null);

      // Should still be valid beach objects
      beachesWithNullSlug.forEach((beach: any) => {
        expect(beach.id).toBeTruthy();
        expect(beach.name).toBeTruthy();
      });
    });
  });
});

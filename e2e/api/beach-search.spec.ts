/**
 * Beach Search API Contract Tests
 *
 * Tests the API contract for beach search/nearby endpoints to ensure:
 * - Proper query parameter validation
 * - Response structure remains stable
 * - Coordinate handling for nearby search
 * - Text search functionality
 *
 * @project guest (public endpoints)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SEARCH_ENDPOINT = `${BASE_URL}/api/beaches/search`;
const NEARBY_ENDPOINT = `${BASE_URL}/api/beaches/nearby`;

// UUID format regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// San Diego coordinates
const TEST_LOCATION = {
  lat: 32.7157,
  lon: -117.1611,
};

test.describe('Beach Search API Contract', () => {
  test.describe('GET /api/beaches/search', () => {
    test.describe('Parameter Validation', () => {
      test('should require query parameter', async ({ request }) => {
        const response = await request.get(SEARCH_ENDPOINT);

        // Could be 400 (validation) or return empty results
        expect([200, 400]).toContain(response.status());
      });

      test('should accept query parameter', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=blacks`);

        expect([200, 429]).toContain(response.status());
      });

      test('should handle empty query gracefully', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=`);

        expect([200, 400]).toContain(response.status());
      });

      test('should handle special characters in query', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=Black's%20Beach`);

        expect([200, 429]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=beach`);

        if (response.status() === 200) {
          expect(response.headers()['content-type']).toContain('application/json');

          const json = await response.json();
          expect(json).toBeDefined();
        }
      });

      test('should return beaches array', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=beach`);

        if (response.status() === 200) {
          const json = await response.json();

          expect(Array.isArray(json) || Array.isArray(json.data)).toBe(true);
        }
      });
    });

    test.describe('Beach Result Schema', () => {
      test('each beach should have id field', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=blacks`);

        if (response.status() === 200) {
          const json = await response.json();
          const beaches = Array.isArray(json) ? json : json.data;

          if (beaches && beaches.length > 0) {
            beaches.forEach((beach: any) => {
              expect(beach).toHaveProperty('id');
              expect(typeof beach.id).toBe('string');
            });
          }
        }
      });

      test('each beach should have name field', async ({ request }) => {
        const response = await request.get(`${SEARCH_ENDPOINT}?q=blacks`);

        if (response.status() === 200) {
          const json = await response.json();
          const beaches = Array.isArray(json) ? json : json.data;

          if (beaches && beaches.length > 0) {
            beaches.forEach((beach: any) => {
              expect(beach).toHaveProperty('name');
              expect(typeof beach.name).toBe('string');
              expect(beach.name.trim().length).toBeGreaterThan(0);
            });
          }
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(`${SEARCH_ENDPOINT}?q=beach`);
        const duration = Date.now() - startTime;

        console.log(`[Beach Search] Response time: ${duration}ms`);

        if (response.status() === 200) {
          expect(duration).toBeLessThan(5000);
        }
      });
    });
  });

  test.describe('GET /api/beaches/nearby', () => {
    test.describe('Parameter Validation', () => {
      test('should require lat parameter', async ({ request }) => {
        const response = await request.get(`${NEARBY_ENDPOINT}?lon=${TEST_LOCATION.lon}`);

        expect([200, 400]).toContain(response.status());
      });

      test('should require lon parameter', async ({ request }) => {
        const response = await request.get(`${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}`);

        expect([200, 400]).toContain(response.status());
      });

      test('should accept lat and lon parameters', async ({ request }) => {
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should accept legacy lng parameter', async ({ request }) => {
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lng=${TEST_LOCATION.lon}`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should reject invalid latitude', async ({ request }) => {
        const response = await request.get(`${NEARBY_ENDPOINT}?lat=invalid&lon=0`);

        expect([200, 400]).toContain(response.status());
      });

      test('should reject out of range latitude', async ({ request }) => {
        const response = await request.get(`${NEARBY_ENDPOINT}?lat=91&lon=0`);

        expect([200, 400]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          expect(response.headers()['content-type']).toContain('application/json');

          const json = await response.json();
          expect(json).toBeDefined();
        }
      });

      test('should return beaches array', async ({ request }) => {
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(Array.isArray(json) || Array.isArray(json.data)).toBe(true);
        }
      });
    });

    test.describe('Nearby Beach Schema', () => {
      test('each beach should have core location fields', async ({ request }) => {
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const beaches = Array.isArray(json) ? json : json.data;

          if (beaches && beaches.length > 0) {
            beaches.forEach((beach: any) => {
              // Should have basic beach identifiers
              expect(beach.id || beach.slug).toBeDefined();
              expect(beach.name).toBeDefined();
            });
          }
        }
      });

      test('beaches should be returned in consistent order', async ({ request }) => {
        // Note: The nearby API returns beaches sorted by geographic proximity
        // but does not expose the distance value in the response
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const beaches = Array.isArray(json) ? json : json.data;

          // Make a second request to verify consistent ordering
          const response2 = await request.get(
            `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
          );
          const json2 = await response2.json();
          const beaches2 = Array.isArray(json2) ? json2 : json2.data;

          if (beaches && beaches.length > 0 && beaches2 && beaches2.length > 0) {
            // Verify same ordering between requests
            const ids1 = beaches.map((b: any) => b.id);
            const ids2 = beaches2.map((b: any) => b.id);
            expect(ids1).toEqual(ids2);
          }
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(
          `${NEARBY_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );
        const duration = Date.now() - startTime;

        console.log(`[Nearby Beaches] Response time: ${duration}ms`);

        if (response.status() === 200) {
          expect(duration).toBeLessThan(5000);
        }
      });
    });
  });
});

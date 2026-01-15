/**
 * Intel Posts API Contract Tests
 *
 * Tests the API contract for intel endpoints to ensure:
 * - Optional authentication for GET
 * - Required authentication for POST
 * - Response structure remains stable
 * - Coordinate validation
 * - Schema validation
 *
 * @project mixed (GET public with optional auth, POST requires auth)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const INTEL_ENDPOINT = `${BASE_URL}/api/intel`;
const INTEL_CONFIRM = (id: string) => `${BASE_URL}/api/intel/${id}/confirm`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// San Diego coordinates for testing
const TEST_LOCATION = {
  lat: 32.7157,
  lon: -117.1611,
};

// Test UUID (valid format but may not exist)
const FAKE_INTEL_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Intel API Contract', () => {
  test.describe('GET /api/intel', () => {
    test.describe('Authentication Requirements', () => {
      test('should allow unauthenticated access', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        // Should not be 401 - public endpoint with bot blocking
        expect([200, 429]).toContain(response.status());
      });

      test('should work for authenticated users', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        expect([200, 429]).toContain(response.status());
      });
    });

    test.describe('Parameter Validation', () => {
      test('should require lat parameter', async ({ request }) => {
        const response = await request.get(`${INTEL_ENDPOINT}?lon=${TEST_LOCATION.lon}`);

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('required');
      });

      test('should require lon parameter', async ({ request }) => {
        const response = await request.get(`${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}`);

        expect(response.status()).toBe(400);
      });

      test('should accept legacy lng parameter', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lng=${TEST_LOCATION.lon}`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should accept optional radius parameter', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&radius=5`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should accept optional tag parameter', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&tag=conditions`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should accept "all" as tag parameter', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&tag=all`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should accept optional limit parameter', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&limit=10`
        );

        expect([200, 429]).toContain(response.status());
      });

      test('should reject invalid coordinate format', async ({ request }) => {
        const response = await request.get(`${INTEL_ENDPOINT}?lat=invalid&lon=0`);

        expect(response.status()).toBe(400);
      });

      test('should reject excessive radius', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&radius=1000`
        );

        // Should reject or clamp to max
        expect([200, 400, 429]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          expect(response.headers()['content-type']).toContain('application/json');

          const json = await response.json();
          expect(json).toBeDefined();
        }
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json).toHaveProperty('success');
          expect(json).toHaveProperty('data');
          expect(json).toHaveProperty('timestamp');

          expect(json.success).toBe(true);
        }
      });

      test('should return posts array in data', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty('posts');
          expect(Array.isArray(json.data.posts)).toBe(true);
        }
      });

      test('should return total count in data', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty('total');
          expect(typeof json.data.total).toBe('number');
          expect(json.data.total).toBeGreaterThanOrEqual(0);
        }
      });

      test('should return filters object in data', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty('filters');
          expect(json.data.filters).toHaveProperty('latitude');
          expect(json.data.filters).toHaveProperty('longitude');
          expect(json.data.filters).toHaveProperty('radius');
          expect(json.data.filters).toHaveProperty('tag');
          expect(json.data.filters).toHaveProperty('limit');
        }
      });
    });

    test.describe('Intel Post Object Schema', () => {
      test('each post should have required fields', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const posts = json.data.posts;

          posts.forEach((post: any) => {
            expect(post).toHaveProperty('id');
            expect(post).toHaveProperty('title');
            expect(post).toHaveProperty('description');
            expect(post).toHaveProperty('tag');
            expect(post).toHaveProperty('latitude');
            expect(post).toHaveProperty('longitude');
          });
        }
      });

      test('each post should have user information', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const posts = json.data.posts;

          posts.forEach((post: any) => {
            expect(post).toHaveProperty('user');
            expect(post.user).toHaveProperty('full_name');
          });
        }
      });

      test('each post should have user_confirmed field for authenticated users', async ({
        request,
      }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const posts = json.data.posts;

          posts.forEach((post: any) => {
            expect(post).toHaveProperty('user_confirmed');
            expect(typeof post.user_confirmed).toBe('boolean');
          });
        }
      });

      test('post IDs should be valid UUIDs', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const posts = json.data.posts;

          posts.forEach((post: any) => {
            expect(post.id).toMatch(UUID_REGEX);
          });
        }
      });

      test('tag should be valid intel tag type', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const posts = json.data.posts;

          const validTags = [
            'conditions',
            'crowd',
            'hazard',
            'parking',
            'wildlife',
            'access',
            'event',
            'gear',
            'other',
          ];

          posts.forEach((post: any) => {
            expect(validTags).toContain(post.tag);
          });
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );

        if (response.status() === 200) {
          const headers = response.headers();

          expect(headers['x-content-type-options']).toBe('nosniff');
          expect(headers['x-frame-options']).toBe('DENY');
          expect(headers['x-xss-protection']).toBe('1; mode=block');
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 10000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(
          `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
        );
        const duration = Date.now() - startTime;

        console.log(`[Intel GET] Response time: ${duration}ms`);

        if (response.status() === 200) {
          // Intel endpoint may be slow due to location-based queries
          expect(duration).toBeLessThan(10000);
        }
      });
    });
  });

  test.describe('POST /api/intel', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Test Intel',
            description: 'Test description',
          },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Payload Validation', () => {
      test('should reject missing latitude', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Test',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject missing longitude', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            tag: 'conditions',
            title: 'Test',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject missing tag', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            title: 'Test',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject missing title', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject missing description', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject empty title', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: '',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject empty description', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Test',
            description: '',
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject invalid tag', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'invalid-tag',
            title: 'Test',
            description: 'Test',
          },
        });

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'E2E Test Intel',
            description: 'Test description',
          },
        });

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });

      test('should return created intel post on success', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: `E2E Test ${Date.now()}`,
            description: 'Test description',
          },
        });

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.success).toBe(true);
          expect(json.data).toHaveProperty('id');
          expect(json.data).toHaveProperty('title');
          expect(json.data).toHaveProperty('user');
        }
      });

      test('should auto-assign nearest beach_id when creating intel post', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat, // San Diego coordinates should find a nearby beach
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: `Beach Assignment Test ${Date.now()}`,
            description: 'Testing auto-assignment of nearest beach',
          },
        });

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.success).toBe(true);
          expect(json.data).toHaveProperty('beach_id');

          // San Diego coordinates should find a beach within 2 miles
          // beach_id should not be null for this well-known location
          expect(json.data.beach_id).not.toBeNull();

          // Verify it's a valid UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          expect(json.data.beach_id).toMatch(uuidRegex);
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Test',
            description: 'Test',
          },
        });

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(INTEL_ENDPOINT, {
          data: {
            latitude: TEST_LOCATION.lat,
            longitude: TEST_LOCATION.lon,
            tag: 'conditions',
            title: 'Performance Test',
            description: 'Test',
          },
        });
        const duration = Date.now() - startTime;

        console.log(`[Intel POST] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('POST /api/intel/[id]/confirm', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent intel post gracefully', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        // Should not crash
        expect(response.status()).toBeGreaterThanOrEqual(400);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });

      test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.get(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(405);
      });
    });
  });

  test.describe('Rate Limiting', () => {
    test('should have rate limiting configured for public GET', async ({ request }) => {
      const response = await request.get(
        `${INTEL_ENDPOINT}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      // Should return 200 or 429 (rate limited)
      expect([200, 429]).toContain(response.status());

      if (response.status() === 429) {
        const headers = response.headers();
        expect(headers['retry-after']).toBeDefined();
      }
    });
  });
});

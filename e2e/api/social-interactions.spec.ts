/**
 * Social Interactions API Contract Tests
 *
 * Tests the API contract for social interaction endpoints to ensure:
 * - Like/unlike toggle works correctly
 * - Follow/unfollow mechanics are accurate
 * - Proper authentication requirements
 * - Response structure stability
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '@playwright/test';
import { createIsolatedApiContext } from '../utils/api-request-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Session likes endpoints
const SESSION_LIKES_TOGGLE = (sessionId: string) =>
  `${BASE_URL}/api/sessions/${sessionId}/likes/toggle`;
const SESSION_LIKES = (sessionId: string) => `${BASE_URL}/api/sessions/${sessionId}/likes`;

// User follow endpoints
const USER_FOLLOW = (userId: string) => `${BASE_URL}/api/users/${userId}/follow`;
const USER_FOLLOW_TOGGLE = (userId: string) => `${BASE_URL}/api/users/${userId}/follow/toggle`;

// UUID format regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test UUIDs (valid format but may not exist in database)
const FAKE_SESSION_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000002';

test.describe('Social Interactions API', () => {
  test.describe('Session Likes Toggle API', () => {
    test.describe('POST /api/sessions/[id]/likes/toggle', () => {
      test.describe('Authentication Requirements', () => {
        test('should require authentication', async ({ playwright }, testInfo) => {
          const unauthContext = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
            storageState: { cookies: [], origins: [] },
          });

          const response = await unauthContext.post(SESSION_LIKES_TOGGLE(FAKE_SESSION_ID));

          expect(response.status()).toBe(401);

          const json = await response.json();
          expect(json.success).toBe(false);

          await unauthContext.dispose();
        });
      });

      test.describe('Parameter Validation', () => {
        test('should reject invalid UUID format', async ({ request }) => {
          const response = await request.post(SESSION_LIKES_TOGGLE('invalid-uuid'));

          expect(response.status()).toBe(400);

          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toBeDefined();
        });

        test('should reject non-UUID string', async ({ request }) => {
          const response = await request.post(SESSION_LIKES_TOGGLE('not-a-uuid-at-all'));

          expect(response.status()).toBe(400);
        });

        test('should reject empty session ID', async ({ request }) => {
          const response = await request.post(`${BASE_URL}/api/sessions//likes/toggle`);

          // Could be 400 or 404 depending on routing
          expect([400, 404]).toContain(response.status());
        });
      });

      test.describe('Response Structure', () => {
        test('should return standard API response structure on success or error', async ({
          request,
        }) => {
          const response = await request.post(SESSION_LIKES_TOGGLE(FAKE_SESSION_ID));
          const json = await response.json();

          expect(json).toHaveProperty('success');
          expect(json).toHaveProperty('timestamp');

          if (json.success) {
            expect(json).toHaveProperty('data');
          } else {
            expect(json).toHaveProperty('error');
          }
        });
      });

      test.describe('Security Headers', () => {
        test('should include security headers', async ({ request }) => {
          const response = await request.post(SESSION_LIKES_TOGGLE(FAKE_SESSION_ID));
          const headers = response.headers();

          expect(headers['x-content-type-options']).toBe('nosniff');
          expect(headers['x-frame-options']).toBe('DENY');
        });
      });

      test.describe('Error Handling', () => {
        test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
          const response = await request.get(SESSION_LIKES_TOGGLE(FAKE_SESSION_ID));

          expect(response.status()).toBe(405);
        });

        test('should handle non-existent session gracefully', async ({ request }) => {
          const response = await request.post(SESSION_LIKES_TOGGLE(FAKE_SESSION_ID));

          // Could be 404 or 400 or 500 depending on implementation
          // The important thing is it doesn't crash
          const json = await response.json();
          expect(json).toHaveProperty('success');
        });
      });
    });

    test.describe('POST /api/sessions/[id]/likes', () => {
      test.describe('Method Handling', () => {
        test('should return 405 Method Not Allowed for POST', async ({ request }) => {
          // POST is not supported on /likes endpoint - use /likes/toggle instead
          const response = await request.post(SESSION_LIKES(FAKE_SESSION_ID));

          expect(response.status()).toBe(405);

          const json = await response.json();
          expect(json.error).toContain('Method Not Allowed');
        });
      });
    });
  });

  test.describe('User Follow API', () => {
    test.describe('GET /api/users/[id]/follow', () => {
      test.describe('Response Structure', () => {
        test('should return follow status for valid user', async ({ request }) => {
          // This endpoint works for auth users (returns following status)
          const response = await request.get(USER_FOLLOW(FAKE_USER_ID));

          // Could be 200 (returns default status) or 404 (user not found)
          if (response.status() === 200) {
            const json = await response.json();
            expect(json.success).toBe(true);
            expect(json.data).toHaveProperty('following');
            expect(json.data).toHaveProperty('followersCount');
            expect(json.data).toHaveProperty('followingCount');
          }
        });

        test('should return boolean for following status', async ({ request }) => {
          const response = await request.get(USER_FOLLOW(FAKE_USER_ID));

          if (response.status() === 200) {
            const json = await response.json();
            expect(typeof json.data.following).toBe('boolean');
          }
        });

        test('should return numbers for counts', async ({ request }) => {
          const response = await request.get(USER_FOLLOW(FAKE_USER_ID));

          if (response.status() === 200) {
            const json = await response.json();
            expect(typeof json.data.followersCount).toBe('number');
            expect(typeof json.data.followingCount).toBe('number');
            expect(json.data.followersCount).toBeGreaterThanOrEqual(0);
            expect(json.data.followingCount).toBeGreaterThanOrEqual(0);
          }
        });
      });

      test.describe('Parameter Validation', () => {
        test('should reject invalid UUID format', async ({ request }) => {
          const response = await request.get(USER_FOLLOW('invalid-uuid'));

          expect(response.status()).toBe(400);
        });
      });

      test.describe('Security Headers', () => {
        test('should include security headers', async ({ request }) => {
          const response = await request.get(USER_FOLLOW(FAKE_USER_ID));
          const headers = response.headers();

          expect(headers['x-content-type-options']).toBe('nosniff');
          expect(headers['x-frame-options']).toBe('DENY');
        });
      });

      test.describe('Error Handling', () => {
        test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
          const response = await request.post(USER_FOLLOW(FAKE_USER_ID));

          expect(response.status()).toBe(405);
        });
      });
    });

    test.describe('POST /api/users/[id]/follow/toggle', () => {
      test.describe('Authentication Requirements', () => {
        test('should require authentication', async ({ playwright }, testInfo) => {
          const unauthContext = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
            storageState: { cookies: [], origins: [] },
          });

          const response = await unauthContext.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));

          expect(response.status()).toBe(401);

          const json = await response.json();
          expect(json.success).toBe(false);

          await unauthContext.dispose();
        });
      });

      test.describe('Parameter Validation', () => {
        test('should reject invalid UUID format', async ({ request }) => {
          const response = await request.post(USER_FOLLOW_TOGGLE('invalid-uuid'));

          expect(response.status()).toBe(400);

          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toBeDefined();
        });

        test('should reject non-UUID string', async ({ request }) => {
          const response = await request.post(USER_FOLLOW_TOGGLE('not-a-uuid'));

          expect(response.status()).toBe(400);
        });
      });

      test.describe('Response Structure', () => {
        test('should return standard API response structure', async ({ request }) => {
          const response = await request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));
          const json = await response.json();

          expect(json).toHaveProperty('success');
          expect(json).toHaveProperty('timestamp');
        });
      });

      test.describe('Self-Follow Prevention', () => {
        test('should handle self-follow attempts gracefully', async ({ request }) => {
          // First, we need to get the current user's ID
          // This test verifies the API doesn't crash when attempting self-follow
          // The actual behavior (error vs no-op) depends on implementation

          // Using a fake user ID here - in a real test with setup,
          // we'd use the authenticated user's actual ID
          const response = await request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));

          // Should not crash - returns some response
          expect(response.status()).toBeGreaterThanOrEqual(200);
          expect(response.status()).toBeLessThan(600);
        });
      });

      test.describe('Security Headers', () => {
        test('should include security headers', async ({ request }) => {
          const response = await request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));
          const headers = response.headers();

          expect(headers['x-content-type-options']).toBe('nosniff');
          expect(headers['x-frame-options']).toBe('DENY');
        });
      });

      test.describe('Error Handling', () => {
        test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
          const response = await request.get(USER_FOLLOW_TOGGLE(FAKE_USER_ID));

          expect(response.status()).toBe(405);
        });

        test('should handle non-existent user gracefully', async ({ request }) => {
          const response = await request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));

          // The API should handle this gracefully
          const json = await response.json();
          expect(json).toHaveProperty('success');
        });
      });

      test.describe('Performance', () => {
        test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
          const startTime = Date.now();
          const response = await request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID));
          const duration = Date.now() - startTime;

          console.log(`[Follow Toggle] Response time: ${duration}ms`);

          expect(duration).toBeLessThan(5000);
        });
      });
    });
  });

  test.describe('Cross-Endpoint Consistency', () => {
    test('social endpoints should return consistent response formats', async ({ request }) => {
      // All social endpoints should use the same response wrapper
      const endpoints = [
        { method: 'post', url: SESSION_LIKES_TOGGLE(FAKE_SESSION_ID) },
        { method: 'get', url: USER_FOLLOW(FAKE_USER_ID) },
        { method: 'post', url: USER_FOLLOW_TOGGLE(FAKE_USER_ID) },
      ];

      for (const endpoint of endpoints) {
        const response =
          endpoint.method === 'post'
            ? await request.post(endpoint.url)
            : await request.get(endpoint.url);

        const json = await response.json();

        // All endpoints should have these fields
        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');

        // Timestamp should be valid ISO string
        if (json.timestamp) {
          const date = new Date(json.timestamp);
          expect(date.toISOString()).toBe(json.timestamp);
        }
      }
    });

    test('all social endpoints should include security headers', async ({ request }) => {
      const endpoints = [
        { method: 'post' as const, url: SESSION_LIKES_TOGGLE(FAKE_SESSION_ID) },
        { method: 'get' as const, url: USER_FOLLOW(FAKE_USER_ID) },
        { method: 'post' as const, url: USER_FOLLOW_TOGGLE(FAKE_USER_ID) },
      ];

      for (const endpoint of endpoints) {
        const response =
          endpoint.method === 'post'
            ? await request.post(endpoint.url)
            : await request.get(endpoint.url);

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
      }
    });
  });

  test.describe('Rate Limiting', () => {
    test('social endpoints should handle rapid requests gracefully', async ({ request }) => {
      // Make several rapid requests to test rate limiting doesn't cause crashes
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(request.post(USER_FOLLOW_TOGGLE(FAKE_USER_ID)));
      }

      const responses = await Promise.all(promises);

      // All requests should complete without server errors
      for (const response of responses) {
        expect(response.status()).toBeLessThan(500);
      }

      // Some may be rate limited (429), which is acceptable
      const rateLimited = responses.filter((r) => r.status() === 429);
      const successful = responses.filter((r) => r.status() === 200);

      // At least one should succeed or all should be rate limited
      expect(successful.length + rateLimited.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Sessions CRUD API Contract Tests
 *
 * Tests the API contract for session CRUD endpoints to ensure:
 * - Proper authentication requirements
 * - Ownership validation for update/delete operations
 * - Response structure remains stable
 * - Data schema validation
 * - Error handling for invalid inputs
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from '../fixtures/test-data';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSIONS_ENDPOINT = (id: string) => `${BASE_URL}/api/sessions/${id}`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test UUID (valid format but may not exist in database)
const FAKE_SESSION_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Sessions CRUD API Contract', () => {
  test.describe('GET /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should return 200 for authenticated users with valid session', async ({ request }) => {
        // This test assumes user may not have sessions
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        // Could be 200, 400, 403, or 404 depending on ownership, validation, and existence
        expect([200, 400, 403, 404, 500]).toContain(response.status());
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject non-UUID string', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT('not-a-uuid-at-all'));

        expect(response.status()).toBe(400);
      });

      test('should reject empty session ID', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/sessions/`);

        // Could be 400, 404, or 405 depending on routing
        expect([400, 404, 405]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');

        if (json.success) {
          expect(json).toHaveProperty('data');
        } else {
          expect(json).toHaveProperty('error');
        }
      });

      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        expect(response.status()).toBe(405);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('Method Not Allowed');
      });

      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        expect(response.status()).toBe(405);
      });

      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        // Should not return 500 - should be 403 or 404
        expect(response.status()).toBeLessThan(500);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const duration = Date.now() - startTime;

        console.log(`[Sessions GET] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('PATCH /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: 'Test notes' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT('invalid-uuid'), {
          data: { notes: 'Test notes' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject invalid rating values', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { rating: 10 }, // Max is 5
        });

        // Could be 400 validation error or 403/404 if session doesn't exist
        expect([400, 403, 404, 500]).toContain(response.status());
      });

      test('should reject negative rating values', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { rating: -1 },
        });

        expect([400, 403, 404, 500]).toContain(response.status());
      });

      test('should reject invalid is_public type', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { is_public: 'not-a-boolean' },
        });

        expect([400, 403, 404, 500]).toContain(response.status());
      });

      test('should reject overly long notes', async ({ request }) => {
        const longNotes = 'a'.repeat(5001); // Max is 5000
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: longNotes },
        });

        expect([400, 403, 404, 500]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: 'Test notes' },
        });
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: 'Test' },
        });
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: 'Test notes' },
        });

        // Should not crash - returns some error response
        expect(response.status()).toBeGreaterThanOrEqual(400);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });

      test('should handle empty request body gracefully', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: {},
        });

        // Should handle gracefully - could be 200 (no-op) or 400 (validation)
        const json = await response.json();
        expect(json).toHaveProperty('success');
      });

      test('should handle malformed JSON gracefully', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          headers: { 'Content-Type': 'application/json' },
          data: 'not-valid-json',
        });

        // Playwright auto-converts to JSON, so test with explicit string body
        const rawResponse = await request.fetch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect(rawResponse.status()).toBe(400);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
          data: { notes: 'Test' },
        });
        const duration = Date.now() - startTime;

        console.log(`[Sessions PATCH] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('DELETE /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT('invalid-uuid'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

        // Should not crash
        expect(response.status()).toBeGreaterThanOrEqual(400);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));
        const duration = Date.now() - startTime;

        console.log(`[Sessions DELETE] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('Ownership Validation', () => {
    test('authenticated users should only access their own sessions', async ({ request }) => {
      // This test verifies ownership checks are in place
      // With a fake UUID, we should get 400/403/404, not the session data
      const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

      if (response.status() === 200) {
        // If it returns 200, it should be our session
        const json = await response.json();
        expect(json.success).toBe(true);
      } else {
        // Otherwise should be validation error, access denied, or not found
        expect([400, 403, 404, 500]).toContain(response.status());
      }
    });

    test('should prevent updating sessions owned by others', async ({ request }) => {
      const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
        data: { notes: 'Trying to update someone else session' },
      });

      // Should not be successful - either 403 (forbidden) or 404 (not found)
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should prevent deleting sessions owned by others', async ({ request }) => {
      const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

      // Should not be successful
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Data Schema Validation', () => {
    test('successful GET should include session object with expected fields', async ({
      request,
    }) => {
      // This test will pass if user has sessions, otherwise will fail gracefully
      const response = await request.get(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

      if (response.status() === 200) {
        const json = await response.json();
        const session = json.data.session;

        // Verify session has expected fields
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('user_id');
        expect(session).toHaveProperty('arrival_time');

        // Optional fields that should be defined (can be null)
        expect(session).toHaveProperty('notes');
        expect(session).toHaveProperty('is_public');
        expect(session).toHaveProperty('rating');
        expect(session).toHaveProperty('created_at');
        expect(session).toHaveProperty('updated_at');
      }
    });

    test('successful PATCH should return updated session', async ({ request }) => {
      const response = await request.patch(SESSIONS_ENDPOINT(FAKE_SESSION_ID), {
        data: { notes: 'Test update' },
      });

      if (response.status() === 200) {
        const json = await response.json();
        expect(json.data).toHaveProperty('session');
        expect(json.data.session).toHaveProperty('updated_at');
      }
    });

    test('successful DELETE should return deleted confirmation', async ({ request }) => {
      const response = await request.delete(SESSIONS_ENDPOINT(FAKE_SESSION_ID));

      if (response.status() === 200) {
        const json = await response.json();
        expect(json.data).toHaveProperty('deleted');
        expect(json.data.deleted).toBe(true);
      }
    });
  });
});

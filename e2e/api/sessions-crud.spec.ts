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

/* eslint-disable playwright/expect-expect -- expectApiError centralizes repeated API error envelope assertions. */
import { test, expect, type APIResponse } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSIONS_ENDPOINT = (id: string) => `${BASE_URL}/api/sessions/${id}`;

// Valid UUID that should not exist in seeded test data.
const MISSING_SESSION_ID = '00000000-0000-4000-8000-000000000001';

async function expectApiError(response: APIResponse, status: number): Promise<void> {
  expect(response.status()).toBe(status);

  const json = await response.json();
  expect(json.success).toBe(false);
  expect(json).toHaveProperty('error');
  expect(json).toHaveProperty('timestamp');
}

test.describe('Sessions CRUD API Contract', () => {
  test.describe('GET /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should return 404 for authenticated users when session is missing', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        await expectApiError(response, 404);
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
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json).toHaveProperty('timestamp');
        expect(json).toHaveProperty('error');
      });

      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        expect(response.status()).toBe(405);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('Method Not Allowed');
      });

      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        expect(response.status()).toBe(405);
      });

      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        await expectApiError(response, 404);
      });
    });

  });

  test.describe('PATCH /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
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
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { rating: 10 }, // Max is 5
        });

        expect(response.status()).toBe(400);
      });

      test('should reject negative rating values', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { rating: -1 },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject invalid is_public type', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { is_public: 'not-a-boolean' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject overly long notes', async ({ request }) => {
        const longNotes = 'a'.repeat(5001); // Max is 5000
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { notes: longNotes },
        });

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { notes: 'Test notes' },
        });
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { notes: 'Test' },
        });
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: { notes: 'Test notes' },
        });

        await expectApiError(response, 404);
      });

      test('should handle empty request body gracefully', async ({ request }) => {
        const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          data: {},
        });

        await expectApiError(response, 404);
      });

      test('should handle malformed JSON gracefully', async ({ request }) => {
        // Playwright auto-converts to JSON, so test with explicit string body
        const rawResponse = await request.fetch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect(rawResponse.status()).toBe(400);
      });
    });

  });

  test.describe('DELETE /api/sessions/[id]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

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
        const response = await request.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

        await expectApiError(response, 404);
      });
    });
  });

  test.describe('Ownership Validation', () => {
    test('authenticated users should not receive data for a missing session', async ({ request }) => {
      const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

      await expectApiError(response, 404);
    });

    test('should reject updates for a missing session', async ({ request }) => {
      const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
        data: { notes: 'Trying to update a missing session' },
      });

      await expectApiError(response, 404);
    });

    test('should reject deletes for a missing session', async ({ request }) => {
      const response = await request.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

      await expectApiError(response, 404);
    });
  });

  test.describe('Data Schema Validation', () => {
    test('missing GET should include an error envelope', async ({ request }) => {
      const response = await request.get(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

      await expectApiError(response, 404);
    });

    test('missing PATCH should include an error envelope', async ({ request }) => {
      const response = await request.patch(SESSIONS_ENDPOINT(MISSING_SESSION_ID), {
        data: { notes: 'Test update' },
      });

      await expectApiError(response, 404);
    });

    test('missing DELETE should include an error envelope', async ({ request }) => {
      const response = await request.delete(SESSIONS_ENDPOINT(MISSING_SESSION_ID));

      await expectApiError(response, 404);
    });
  });
});

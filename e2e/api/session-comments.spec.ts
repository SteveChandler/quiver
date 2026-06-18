/**
 * Session Comments API Contract Tests
 *
 * Tests the API contract for session comments endpoints to ensure:
 * - Public read access for GET (optional auth)
 * - Authentication required for POST operations
 * - Ownership validation for DELETE operations
 * - Response structure remains stable
 * - Data schema validation
 *
 * @project auth (requires authentication for write operations)
 */

/* eslint-disable playwright/expect-expect -- expectApiError centralizes repeated API error envelope assertions. */
import { test, expect, type APIResponse } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSION_COMMENTS = (sessionId: string) => `${BASE_URL}/api/sessions/${sessionId}/comments`;
const COMMENT_DELETE = (sessionId: string, commentId: string) =>
  `${BASE_URL}/api/sessions/${sessionId}/comments/${commentId}`;

// Valid UUIDs that should not exist in seeded test data.
const MISSING_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const MISSING_COMMENT_ID = '00000000-0000-4000-8000-000000000002';

async function expectApiError(response: APIResponse, status: number): Promise<void> {
  expect(response.status()).toBe(status);

  const json = await response.json();
  expect(json.success).toBe(false);
  expect(json).toHaveProperty('error');
  expect(json).toHaveProperty('timestamp');
}

test.describe('Session Comments API Contract', () => {
  test.describe('GET /api/sessions/[id]/comments', () => {
    test.describe('Authentication Requirements', () => {
      test('should allow optional authentication', async ({ request }) => {
        // The endpoint uses withAuth with { optional: true }
        // So it should work with or without auth
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
      });

      test('should work for authenticated users', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
      });

      test('should work for unauthenticated users', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject non-UUID string', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS('not-a-uuid'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(json).toHaveProperty('timestamp');
        expect(json).toHaveProperty('data');
      });

      test('should return comments array in data', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.data).toHaveProperty('comments');
        expect(json.data.comments).toEqual([]);
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Missing Session Read Contract', () => {
      test('should return an empty comments array', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.comments).toEqual([]);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with expected status', async ({ request }) => {
        // POST is handled separately - this tests wrong path
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID));

        // Could be 400 (missing body), 401 (requires auth for POST), or 405
        expect([400, 401, 405]).toContain(response.status());
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(405);
      });

      test('should handle empty results gracefully', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.comments).toEqual([]);
      });
    });
  });

  test.describe('POST /api/sessions/[id]/comments', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for authenticated users when session is missing', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        await expectApiError(response, 404);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid session UUID format', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS('invalid-uuid'), {
          data: { content: 'Test comment' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject missing content field', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: {},
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject empty content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: '' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject whitespace-only content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: '   ' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject overly long content', async ({ request }) => {
        const longContent = 'a'.repeat(2001); // Assuming max is 2000
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: longContent },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject non-string content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 12345 },
        });

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test comment' },
        });
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });

      test('should include an error envelope when session is missing', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        await expectApiError(response, 404);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test' },
        });
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle malformed JSON gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(SESSION_COMMENTS(MISSING_SESSION_ID), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect(rawResponse.status()).toBe(400);

        const json = await rawResponse.json();
        expect(json.success).toBe(false);
      });

      test('should reject invalid Content-Type header gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(SESSION_COMMENTS(MISSING_SESSION_ID), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          data: JSON.stringify({ content: 'Test' }),
        });

        expect(rawResponse.status()).toBe(400);
        const json = await rawResponse.json();
        expect(json.success).toBe(false);
      });

      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(MISSING_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        await expectApiError(response, 404);
      });
    });
  });

  test.describe('DELETE /api/sessions/[id]/comments/[commentId]', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.delete(
          COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID)
        );

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid session UUID', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE('invalid-uuid', MISSING_COMMENT_ID));

        expect(response.status()).toBe(400);
      });

      test('should reject invalid comment UUID', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(MISSING_SESSION_ID, 'invalid-uuid'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Ownership Validation', () => {
      test('should reject deleting a missing comment', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID));

        await expectApiError(response, 404);
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent comment gracefully', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID));

        await expectApiError(response, 404);
      });

      test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.get(COMMENT_DELETE(MISSING_SESSION_ID, MISSING_COMMENT_ID));

        expect(response.status()).toBe(405);
      });
    });

  });

  test.describe('Missing Session Data', () => {
    test('comments should be empty for a missing session', async ({ request }) => {
      const response = await request.get(SESSION_COMMENTS(MISSING_SESSION_ID));

      expect(response.status()).toBe(200);
      const json = await response.json();
      expect(json.data.comments).toEqual([]);
    });
  });
});

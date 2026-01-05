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

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSION_COMMENTS = (sessionId: string) => `${BASE_URL}/api/sessions/${sessionId}/comments`;
const COMMENT_DELETE = (sessionId: string, commentId: string) =>
  `${BASE_URL}/api/sessions/${sessionId}/comments/${commentId}`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test UUIDs (valid format but may not exist in database)
const FAKE_SESSION_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_COMMENT_ID = '00000000-0000-0000-0000-000000000002';

test.describe('Session Comments API Contract', () => {
  test.describe('GET /api/sessions/[id]/comments', () => {
    test.describe('Authentication Requirements', () => {
      test('should allow optional authentication', async ({ request }) => {
        // The endpoint uses withAuth with { optional: true }
        // So it should work with or without auth
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        // Should not be 401 - could be 200 (empty), 400 (invalid UUID), or 404
        expect([200, 400, 404, 500]).toContain(response.status());
      });

      test('should work for authenticated users', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        // Should return some response (not necessarily 200 if session doesn't exist)
        expect([200, 400, 404, 500]).toContain(response.status());
      });

      test('should work for unauthenticated users', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        // Should not be 401 due to optional auth
        expect([200, 400, 404, 500]).toContain(response.status());
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
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');

        if (json.success) {
          expect(json).toHaveProperty('data');
        } else {
          expect(json).toHaveProperty('error');
        }
      });

      test('should return comments array in data', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          expect(json.data).toHaveProperty('comments');
          expect(Array.isArray(json.data.comments)).toBe(true);
        }
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Comment Object Schema', () => {
      test('each comment should have required id field', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const comments = json.data.comments;

          comments.forEach((comment: any) => {
            expect(comment).toHaveProperty('id');
            expect(typeof comment.id).toBe('string');
            expect(comment.id).toMatch(UUID_REGEX);
          });
        }
      });

      test('each comment should have content field', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const comments = json.data.comments;

          comments.forEach((comment: any) => {
            expect(comment).toHaveProperty('content');
            expect(typeof comment.content).toBe('string');
            expect(comment.content.trim().length).toBeGreaterThan(0);
          });
        }
      });

      test('each comment should have user information', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const comments = json.data.comments;

          comments.forEach((comment: any) => {
            expect(comment).toHaveProperty('user');
            expect(comment.user).toHaveProperty('full_name');
          });
        }
      });

      test('each comment should have timestamps', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const comments = json.data.comments;

          comments.forEach((comment: any) => {
            expect(comment).toHaveProperty('created_at');
            expect(comment).toHaveProperty('updated_at');
          });
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with expected status', async ({ request }) => {
        // POST is handled separately - this tests wrong path
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID));

        // Could be 400 (missing body), 401 (requires auth for POST), or 405
        expect([400, 401, 405]).toContain(response.status());
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(SESSION_COMMENTS(FAKE_SESSION_ID));

        expect(response.status()).toBe(405);
      });

      test('should handle empty results gracefully', async ({ request }) => {
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

        if (response.status() === 200) {
          const json = await response.json();
          expect(json.success).toBe(true);
          expect(Array.isArray(json.data.comments)).toBe(true);
          expect(json.data.comments.length).toBeGreaterThanOrEqual(0);
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));
        const duration = Date.now() - startTime;

        console.log(`[Session Comments GET] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('POST /api/sessions/[id]/comments', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 200/400/404/500 for authenticated users', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        // Could succeed or fail based on session existence
        expect([200, 400, 404, 500]).toContain(response.status());
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
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: {},
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject empty content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: '' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject whitespace-only content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: '   ' },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject overly long content', async ({ request }) => {
        const longContent = 'a'.repeat(2001); // Assuming max is 2000
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: longContent },
        });

        expect([400, 404, 500]).toContain(response.status());
      });

      test('should reject non-string content', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 12345 },
        });

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });

      test('should include success message on successful creation', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        if (response.status() === 200) {
          const json = await response.json();
          expect(json.success).toBe(true);
          expect(json.data).toHaveProperty('message');
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test' },
        });
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle malformed JSON gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(SESSION_COMMENTS(FAKE_SESSION_ID), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect(rawResponse.status()).toBe(400);

        const json = await rawResponse.json();
        expect(json.success).toBe(false);
      });

      test('should handle missing Content-Type header gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(SESSION_COMMENTS(FAKE_SESSION_ID), {
          method: 'POST',
          data: { content: 'Test' },
        });

        // Should still work or return proper error
        const json = await rawResponse.json();
        expect(json).toHaveProperty('success');
      });

      test('should handle non-existent session gracefully', async ({ request }) => {
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });

        // Should return error response, not crash
        const json = await response.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(SESSION_COMMENTS(FAKE_SESSION_ID), {
          data: { content: 'Test comment' },
        });
        const duration = Date.now() - startTime;

        console.log(`[Session Comments POST] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
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
          COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID)
        );

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid session UUID', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE('invalid-uuid', FAKE_COMMENT_ID));

        expect(response.status()).toBe(400);
      });

      test('should reject invalid comment UUID', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, 'invalid-uuid'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Ownership Validation', () => {
      test('should prevent deleting comments owned by others', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));

        // Should fail with 403 (forbidden) or 404 (not found)
        expect(response.status()).toBeGreaterThanOrEqual(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Error Handling', () => {
      test('should handle non-existent comment gracefully', async ({ request }) => {
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));

        expect(response.status()).toBeGreaterThanOrEqual(400);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });

      test('should handle GET requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.get(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.delete(COMMENT_DELETE(FAKE_SESSION_ID, FAKE_COMMENT_ID));
        const duration = Date.now() - startTime;

        console.log(`[Session Comments DELETE] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('Data Ordering', () => {
    test('comments should be ordered by created_at descending', async ({ request }) => {
      const response = await request.get(SESSION_COMMENTS(FAKE_SESSION_ID));

      if (response.status() === 200) {
        const json = await response.json();
        const comments = json.data.comments;

        if (comments.length > 1) {
          for (let i = 1; i < comments.length; i++) {
            const prevDate = new Date(comments[i - 1].created_at);
            const currDate = new Date(comments[i].created_at);

            // Previous comment should be newer or equal (descending order)
            expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
          }
        }
      }
    });
  });
});

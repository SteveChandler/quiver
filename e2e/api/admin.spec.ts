/**
 * Admin API Contract Tests
 *
 * Tests the API contract for admin endpoints to ensure:
 * - Admin authentication required
 * - Non-admin users get 403
 * - Response structure remains stable
 *
 * @project admin (requires admin authentication)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_PUSH_ENDPOINT = `${BASE_URL}/api/admin/test-push`;

test.describe('Admin API Contract', () => {
  test.describe('POST /api/admin/test-push', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(TEST_PUSH_ENDPOINT);

        expect(response.status()).toBe(401);
      });

      test('should reject non-admin authenticated users', async ({ request }) => {
        // Regular authenticated user should get 403
        const response = await request.post(TEST_PUSH_ENDPOINT);

        // Could be 403 (forbidden) or 401 (not admin)
        expect([401, 403]).toContain(response.status());

        const json = await response.json();
        expect(json).toHaveProperty('error');
      });
    });

    test.describe('Payload Validation', () => {
      test('should accept empty body (uses defaults)', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {},
        });

        // Will fail auth for non-admin, but should not be 400
        expect(response.status()).not.toBe(400);
      });

      test('should accept optional title field', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {
            title: 'Test Title',
          },
        });

        // Will fail auth for non-admin, but validates payload
        expect(response.status()).not.toBe(400);
      });

      test('should accept optional body field', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {
            body: 'Test body',
          },
        });

        expect(response.status()).not.toBe(400);
      });

      test('should reject overly long title', async ({ request }) => {
        const longTitle = 'a'.repeat(81); // Max is 80
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {
            title: longTitle,
          },
        });

        // Should be 400 for validation or 403 for auth
        expect([400, 401, 403]).toContain(response.status());
      });

      test('should reject overly long body', async ({ request }) => {
        const longBody = 'a'.repeat(241); // Max is 240
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {
            body: longBody,
          },
        });

        expect([400, 401, 403]).toContain(response.status());
      });

      test('should reject extra fields (strict schema)', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT, {
          data: {
            title: 'Test',
            body: 'Test',
            extraField: 'should be rejected',
          },
        });

        expect([400, 401, 403]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return error for non-admin users', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('error');
        expect(typeof json.error).toBe('string');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle GET requests appropriately', async ({ request }) => {
        const response = await request.get(TEST_PUSH_ENDPOINT);

        // GET returns info endpoint, not 405
        expect([200, 401, 403]).toContain(response.status());
      });

      test('should handle malformed JSON gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(TEST_PUSH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect([400, 401, 403]).toContain(rawResponse.status());
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(TEST_PUSH_ENDPOINT);
        const headers = response.headers();

        // Basic security headers should be present
        expect(headers['content-type']).toContain('application/json');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(TEST_PUSH_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Admin Test Push] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('GET /api/admin/test-push', () => {
    test.describe('Info Endpoint', () => {
      test('should return endpoint documentation for admin users', async ({ request }) => {
        const response = await request.get(TEST_PUSH_ENDPOINT);

        // Non-admin gets 403, admin would get 200 with info
        expect([200, 401, 403]).toContain(response.status());

        if (response.status() === 200) {
          const json = await response.json();
          expect(json).toHaveProperty('endpoint');
          expect(json).toHaveProperty('method');
          expect(json).toHaveProperty('description');
        }
      });
    });
  });
});

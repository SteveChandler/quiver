/**
 * Intel Vote API Contract Tests
 *
 * Tests the API contract for intel vote, confirm, and report endpoints to ensure:
 * - Required authentication
 * - UUID validation
 * - Payload schema validation
 * - Correct error responses (400, 401, 404)
 * - Backward compatibility for /confirm endpoints
 * - V1 and V2 report reason formats
 *
 * @project auth
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const INTEL_VOTE = (id: string) => `${BASE_URL}/api/intel/${id}/vote`;
const INTEL_CONFIRM = (id: string) => `${BASE_URL}/api/intel/${id}/confirm`;
const INTEL_REPORT = (id: string) => `${BASE_URL}/api/intel/${id}/report`;

// RFC4122-valid UUID that is guaranteed not to exist in the database.
// Uses a "test" namespace (version 4, variant 8) so it passes server-side
// UUID validation (which requires version [1-5] and variant [89ab]) while
// remaining a permanently non-existent record.
const FAKE_INTEL_ID = '00000000-0000-4000-8000-000000000001';

test.describe('Intel Vote API Contract', () => {
  test.describe('POST /api/intel/[id]/vote', () => {
    test.describe('Authentication', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'helpful' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.post(INTEL_VOTE('not-a-uuid'), {
          data: { vote_type: 'helpful' },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject invalid vote_type', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'invalid' },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should reject empty body', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should reject missing vote_type field', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { some_other_field: 'value' },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with vote_type helpful', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'helpful' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with vote_type off', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'off' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with vote_type confirmed', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'confirmed' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure on error', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'helpful' },
        });

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
        expect(json.success).toBe(false);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'helpful' },
        });

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Method Not Allowed', () => {
      test('should return 405 for GET requests', async ({ request }) => {
        const response = await request.get(INTEL_VOTE(FAKE_INTEL_ID));

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(INTEL_VOTE(FAKE_INTEL_ID), {
          data: { vote_type: 'helpful' },
        });
        const duration = Date.now() - startTime;

        console.log(`[Intel POST vote] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('DELETE /api/intel/[id]/vote', () => {
    test.describe('Authentication', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.delete(INTEL_VOTE(FAKE_INTEL_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.delete(INTEL_VOTE('not-a-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post', async ({ request }) => {
        const response = await request.delete(INTEL_VOTE(FAKE_INTEL_ID));

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure on error', async ({ request }) => {
        const response = await request.delete(INTEL_VOTE(FAKE_INTEL_ID));

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.delete(INTEL_VOTE(FAKE_INTEL_ID));

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });
  });

  test.describe('Backward Compatibility — /api/intel/[id]/confirm', () => {
    test.describe('POST /api/intel/[id]/confirm', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should return 404 for non-existent post (delegates to intel_votes)', async ({ request }) => {
        // This endpoint now delegates to intel_votes under the hood.
        // Should still be 404 (post doesn't exist), NOT 500.
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });

      test('should include security headers', async ({ request }) => {
        const response = await request.post(INTEL_CONFIRM(FAKE_INTEL_ID));

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });

      test('should return 405 for GET requests', async ({ request }) => {
        const response = await request.get(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(405);
      });
    });

    test.describe('DELETE /api/intel/[id]/confirm', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.delete(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.delete(INTEL_CONFIRM('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post', async ({ request }) => {
        const response = await request.delete(INTEL_CONFIRM(FAKE_INTEL_ID));

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });
  });

  test.describe('POST /api/intel/[id]/report', () => {
    test.describe('Authentication', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'spam' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.post(INTEL_REPORT('not-a-uuid'), {
          data: { reason: 'spam' },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with V2 structured reason (spam)', async ({ request }) => {
        // 404 because post does not exist, NOT 400/500
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'spam', details: 'Test spam report' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with V2 reason (harassment)', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'harassment' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with V2 reason (dangerous)', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'dangerous' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with V2 reason (false_info)', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'false_info' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 404 for non-existent post with V2 reason (other)', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'other' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should accept V1 legacy freetext reason', async ({ request }) => {
        // V1 schema allows any string as the reason.
        // 404 because post doesn't exist, NOT 400/500.
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'Inappropriate content' },
        });

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should accept request with no body (reason is optional in V1)', async ({ request }) => {
        // The report route gracefully handles missing/invalid body by continuing without reason.
        // Should still reach the existence check and return 404, NOT 400/500.
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID));

        expect(response.status()).toBe(404);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure on error', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'spam' },
        });

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'spam' },
        });

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Method Not Allowed', () => {
      test('should return 405 for GET requests', async ({ request }) => {
        const response = await request.get(INTEL_REPORT(FAKE_INTEL_ID));

        expect(response.status()).toBe(405);
      });

      test('should return 405 for DELETE requests', async ({ request }) => {
        const response = await request.delete(INTEL_REPORT(FAKE_INTEL_ID));

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.post(INTEL_REPORT(FAKE_INTEL_ID), {
          data: { reason: 'spam' },
        });
        const duration = Date.now() - startTime;

        console.log(`[Intel POST report] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });
});

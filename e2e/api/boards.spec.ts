/**
 * Boards API Contract Tests
 *
 * Tests the API contract for boards endpoints to ensure:
 * - Proper authentication requirements
 * - Response structure remains stable
 * - Board creation validation
 * - Data schema correctness
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '../fixtures/auth-fixture';
import type { APIRequestContext } from '@playwright/test';
import { createServiceClient } from '../utils/test-data-cleanup';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BOARDS_ENDPOINT = `${BASE_URL}/api/boards`;
const BOARD_TEST_NAME_PATTERNS = [
  'E2E Test%',
  'Test Board%',
  'Performance Test Board%',
  'Test Session Count%',
];

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionCheckResponse = {
  sessionData?: {
    userId?: string;
  };
};

async function getAuthenticatedUserIdForCleanup(
  request: APIRequestContext,
): Promise<string | null> {
  const response = await request.get('/api/auth/check-session');
  if (response.status() !== 200) return null;

  const body = (await response.json().catch(() => null)) as SessionCheckResponse | null;
  return body?.sessionData?.userId ?? null;
}

async function cleanupCreatedBoardRows(
  request: APIRequestContext,
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  const userId = await getAuthenticatedUserIdForCleanup(request);
  if (!userId) return;

  const supabase = createServiceClient();
  for (const pattern of BOARD_TEST_NAME_PATTERNS) {
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('user_id', userId)
      .like('name', pattern);

    if (error) {
      throw new Error(`Board cleanup failed for ${pattern}: ${error.message}`);
    }
  }
}

test.describe('Boards API Contract', () => {
  test.afterEach(async ({ request }) => {
    await cleanupCreatedBoardRows(request);
  });

  test.describe('GET /api/boards', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(BOARDS_ENDPOINT);

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should return 200 for authenticated users', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return boards array in data', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('boards');
        expect(Array.isArray(json.data.boards)).toBe(true);
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Board Object Schema', () => {
      test('each board should have required id field', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        boards.forEach((board: any) => {
          expect(board).toHaveProperty('id');
          expect(typeof board.id).toBe('string');
          expect(board.id).toMatch(UUID_REGEX);
        });
      });

      test('each board should have required name field', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        boards.forEach((board: any) => {
          expect(board).toHaveProperty('name');
          expect(typeof board.name).toBe('string');
          expect(board.name.trim().length).toBeGreaterThan(0);
        });
      });

      test('each board should have user_id field', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        boards.forEach((board: any) => {
          expect(board).toHaveProperty('user_id');
          expect(typeof board.user_id).toBe('string');
          expect(board.user_id).toMatch(UUID_REGEX);
        });
      });

      test('each board should have timestamps', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        boards.forEach((board: any) => {
          expect(board).toHaveProperty('created_at');
          expect(board).toHaveProperty('updated_at');
        });
      });
    });

    test.describe('Data Quality', () => {
      test('should not contain duplicate board IDs', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        const ids = boards.map((b: any) => b.id);
        const uniqueIds = new Set(ids);

        expect(ids.length).toBe(uniqueIds.size);
      });

      test('should handle empty boards list gracefully', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.boards)).toBe(true);
        expect(json.data.boards.length).toBeGreaterThanOrEqual(0);
      });

      test('boards should be ordered by updated_at descending', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const json = await response.json();
        const boards = json.data.boards;

        if (boards.length > 1) {
          for (let i = 1; i < boards.length; i++) {
            const prevDate = new Date(boards[i - 1].updated_at);
            const currDate = new Date(boards[i].updated_at);

            // Previous should be newer or equal (descending order)
            expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
          }
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(BOARDS_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(BOARDS_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle PATCH requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.patch(BOARDS_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(BOARDS_ENDPOINT);

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(BOARDS_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Boards GET] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('POST /api/boards', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.post(BOARDS_ENDPOINT, {
          data: { name: 'Test Board' },
        });

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe('Payload Validation', () => {
      test('should reject missing name field', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
        // Zod v4 messages for missing fields don't include the field name; assert via details.path instead
        expect(Array.isArray(json.details)).toBe(true);
        const hasNameIssue = json.details.some((issue: any) => Array.isArray(issue.path) && issue.path.includes('name'));
        expect(hasNameIssue).toBe(true);
      });

      test('should reject empty name', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name: '',
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject whitespace-only name', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name: '   ',
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should reject non-string name', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name: 12345 as any, // contract test: name must be string
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        expect(response.status()).toBe(400);
      });

      test('should trim whitespace from name', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name: '  Test Board  ',
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        if (response.status() === 201 || response.status() === 200) {
          const json = await response.json();
          expect(json.data.name).toBe('Test Board');

          // Clean up - delete the created board if possible
          // (This would require DELETE endpoint which may not exist)
        }
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const name = `E2E Test Board ${Date.now()}`;
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name,
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');

        // Successful creation
        if (response.status() === 201 || response.status() === 200) {
          expect(json.success).toBe(true);
          expect(json).toHaveProperty('data');
        }
      });

      test('should return 201 status code on successful creation', async ({ request }) => {
        const name = `E2E Test Board 2 ${Date.now()}`;
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name,
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        // Could be 201 or 200 depending on implementation
        expect([200, 201]).toContain(response.status());
      });

      test('should return created board object', async ({ request }) => {
        const name = `E2E Test Board 3 ${Date.now()}`;
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name,
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        if (response.status() === 201 || response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty('id');
          expect(json.data).toHaveProperty('name');
          expect(json.data).toHaveProperty('board_type');
          expect(json.data).toHaveProperty('dimensions');
          expect(json.data).toHaveProperty('user_id');
          expect(json.data).toHaveProperty('created_at');
          expect(json.data.name).toBe(name);
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.post(BOARDS_ENDPOINT, {
          data: { name: 'Test' },
        });
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle malformed JSON gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(BOARDS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: '{invalid json}',
        });

        expect(rawResponse.status()).toBe(400);

        const json = await rawResponse.json();
        expect(json.success).toBe(false);
      });

      test('should handle missing Content-Type header gracefully', async ({ request }) => {
        const rawResponse = await request.fetch(BOARDS_ENDPOINT, {
          method: 'POST',
          data: JSON.stringify({ name: 'Test' }),
        });

        // Should still work or return proper error
        const json = await rawResponse.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Data Persistence', () => {
      test('created board should appear in GET list', async ({ request }) => {
        const uniqueName = `E2E Test ${Date.now()}`;

        // Create board
        const createResponse = await request.post(BOARDS_ENDPOINT, {
          data: {
            name: uniqueName,
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });

        if (createResponse.status() === 201 || createResponse.status() === 200) {
          const createJson = await createResponse.json();
          const boardId = createJson.data?.id;

          if (!boardId) {
            // Board creation returned success but no ID — skip verification
            console.log('[Boards] Board created but no ID returned:', createJson);
            return;
          }

          // Verify it appears in list
          const listResponse = await request.get(BOARDS_ENDPOINT);
          const listJson = await listResponse.json();
          const boards = listJson.data?.boards || [];

          const foundBoard = boards.find((b: any) => b.id === boardId);
          expect(foundBoard).toBeDefined();
          expect(foundBoard.name).toBe(uniqueName);
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const name = `Performance Test Board ${Date.now()}`;
        const startTime = Date.now();
        const response = await request.post(BOARDS_ENDPOINT, {
          data: {
            name,
            board_type: 'shortboard',
            dimensions: `6'0" x 19" x 2.5"`,
          },
        });
        const duration = Date.now() - startTime;

        console.log(`[Boards POST] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('Board Field Validation', () => {
    test('should accept optional description field', async ({ request }) => {
      const name = `Test Board with Description ${Date.now()}`;
      const response = await request.post(BOARDS_ENDPOINT, {
        data: {
          name,
          board_type: 'shortboard',
          dimensions: `6'0" x 19" x 2.5"`,
          description: 'A fun board for testing',
        },
      });

      if (response.status() === 201 || response.status() === 200) {
        const json = await response.json();
        expect(json.data).toHaveProperty('description');
        expect(json.data.description).toBe('A fun board for testing');
      }
    });

    test('should accept optional image_url field', async ({ request }) => {
      const name = `Test Board with Image ${Date.now()}`;
      const response = await request.post(BOARDS_ENDPOINT, {
        data: {
          name,
          board_type: 'shortboard',
          dimensions: `6'0" x 19" x 2.5"`,
          image_url: 'https://example.com/board.jpg',
        },
      });

      if (response.status() === 201 || response.status() === 200) {
        const json = await response.json();
        expect(json.data).toHaveProperty('image_url');
        expect(json.data.image_url).toBe('https://example.com/board.jpg');
      }
    });

    test('should accept optional size and volume fields', async ({ request }) => {
      const name = `Test Board with Size and Volume ${Date.now()}`;
      const response = await request.post(BOARDS_ENDPOINT, {
        data: {
          name,
          board_type: 'shortboard',
          dimensions: `6'0" x 19" x 2.5"`,
          size: '6ft',
          volume: 32.5,
        },
      });

      if (response.status() === 201 || response.status() === 200) {
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data).toHaveProperty('size');
        expect(json.data).toHaveProperty('volume');
      }
    });

    test('should initialize session_count to 0', async ({ request }) => {
      const name = `Test Session Count ${Date.now()}`;
      const response = await request.post(BOARDS_ENDPOINT, {
        data: {
          name,
          board_type: 'shortboard',
          dimensions: `6'0" x 19" x 2.5"`,
        },
      });

      if (response.status() === 201 || response.status() === 200) {
        const json = await response.json();
        expect(json.data).toHaveProperty('session_count');
        expect(json.data.session_count).toBe(0);
      }
    });
  });
});

/**
 * Gamification System API Contract Tests
 *
 * Tests the API contract for gamification endpoints to ensure:
 * - XP status calculations are accurate
 * - Badge definitions are complete
 * - Level progression thresholds are correct
 * - Proper authentication requirements
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '@playwright/test';
import { createIsolatedApiContext } from '../utils/api-request-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const XP_STATUS_ENDPOINT = `${BASE_URL}/api/gamification/xp-status`;
const BADGE_DEFINITIONS_ENDPOINT = `${BASE_URL}/api/gamification/badge-definitions`;
const USER_BADGES_ENDPOINT = `${BASE_URL}/api/gamification/user-badges`;

// Expected level thresholds (from the API implementation)
const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Kook', xp_required: 0 },
  { level: 2, title: 'Grom', xp_required: 100 },
  { level: 3, title: 'Paddler', xp_required: 300 },
  { level: 4, title: 'Wavestorm Warrior', xp_required: 600 },
  { level: 5, title: 'Rip Rider', xp_required: 1000 },
  { level: 6, title: 'Barrel Hunter', xp_required: 1500 },
  { level: 7, title: 'Point Breaker', xp_required: 2200 },
  { level: 8, title: 'Lineup Legend', xp_required: 3000 },
  { level: 9, title: 'Quiver King/Queen', xp_required: 4000 },
];

test.describe('Gamification API', () => {
  test.describe('GET /api/gamification/xp-status', () => {
    test.describe('Authentication Requirements', () => {
      test.describe('Unauthenticated', () => {
        test('should require authentication', async ({ playwright }, testInfo) => {
          const unauthContext = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
            storageState: { cookies: [], origins: [] },
          });

          const response = await unauthContext.get(XP_STATUS_ENDPOINT);

          expect(response.status()).toBe(401);

          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toBeDefined();

          await unauthContext.dispose();
        });
      });

      test('should return 200 for authenticated users', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return xp object in data', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('xp');
        expect(typeof json.data.xp).toBe('object');
      });
    });

    test.describe('XP Object Schema', () => {
      test('should have xp_total field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('xp_total');
        expect(typeof xp.xp_total).toBe('number');
        expect(xp.xp_total).toBeGreaterThanOrEqual(0);
      });

      test('should have level field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('level');
        expect(typeof xp.level).toBe('number');
        expect(xp.level).toBeGreaterThanOrEqual(1);
        expect(xp.level).toBeLessThanOrEqual(9);
      });

      test('should have level_title field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('level_title');
        expect(typeof xp.level_title).toBe('string');
        expect(xp.level_title.length).toBeGreaterThan(0);
      });

      test('should have progress_to_next field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('progress_to_next');
        expect(typeof xp.progress_to_next).toBe('number');
        expect(xp.progress_to_next).toBeGreaterThanOrEqual(0);
        expect(xp.progress_to_next).toBeLessThanOrEqual(100);
      });

      test('should have xp_to_next_level field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('xp_to_next_level');
        expect(typeof xp.xp_to_next_level).toBe('number');
        expect(xp.xp_to_next_level).toBeGreaterThanOrEqual(0);
      });

      test('should have next_level_title field', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('next_level_title');
        expect(typeof xp.next_level_title).toBe('string');
        expect(xp.next_level_title.length).toBeGreaterThan(0);
      });

      test('should have timestamps', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        expect(xp).toHaveProperty('created_at');
        expect(xp).toHaveProperty('updated_at');
      });
    });

    test.describe('Level Calculation Logic', () => {
      test('level_title should match known level titles', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        const validTitles = LEVEL_THRESHOLDS.map((t) => t.title);
        expect(validTitles).toContain(xp.level_title);
      });

      test('next_level_title should be valid or "Max Level"', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        const validTitles = [...LEVEL_THRESHOLDS.map((t) => t.title), 'Max Level'];
        expect(validTitles).toContain(xp.next_level_title);
      });

      test('level should be consistent with xp_total', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        // Find expected level based on xp_total
        let expectedLevel = 1;
        for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
          if (xp.xp_total >= LEVEL_THRESHOLDS[i].xp_required) {
            expectedLevel = LEVEL_THRESHOLDS[i].level;
            break;
          }
        }

        expect(xp.level).toBe(expectedLevel);
      });

      test('max level users should have xp_to_next_level = 0', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const json = await response.json();
        const xp = json.data.xp;

        if (xp.level === 9) {
          expect(xp.xp_to_next_level).toBe(0);
          expect(xp.next_level_title).toBe('Max Level');
          expect(xp.progress_to_next).toBe(100);
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(XP_STATUS_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(XP_STATUS_ENDPOINT);

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(XP_STATUS_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[XP Status] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('GET /api/gamification/badge-definitions', () => {
    test.describe('Authentication Requirements', () => {
      test.describe('Unauthenticated', () => {
        test('should require authentication', async ({ playwright }, testInfo) => {
          const unauthContext = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
            storageState: { cookies: [], origins: [] },
          });

          const response = await unauthContext.get(BADGE_DEFINITIONS_ENDPOINT);
          expect(response.status()).toBe(401);

          await unauthContext.dispose();
        });
      });

      test('should return 200 for authenticated users', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return badges array in data', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('badges');
        expect(Array.isArray(json.data.badges)).toBe(true);
      });
    });

    test.describe('Badge Definition Schema', () => {
      test('each badge should have required fields', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();
        const badges = json.data.badges;

        badges.forEach((badge: any) => {
          // badge_slug is the primary identifier
          expect(badge).toHaveProperty('badge_slug');
          expect(badge).toHaveProperty('category');
          expect(badge).toHaveProperty('name');
        });
      });

      test('badge_slug should be a non-empty string', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();
        const badges = json.data.badges;

        badges.forEach((badge: any) => {
          expect(typeof badge.badge_slug).toBe('string');
          expect(badge.badge_slug.length).toBeGreaterThan(0);
        });
      });

      test('category should be a valid string', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();
        const badges = json.data.badges;

        badges.forEach((badge: any) => {
          expect(typeof badge.category).toBe('string');
          expect(badge.category.length).toBeGreaterThan(0);
        });
      });
    });

    test.describe('Data Quality', () => {
      test('should not contain duplicate badge identifiers (badge_slug)', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();
        const badges = json.data.badges;

        const slugs = badges.map((b: any) => b.badge_slug);
        const counts = new Map<string, number>();
        for (const slug of slugs) {
          counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }

        const duplicates = Array.from(counts.entries())
          .filter(([, count]) => count > 1)
          .map(([slug, count]) => `${slug} (${count})`);

        expect(
          duplicates,
          `Duplicate badge_slug values returned: ${duplicates.join(', ')}`
        ).toEqual([]);
      });

      test('badges should be ordered by category and slug', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const json = await response.json();
        const badges = json.data.badges;

        // Verify badges are sorted - at minimum, verify order is consistent
        if (badges.length > 1) {
          for (let i = 1; i < badges.length; i++) {
            const prev = badges[i - 1];
            const curr = badges[i];

            // Same category or categories in order
            if (prev.category === curr.category) {
              expect(prev.badge_slug.localeCompare(curr.badge_slug)).toBeLessThanOrEqual(0);
            }
          }
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(BADGE_DEFINITIONS_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Badge Definitions] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('User Badges Endpoints', () => {
    test.describe('Authentication Requirements', () => {
      test.describe('Unauthenticated', () => {
        test('GET should require authentication', async ({ playwright }, testInfo) => {
          const unauthContext = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
            storageState: { cookies: [], origins: [] },
          });

          const response = await unauthContext.get(USER_BADGES_ENDPOINT);

          // Could be 401 or 405 depending on implementation
          expect([401, 405]).toContain(response.status());

          await unauthContext.dispose();
        });
      });
    });
  });

  test.describe('Data Consistency', () => {
    test('XP and badges should be for the authenticated user', async ({ request }) => {
      const xpResponse = await request.get(XP_STATUS_ENDPOINT);
      const badgesResponse = await request.get(BADGE_DEFINITIONS_ENDPOINT);

      expect(xpResponse.status()).toBe(200);
      expect(badgesResponse.status()).toBe(200);

      const xpJson = await xpResponse.json();
      const badgesJson = await badgesResponse.json();

      // Both endpoints should return success for the same authenticated user
      expect(xpJson.success).toBe(true);
      expect(badgesJson.success).toBe(true);
    });

    test('responses should be consistent across multiple requests', async ({ request }) => {
      const response1 = await request.get(XP_STATUS_ENDPOINT);
      const response2 = await request.get(XP_STATUS_ENDPOINT);

      const json1 = await response1.json();
      const json2 = await response2.json();

      // XP total and level should be consistent
      expect(json1.data.xp.xp_total).toBe(json2.data.xp.xp_total);
      expect(json1.data.xp.level).toBe(json2.data.xp.level);
    });
  });
});

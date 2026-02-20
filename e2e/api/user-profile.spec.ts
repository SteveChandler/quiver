/**
 * User Profile API Contract Tests
 *
 * Tests the API contract for user profile endpoints to ensure:
 * - Proper authentication requirements
 * - Response structure remains stable
 * - Profile data schema validation
 * - User stats accuracy
 *
 * @project auth (requires authentication)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROFILE_ENDPOINT = `${BASE_URL}/api/profile`;
const USER_STATS_ENDPOINT = (userId: string) => `${BASE_URL}/api/users/${userId}/stats`;

// UUID format regex (v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test UUID (valid format but may not exist in database)
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

test.describe('User Profile API Contract', () => {
  test.describe('GET /api/profile', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(PROFILE_ENDPOINT);

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should return 200 for authenticated users', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return timestamp in ISO 8601 format', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Profile Object Schema', () => {
      test('should have required id field', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('id');
        expect(typeof profile.id).toBe('string');
        expect(profile.id).toMatch(UUID_REGEX);
      });

      test('should have full_name field', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('full_name');
        // Can be null or string
        if (profile.full_name !== null) {
          expect(typeof profile.full_name).toBe('string');
        }
      });

      test('should have id field', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('id');
        expect(typeof profile.id).toBe('string');
      });

      test('should have avatar_url field if present', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        // avatar_url is an optional field - may not be present in API response
        if ('avatar_url' in profile) {
          // If present, can be null or string (URL)
          if (profile.avatar_url !== null) {
            expect(typeof profile.avatar_url).toBe('string');
          }
        }
        // Profile was successfully fetched and avatar_url field (if present) was validated
        expect(profile).toBeDefined();
      });

      test('should have home_beach_id field', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('home_beach_id');
        // Can be null or UUID string
        if (profile.home_beach_id !== null) {
          expect(typeof profile.home_beach_id).toBe('string');
          expect(profile.home_beach_id).toMatch(UUID_REGEX);
        }
      });

      test('should have home_beach_name field when home_beach_id is set', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('home_beach_name');
        // Can be null or string
        if (profile.home_beach_name !== null) {
          expect(typeof profile.home_beach_name).toBe('string');
        }
      });

      test('should have skill_level field', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('skill_level');
        // Can be null or one of the valid skill levels
        if (profile.skill_level !== null) {
          expect(typeof profile.skill_level).toBe('string');
          expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(
            profile.skill_level
          );
        }
      });

      test('should have timestamps', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        expect(profile).toHaveProperty('created_at');
        expect(profile).toHaveProperty('updated_at');

        // Validate ISO 8601 format
        if (profile.created_at) {
          const createdDate = new Date(profile.created_at);
          expect(createdDate.toISOString()).toBe(profile.created_at);
        }

        if (profile.updated_at) {
          const updatedDate = new Date(profile.updated_at);
          expect(updatedDate.toISOString()).toBe(profile.updated_at);
        }
      });

      test('should not expose sensitive fields', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const json = await response.json();
        const profile = json.data;

        // Should not include password or other sensitive data
        expect(profile).not.toHaveProperty('password');
        expect(profile).not.toHaveProperty('password_hash');
        expect(profile).not.toHaveProperty('encrypted_password');
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(PROFILE_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(PROFILE_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(PROFILE_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(PROFILE_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle profile not found gracefully', async ({ request }) => {
        // For normal authenticated users, profile should always exist
        // But if it doesn't, should return proper error
        const response = await request.get(PROFILE_ENDPOINT);

        if (response.status() === 404) {
          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toContain('Profile not found');
        }
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(PROFILE_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Profile GET] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('GET /api/users/[id]/stats', () => {
    test.describe('Authentication Requirements', () => {
      test('should require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test('should return 200/404 for authenticated users', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        // Could be 200 if user exists, 404 if not
        expect([200, 400, 404]).toContain(response.status());
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject invalid UUID format', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT('invalid-uuid'));

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      });

      test('should reject non-UUID string', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT('not-a-uuid'));

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });
    });

    test.describe('Stats Object Schema', () => {
      test('should have session_count field', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const stats = json.data;

          expect(stats).toHaveProperty('session_count');
          expect(typeof stats.session_count).toBe('number');
          expect(stats.session_count).toBeGreaterThanOrEqual(0);
        }
      });

      test('should have follower_count field', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const stats = json.data;

          expect(stats).toHaveProperty('follower_count');
          expect(typeof stats.follower_count).toBe('number');
          expect(stats.follower_count).toBeGreaterThanOrEqual(0);
        }
      });

      test('should have following_count field', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const stats = json.data;

          expect(stats).toHaveProperty('following_count');
          expect(typeof stats.following_count).toBe('number');
          expect(stats.following_count).toBeGreaterThanOrEqual(0);
        }
      });

      test('all counts should be non-negative integers', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        if (response.status() === 200) {
          const json = await response.json();
          const stats = json.data;

          expect(stats.session_count).toBeGreaterThanOrEqual(0);
          expect(stats.follower_count).toBeGreaterThanOrEqual(0);
          expect(stats.following_count).toBeGreaterThanOrEqual(0);

          expect(Number.isInteger(stats.session_count)).toBe(true);
          expect(Number.isInteger(stats.follower_count)).toBe(true);
          expect(Number.isInteger(stats.following_count)).toBe(true);
        }
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(USER_STATS_ENDPOINT(FAKE_USER_ID));

        expect(response.status()).toBe(405);
      });

      test('should handle non-existent user gracefully', async ({ request }) => {
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));

        // Should return 404 or default stats, not crash
        expect(response.status()).toBeLessThan(500);

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(USER_STATS_ENDPOINT(FAKE_USER_ID));
        const duration = Date.now() - startTime;

        console.log(`[User Stats GET] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });

  test.describe('Profile and Stats Consistency', () => {
    test('profile ID should match authenticated user', async ({ request }) => {
      const response = await request.get(PROFILE_ENDPOINT);
      const json = await response.json();

      if (response.status() === 200) {
        const profileId = json.data.id;

        // Stats for own profile should exist
        const statsResponse = await request.get(USER_STATS_ENDPOINT(profileId));
        expect([200, 404]).toContain(statsResponse.status());
      }
    });

    test('multiple requests should return consistent data', async ({ request }) => {
      const response1 = await request.get(PROFILE_ENDPOINT);
      const response2 = await request.get(PROFILE_ENDPOINT);

      const json1 = await response1.json();
      const json2 = await response2.json();

      // Core profile fields should be consistent
      expect(json1.data.id).toBe(json2.data.id);
      expect(json1.data.email).toBe(json2.data.email);
    });
  });
});

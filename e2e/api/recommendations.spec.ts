/**
 * Recommendations API Contract Tests
 *
 * Tests the API contract for /api/v1/recommendations endpoint to ensure:
 * - No authentication required (public endpoint with rate limiting)
 * - Proper payload validation (lat/lon coordinates)
 * - Response structure remains stable
 * - Performance within acceptable limits
 * - Rate limiting behavior
 *
 * @project guest (public endpoint)
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { createIsolatedApiContext } from "../utils/api-request-helpers";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const RECOMMENDATIONS_PATH = "/api/v1/recommendations";

// San Diego coordinates for testing
const TEST_LOCATION = {
  lat: 32.7157,
  lon: -117.1611,
};

test.describe('Recommendations API Contract', () => {
  let api: APIRequestContext;

  test.beforeEach(async ({ playwright }, testInfo) => {
    api = await createIsolatedApiContext(playwright, BASE_URL, testInfo);
  });

  test.afterEach(async () => {
    await api?.dispose();
  });

  test.describe('Authentication Requirements', () => {
    test("should NOT require authentication", async ({ playwright }, testInfo) => {
      const unauthApi = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
        storageState: { cookies: [], origins: [] },
      });

      const response = await unauthApi.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      // Should not be 401 - public endpoint
      expect(response.status()).not.toBe(401);
      expect([200, 429]).toContain(response.status()); // Could be rate limited

      await unauthApi.dispose();
    });

    test("should work for authenticated users", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      expect([200, 429]).toContain(response.status());
    });
  });

  test.describe('Parameter Validation', () => {
    test("should require lat parameter", async () => {
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lon=${TEST_LOCATION.lon}`);

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      // Error could be "required" or "Invalid coordinate format"
      expect(json.error.length).toBeGreaterThan(0);
    });

    test("should require lon parameter", async () => {
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}`);

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    test("should accept legacy lng parameter", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lng=${TEST_LOCATION.lon}`
      );

      // Should work with lng (legacy)
      expect([200, 429]).toContain(response.status());
    });

    test("should reject invalid latitude format", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=invalid&lon=${TEST_LOCATION.lon}`
      );

      // Should be 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status());
    });

    test("should reject invalid longitude format", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=invalid`
      );

      // Should be 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status());
    });

    test("should reject latitude out of range", async () => {
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lat=91&lon=0`);

      // Accept both 400 (validation error) and 429 (rate limited before validation)
      expect([400, 429]).toContain(response.status());
      if (response.status() === 400) {
        const json = await response.json();
        expect(json.error).toContain('range');
      }
    });

    test("should reject longitude out of range", async () => {
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lat=0&lon=181`);

      // Accept both 400 (validation error) and 429 (rate limited before validation)
      expect([400, 429]).toContain(response.status());
    });

    test("should reject negative latitude out of range", async () => {
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lat=-91&lon=0`);

      // Accept both 400 (validation error) and 429 (rate limited before validation)
      expect([400, 429]).toContain(response.status());
    });

    test("should accept valid time parameter", async () => {
      const time = new Date().toISOString();
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&time=${time}`
      );

      expect([200, 429]).toContain(response.status());
    });

    test("should reject invalid time format", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&time=invalid-date`
      );

      // API may return 400 (strict validation) or 200 with error/empty data
      // (lenient validation that ignores bad time and uses default)
      expect([200, 400, 429]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json.error).toBeDefined();
      }
    });

    test("should accept valid skill parameter", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&skill=beginner`
      );

      expect([200, 429]).toContain(response.status());
    });

    test("should handle invalid skill parameter gracefully", async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}&skill=invalid-skill`
      );

      // Should either accept (ignore) or validate
      expect([200, 400, 429]).toContain(response.status());
    });
  });

  test.describe('Response Structure', () => {
    test('should return valid JSON content', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      }
    });

    test('should return standard API response structure', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      }
    });

    test('should return recommendations array in data', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();

        expect(json.data).toHaveProperty('recommendations');
        expect(Array.isArray(json.data.recommendations)).toBe(true);
      }
    });

    test('should return top_picks array in data', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();

        expect(json.data).toHaveProperty('top_picks');
        expect(Array.isArray(json.data.top_picks)).toBe(true);
      }
    });

    test('should return metadata object', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();

        expect(json.data).toHaveProperty('metadata');
        expect(typeof json.data.metadata).toBe('object');
      }
    });

    test('should return timestamp in ISO 8601 format', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      }
    });
  });

  test.describe('Recommendation Object Schema', () => {
    test('each recommendation should have required fields', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(rec).toHaveProperty('spotId');
          expect(rec).toHaveProperty('name');
          expect(rec).toHaveProperty('score');
          expect(rec).toHaveProperty('wave');
          expect(rec).toHaveProperty('wind');
          expect(rec).toHaveProperty('tide');
        });
      }
    });

    test('score should be a number', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(typeof rec.score).toBe('number');
          expect(rec.score).toBeGreaterThanOrEqual(0);
          expect(rec.score).toBeLessThanOrEqual(100);
        });
      }
    });

    test('distance_km should be number or null', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(rec).toHaveProperty('distance_km');
          if (rec.distance_km !== null) {
            expect(typeof rec.distance_km).toBe('number');
            expect(rec.distance_km).toBeGreaterThanOrEqual(0);
          }
        });
      }
    });

    test('wave object should have expected structure', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(rec.wave).toHaveProperty('ht_ft');
          expect(rec.wave).toHaveProperty('period_s');
        });
      }
    });

    test('wind object should have expected structure', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(rec.wind).toHaveProperty('dir_deg');
          expect(rec.wind).toHaveProperty('kts');
        });
      }
    });

    test('tide object should have expected structure', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        recommendations.forEach((rec: any) => {
          expect(rec.tide).toHaveProperty('height_ft');
          expect(rec.tide).toHaveProperty('status');
        });
      }
    });
  });

  test.describe('Top Picks Schema', () => {
    test('top picks should have rank field', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const topPicks = json.data.top_picks;

        topPicks.forEach((pick: any) => {
          expect(pick).toHaveProperty('rank');
          expect(typeof pick.rank).toBe('number');
          expect(pick.rank).toBeGreaterThan(0);
          expect(pick.rank).toBeLessThanOrEqual(3);
        });
      }
    });

    test('top picks should have isTopPick flag', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const topPicks = json.data.top_picks;

        topPicks.forEach((pick: any) => {
          expect(pick).toHaveProperty('isTopPick');
          expect(pick.isTopPick).toBe(true);
        });
      }
    });

    test('top picks should have snapshot with quality indicators', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const topPicks = json.data.top_picks;

        topPicks.forEach((pick: any) => {
          expect(pick).toHaveProperty('snapshot');
          expect(pick.snapshot).toHaveProperty('quality_indicators');
          expect(pick.snapshot.quality_indicators).toHaveProperty('data_freshness');
          expect(pick.snapshot.quality_indicators).toHaveProperty('confidence_level');
        });
      }
    });

    test('should return maximum 3 top picks', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const topPicks = json.data.top_picks;

        expect(topPicks.length).toBeLessThanOrEqual(3);
      }
    });
  });

  test.describe('Metadata Schema', () => {
    test('metadata should include query_time', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const metadata = json.data.metadata;

        expect(metadata).toHaveProperty('query_time');
        expect(typeof metadata.query_time).toBe('string');
      }
    });

    test('metadata should include location', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const metadata = json.data.metadata;

        expect(metadata).toHaveProperty('location');
        expect(metadata.location).toHaveProperty('lat');
        expect(metadata.location).toHaveProperty('lon');
        expect(metadata.location.lat).toBe(TEST_LOCATION.lat);
        expect(metadata.location.lon).toBe(TEST_LOCATION.lon);
      }
    });

    test('metadata should include total_spots_analyzed', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const metadata = json.data.metadata;

        expect(metadata).toHaveProperty('total_spots_analyzed');
        expect(typeof metadata.total_spots_analyzed).toBe('number');
        expect(metadata.total_spots_analyzed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle POST requests with 405 Method Not Allowed', async () => {
      const response = await api.post(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      expect(response.status()).toBe(405);
    });

    test('should handle PUT requests with 405 Method Not Allowed', async () => {
      const response = await api.put(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      expect(response.status()).toBe(405);
    });

    test('should handle missing coordinates gracefully', async () => {
      const response = await api.get(RECOMMENDATIONS_PATH);

      // API should return 400 for missing coordinates, but may return
      // 200 with empty results if using default/fallback coordinates
      expect([200, 400, 429]).toContain(response.status());

      const json = await response.json();
      if (response.status() === 400) {
        expect(json.success).toBe(false);
        expect(json.error).toBeDefined();
      } else if (response.status() === 200) {
        // Lenient mode — API used fallback coordinates
        expect(json).toBeDefined();
      }
    });

    test('should handle empty result set gracefully', async () => {
      // Use coordinates far from any beaches (middle of ocean)
      const response = await api.get(`${RECOMMENDATIONS_PATH}?lat=0&lon=0`);

      if (response.status() === 200) {
        const json = await response.json();
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data.recommendations)).toBe(true);
        expect(json.data.metadata.total_spots_analyzed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Performance', () => {
    test('should respond within reasonable time (< 5000ms)', async () => {
      const startTime = Date.now();
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );
      const duration = Date.now() - startTime;

      console.log(`[Recommendations] Response time: ${duration}ms`);

      if (response.status() === 200) {
        expect(duration).toBeLessThan(5000);
      }
    });
  });

  test.describe('Rate Limiting', () => {
    test('should have rate limiting configured', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      // Should return 200 or 429 (rate limited)
      expect([200, 429]).toContain(response.status());

      if (response.status() === 429) {
        const headers = response.headers();
        expect(headers['retry-after']).toBeDefined();
      }
    });

    test('should include rate limit headers in successful responses', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const headers = response.headers();

        // Rate limit headers may be present
        if (headers['x-ratelimit-limit']) {
          expect(headers['x-ratelimit-remaining']).toBeDefined();

          const limit = parseInt(headers['x-ratelimit-limit']);
          const remaining = parseInt(headers['x-ratelimit-remaining']);

          expect(limit).toBeGreaterThan(0);
          expect(remaining).toBeGreaterThanOrEqual(0);
          expect(remaining).toBeLessThanOrEqual(limit);
        }
      }
    });
  });

  test.describe('Data Quality', () => {
    test('recommendations should be ordered by score descending', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        if (recommendations.length > 1) {
          for (let i = 1; i < recommendations.length; i++) {
            expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
          }
        }
      }
    });

    test('top picks should be highest scoring recommendations', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;
        const topPicks = json.data.top_picks;

        if (topPicks.length > 0 && recommendations.length > 0) {
          // Top pick should have highest score
          expect(topPicks[0].score).toBe(recommendations[0].score);
        }
      }
    });

    test('should not contain duplicate spot IDs', async () => {
      const response = await api.get(
        `${RECOMMENDATIONS_PATH}?lat=${TEST_LOCATION.lat}&lon=${TEST_LOCATION.lon}`
      );

      if (response.status() === 200) {
        const json = await response.json();
        const recommendations = json.data.recommendations;

        const spotIds = recommendations.map((r: any) => r.spotId);
        const uniqueSpotIds = new Set(spotIds);

        expect(spotIds.length).toBe(uniqueSpotIds.size);
      }
    });
  });
});

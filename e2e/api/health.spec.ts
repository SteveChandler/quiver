/**
 * Health Check API Contract Tests
 *
 * Tests the API contract for health endpoint to ensure:
 * - No authentication required
 * - Always returns 200 when healthy
 * - Response structure remains stable
 * - Fast response time
 *
 * @project guest (public endpoint)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${BASE_URL}/api/health`;

test.describe('Health Check API Contract', () => {
  test.describe('GET /api/health', () => {
    test.describe('Authentication Requirements', () => {
      test('should NOT require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const response = await unauthContext.get(HEALTH_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });

      test('should work for authenticated users', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });
    });

    test.describe('Response Structure', () => {
      test('should return 200 OK status', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);
      });

      test('should return valid JSON content', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');

        expect(json.success).toBe(true);
      });

      test('should return status field in data', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('status');
        expect(json.data.status).toBe('healthy');
      });

      test('should return timestamp in data', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('timestamp');
        expect(typeof json.data.timestamp).toBe('string');

        // Validate ISO 8601 format
        const timestamp = new Date(json.data.timestamp);
        expect(timestamp.toISOString()).toBe(json.data.timestamp);
      });

      test('should return service name in data', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json.data).toHaveProperty('service');
        expect(typeof json.data.service).toBe('string');
        expect(json.data.service.length).toBeGreaterThan(0);
      });

      test('should return timestamp in ISO 8601 format at root level', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');

        const timestamp = new Date(json.timestamp);
        expect(timestamp.toISOString()).toBe(json.timestamp);
      });
    });

    test.describe('Security Headers', () => {
      test('should include security headers', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const headers = response.headers();

        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['x-xss-protection']).toBe('1; mode=block');
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.post(HEALTH_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle PUT requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.put(HEALTH_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle DELETE requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.delete(HEALTH_ENDPOINT);

        expect(response.status()).toBe(405);
      });

      test('should handle PATCH requests with 405 Method Not Allowed', async ({ request }) => {
        const response = await request.patch(HEALTH_ENDPOINT);

        expect(response.status()).toBe(405);
      });
    });

    test.describe('Performance', () => {
      test('should respond within very fast time (< 100ms)', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(HEALTH_ENDPOINT);
        const duration = Date.now() - startTime;

        console.log(`[Health Check] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(100);
      });

      test('should be consistently fast across multiple requests', async ({ request }) => {
        const durations: number[] = [];

        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          await request.get(HEALTH_ENDPOINT);
          const duration = Date.now() - startTime;
          durations.push(duration);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        console.log(`[Health Check] Average response time over 5 requests: ${avgDuration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(100);
      });
    });

    test.describe('Reliability', () => {
      test('should return consistent results across multiple requests', async ({ request }) => {
        const response1 = await request.get(HEALTH_ENDPOINT);
        const response2 = await request.get(HEALTH_ENDPOINT);

        const json1 = await response1.json();
        const json2 = await response2.json();

        // Status should always be healthy
        expect(json1.data.status).toBe('healthy');
        expect(json2.data.status).toBe('healthy');

        // Service name should be consistent
        expect(json1.data.service).toBe(json2.data.service);
      });

      test('should always return 200 status', async ({ request }) => {
        // Make multiple requests to ensure consistency
        for (let i = 0; i < 3; i++) {
          const response = await request.get(HEALTH_ENDPOINT);
          expect(response.status()).toBe(200);
        }
      });
    });

    test.describe('Caching', () => {
      test('should have appropriate cache headers', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const headers = response.headers();

        // Health endpoint typically shouldn't be cached aggressively
        // Should either have no-cache or very short cache duration
        if (headers['cache-control']) {
          const cacheControl = headers['cache-control'];

          // Verify it's either no-cache or has short max-age
          expect(
            cacheControl.includes('no-cache') ||
              cacheControl.includes('no-store') ||
              cacheControl.includes('max-age=')
          ).toBe(true);
        }
      });
    });

    test.describe('Monitoring Integration', () => {
      test('should be suitable for automated health checks', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);

        // Should always return 200 for healthy service
        expect(response.status()).toBe(200);

        // Should have fast response time for monitoring
        const startTime = Date.now();
        await request.get(HEALTH_ENDPOINT);
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(5000);

        // Response should be parseable
        const json = await response.json();
        expect(json.data.status).toBeDefined();
      });
    });
  });

  test.describe('GET /api/health?deep=true', () => {
    test.describe('Response Structure', () => {
      test('should return standard API envelope', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');
        // success is true for 200 (healthy/degraded), false for 503 (critical)
        expect(typeof json.success).toBe('boolean');
      });

      test('should include status field with valid value', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json.data).toHaveProperty('status');
        expect(['healthy', 'degraded', 'critical']).toContain(json.data.status);
      });

      test('should include checks object with database status', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json.data).toHaveProperty('checks');
        expect(json.data.checks).toHaveProperty('database');
        expect(typeof json.data.checks.database).toBe('boolean');
      });

      test('should include enhanced forecast details', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json.data.checks).toHaveProperty('enhancedForecasts');
        expect(json.data.checks.enhancedForecasts).toHaveProperty('coverage');
        expect(json.data.checks.enhancedForecasts).toHaveProperty('freshCount');
        expect(json.data.checks.enhancedForecasts).toHaveProperty('staleCount');
        expect(json.data.checks.enhancedForecasts).toHaveProperty('averageAgeHours');

        expect(typeof json.data.checks.enhancedForecasts.coverage).toBe('number');
        expect(typeof json.data.checks.enhancedForecasts.freshCount).toBe('number');
        expect(typeof json.data.checks.enhancedForecasts.staleCount).toBe('number');
        expect(typeof json.data.checks.enhancedForecasts.averageAgeHours).toBe('number');
      });

      test('should include all five source pipelines', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json.data.checks).toHaveProperty('sources');

        const sources = json.data.checks.sources;
        expect(sources).toHaveProperty('enhanced');
        expect(sources).toHaveProperty('marine');
        expect(sources).toHaveProperty('tide');
        expect(sources).toHaveProperty('sun');
        expect(sources).toHaveProperty('ioos');

        // Verify each source has required fields
        for (const sourceKey of ['enhanced', 'marine', 'tide', 'sun', 'ioos']) {
          const source = sources[sourceKey];
          expect(source).toHaveProperty('source');
          expect(source).toHaveProperty('available');
          expect(source).toHaveProperty('coveragePercentage');

          expect(typeof source.available).toBe('boolean');
          expect(typeof source.coveragePercentage).toBe('number');
        }
      });

      test('should include issues array', async ({ request }) => {
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const json = await response.json();

        expect(json.data).toHaveProperty('issues');
        expect(Array.isArray(json.data.issues)).toBe(true);
      });
    });

    test.describe('Backward Compatibility', () => {
      test('should not change shallow health check response', async ({ request }) => {
        const response = await request.get(HEALTH_ENDPOINT);
        const json = await response.json();

        expect(json.data.status).toBe('healthy');
        expect(json.data.checks).toBeUndefined();
        expect(json.data.service).toBe('quiver-surf-app');
      });
    });

    test.describe('Performance', () => {
      test('should respond within 5 seconds', async ({ request }) => {
        const startTime = Date.now();
        const response = await request.get(`${HEALTH_ENDPOINT}?deep=true`);
        const duration = Date.now() - startTime;

        console.log(`[Deep Health Check] Response time: ${duration}ms`);

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(5000);
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST with 405', async ({ request }) => {
        const response = await request.post(`${HEALTH_ENDPOINT}?deep=true`);

        expect(response.status()).toBe(405);
      });

      test('should handle DELETE with 405', async ({ request }) => {
        const response = await request.delete(`${HEALTH_ENDPOINT}?deep=true`);

        expect(response.status()).toBe(405);
      });
    });
  });
});

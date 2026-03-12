/**
 * Session Planner API Contract Tests
 *
 * Tests the API contract for session planner optimal-times endpoint to ensure:
 * - No authentication required (public endpoint)
 * - Proper payload validation (beachId, date)
 * - Response structure remains stable
 * - Performance within acceptable limits
 *
 * @project guest (public endpoint)
 */

import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from '../fixtures/test-data';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OPTIMAL_TIMES_ENDPOINT = `${BASE_URL}/api/session-planner/optimal-times`;

// Get tomorrow's date for testing
const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

test.describe('Session Planner API Contract', () => {
  test.describe('GET /api/session-planner/optimal-times', () => {
    test.describe('Authentication Requirements', () => {
      test('should NOT require authentication', async ({ playwright }) => {
        const unauthContext = await playwright.request.newContext({
          storageState: { cookies: [], origins: [] },
        });

        const date = getTomorrowDate();
        const response = await unauthContext.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        // Should not be 401 - public endpoint
        expect(response.status()).not.toBe(401);
        expect([200, 404, 429, 500]).toContain(response.status());
      });
    });

    test.describe('Parameter Validation', () => {
      test('should reject missing beachId without selectedTime', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(`${OPTIMAL_TIMES_ENDPOINT}?date=${date}`);

        // 400 is the expected validation error; 429 is possible if rate-limited
        expect([400, 429]).toContain(response.status());

        if (response.status() === 400) {
          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toContain('Beach ID');
        }
      });

      test('should reject missing date', async ({ request }) => {
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}`
        );

        // 400 is the expected validation error; 429 is possible if rate-limited
        expect([400, 429]).toContain(response.status());

        if (response.status() === 400) {
          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error).toContain('Date');
        }
      });

      test('should accept beachId and date', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        // Could be 200 (forecast available) or 404 (no forecast)
        expect([200, 404, 500]).toContain(response.status());
      });

      test('should accept optional selectedTime parameter', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}&selectedTime=09:00`
        );

        expect([200, 404, 500]).toContain(response.status());
      });

      test('should accept beachName as fallback to beachId', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachName=Blacks&date=${date}`
        );

        expect([200, 404, 429, 500]).toContain(response.status());
      });
    });

    test.describe('Response Structure', () => {
      test('should return valid JSON content', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        expect(response.headers()['content-type']).toContain('application/json');

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test('should return standard API response structure', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        const json = await response.json();

        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('timestamp');
      });

      test('should include beachId, date, optimalTimes on success', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty('beachId');
          expect(json.data).toHaveProperty('date');
          expect(json.data).toHaveProperty('optimalTimes');
          expect(json.data).toHaveProperty('forecastSource');
          expect(json.data).toHaveProperty('generatedAt');

          expect(Array.isArray(json.data.optimalTimes)).toBe(true);
        }
      });
    });

    test.describe('Optimal Times Schema', () => {
      test('each optimal time should have required fields', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const optimalTimes = json.data.optimalTimes;

          optimalTimes.forEach((slot: any) => {
            // API may return either 'time' or 'startTime'/'endTime' depending on version
            const hasTimeField = 'time' in slot || ('startTime' in slot && 'endTime' in slot);
            expect(hasTimeField).toBe(true);
            expect(slot).toHaveProperty('score');
          });
        }
      });

      test('score should be a number', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const optimalTimes = json.data.optimalTimes;

          optimalTimes.forEach((slot: any) => {
            expect(typeof slot.score).toBe('number');
            expect(slot.score).toBeGreaterThanOrEqual(0);
            expect(slot.score).toBeLessThanOrEqual(100);
          });
        }
      });
    });

    test.describe('Forecast Source', () => {
      test('forecastSource should be valid type', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(['enhanced', 'basic', 'synthetic']).toContain(json.data.forecastSource);
        }
      });
    });

    test.describe('Error Handling', () => {
      test('should handle POST requests with 405 Method Not Allowed', async ({ request }) => {
        const date = getTomorrowDate();
        const response = await request.post(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );

        expect(response.status()).toBe(405);
      });

      test('should handle no forecast data gracefully', async ({ request }) => {
        const futureDate = '2030-01-01';
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${futureDate}`
        );

        // Should return 200 (synthetic fallback), 404, 429 (rate-limited), or 500 (no data)
        expect([200, 404, 429, 500]).toContain(response.status());

        const json = await response.json();
        expect(json).toHaveProperty('success');
      });
    });

    test.describe('Performance', () => {
      test('should respond within reasonable time (< 5000ms)', async ({ request }) => {
        const date = getTomorrowDate();
        const startTime = Date.now();
        const response = await request.get(
          `${OPTIMAL_TIMES_ENDPOINT}?beachId=${TEST_BEACHES.blacks.id}&date=${date}`
        );
        const duration = Date.now() - startTime;

        console.log(`[Session Planner] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(5000);
      });
    });
  });
});

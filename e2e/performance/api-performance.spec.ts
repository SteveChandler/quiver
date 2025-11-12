/**
 * API Performance E2E Tests
 * Tests real API endpoint performance with actual HTTP requests
 */

import { test, expect } from '@playwright/test';

const PERFORMANCE_THRESHOLDS = {
  READ: 300, // ms
  WRITE: 500, // ms
  SEARCH: 500, // ms
  BULK: 1000, // ms
};

test.describe('API Performance', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  test('should respond to /api/beaches/nearby within SLA', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(
      `${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0&limit=20`
    );
    const duration = Date.now() - startTime;

    console.log(`[API] /api/beaches/nearby: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.READ);
  });

  test('should respond to /api/beaches/search within SLA', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/beaches/search?query=blacks`);
    const duration = Date.now() - startTime;

    console.log(`[API] /api/beaches/search: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH);
  });

  test('should respond to /api/beaches/[id] within SLA', async ({ request }) => {
    const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/beaches/${BEACH_ID}`);
    const duration = Date.now() - startTime;

    console.log(`[API] /api/beaches/[id]: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.READ);
  });

  test('should respond to /api/forecasts within SLA', async ({ request }) => {
    const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/forecasts?beachId=${BEACH_ID}`);
    const duration = Date.now() - startTime;

    console.log(`[API] /api/forecasts: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.READ);
  });

  test('should respond to /api/sessions within SLA', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/sessions?limit=20`);
    const duration = Date.now() - startTime;

    console.log(`[API] /api/sessions: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.READ);
  });

  test('should respond to /api/recent-posts within SLA', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/recent-posts?limit=20`);
    const duration = Date.now() - startTime;

    console.log(`[API] /api/recent-posts: ${duration}ms (${response.status()})`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.READ);
  });

  test('should handle concurrent requests efficiently', async ({ request }) => {
    const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';

    const startTime = Date.now();

    // Fire multiple requests concurrently
    const requests = [
      request.get(`${BASE_URL}/api/beaches/${BEACH_ID}`),
      request.get(`${BASE_URL}/api/forecasts?beachId=${BEACH_ID}`),
      request.get(`${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0`),
      request.get(`${BASE_URL}/api/sessions?limit=10`),
      request.get(`${BASE_URL}/api/recent-posts?limit=10`),
    ];

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`[Concurrent] 5 requests completed in ${duration}ms`);

    // All should succeed (or return acceptable error codes)
    responses.forEach((response) => {
      expect(response.status()).toBeLessThanOrEqual(500);
    });

    // Concurrent requests should be significantly faster than sequential
    // If they were sequential at 300ms each = 1500ms
    expect(duration).toBeLessThan(1500);
  });

  test('should return cached responses on second request', async ({ request }) => {
    const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
    const url = `${BASE_URL}/api/beaches/${BEACH_ID}`;

    // First request (potential cache miss)
    const firstStart = Date.now();
    const firstResponse = await request.get(url);
    const firstDuration = Date.now() - firstStart;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second request (potential cache hit)
    const secondStart = Date.now();
    const secondResponse = await request.get(url);
    const secondDuration = Date.now() - secondStart;

    console.log(`[Cache] First: ${firstDuration}ms, Second: ${secondDuration}ms`);

    expect(firstResponse.status()).toBeLessThan(500);
    expect(secondResponse.status()).toBeLessThan(500);

    // Second request should generally be as fast or faster
    expect(secondDuration).toBeLessThanOrEqual(firstDuration * 1.5);
  });

  test('should return 404 errors quickly', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(
      `${BASE_URL}/api/beaches/nonexistent-beach-id-12345`
    );
    const duration = Date.now() - startTime;

    console.log(`[404 Error] Response time: ${duration}ms (${response.status()})`);

    // Error responses should be fast
    expect(duration).toBeLessThan(200);
  });

  test('should return validation errors quickly', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(
      `${BASE_URL}/api/beaches/nearby?lat=invalid&lng=invalid`
    );
    const duration = Date.now() - startTime;

    console.log(`[Validation Error] Response time: ${duration}ms (${response.status()})`);

    // Validation errors should be very fast
    expect(duration).toBeLessThan(200);
  });

  test('should handle large result sets efficiently', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(
      `${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0&limit=100`
    );
    const duration = Date.now() - startTime;

    const body = await response.body();
    const size = body.length;

    console.log(`[Large Response] 100 beaches: ${duration}ms (${size} bytes)`);

    expect(response.status()).toBeLessThan(500);
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH);
  });
});

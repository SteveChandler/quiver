/**
 * API Endpoint Performance Tests
 * Tests performance of critical API endpoints against SLA thresholds
 */

import {
  measureAPIPerformance,
  assertPerformanceSLA,
  PERFORMANCE_THRESHOLDS,
} from './helpers/performance-metrics';

describe('API Endpoint Performance', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  // Helper to create auth headers if needed
  const getHeaders = () => ({
    'Content-Type': 'application/json',
  });

  describe('Beach Endpoints', () => {
    it('should respond to /api/beaches/nearby within SLA', async () => {
      const metrics = await measureAPIPerformance(
        '/api/beaches/nearby',
        () =>
          fetch(`${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0&limit=20`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/beaches/nearby: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/beaches/nearby'
      );
    }, 10000);

    it('should respond to /api/beaches/search within SLA', async () => {
      const metrics = await measureAPIPerformance(
        '/api/beaches/search',
        () =>
          fetch(`${BASE_URL}/api/beaches/search?query=blacks`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/beaches/search: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.SEARCH,
        '/api/beaches/search'
      );
    }, 10000);

    it('should respond to /api/beaches/[id] within SLA', async () => {
      const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
      const metrics = await measureAPIPerformance(
        `/api/beaches/${BEACH_ID}`,
        () =>
          fetch(`${BASE_URL}/api/beaches/${BEACH_ID}`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/beaches/[id]: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/beaches/[id]'
      );
    }, 10000);
  });

  describe('Forecast Endpoints', () => {
    it('should respond to /api/forecasts within SLA', async () => {
      const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
      const metrics = await measureAPIPerformance(
        '/api/forecasts',
        () =>
          fetch(`${BASE_URL}/api/forecasts?beachId=${BEACH_ID}`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/forecasts: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/forecasts'
      );
    }, 10000);

    it('should handle bulk forecast requests within SLA', async () => {
      const beachIds = [
        '84d3468b-c1ec-46ad-8621-d8507e5f167a',
        '1a2b3c4d-5e6f-7890-abcd-ef1234567890',
      ];

      const metrics = await measureAPIPerformance(
        '/api/forecasts/bulk',
        () =>
          fetch(`${BASE_URL}/api/forecasts/bulk?beachIds=${beachIds.join(',')}`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/forecasts/bulk: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.BULK,
        '/api/forecasts/bulk'
      );
    }, 15000);
  });

  describe('Session Endpoints', () => {
    it('should respond to /api/sessions within SLA', async () => {
      const metrics = await measureAPIPerformance(
        '/api/sessions',
        () =>
          fetch(`${BASE_URL}/api/sessions?limit=20`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/sessions: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/sessions'
      );
    }, 10000);

    it('should respond to /api/users/[id]/sessions within SLA', async () => {
      const USER_ID = 'test-user-id';
      const metrics = await measureAPIPerformance(
        `/api/users/${USER_ID}/sessions`,
        () =>
          fetch(`${BASE_URL}/api/users/${USER_ID}/sessions?limit=20`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/users/[id]/sessions: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      // Status might be 404 if user doesn't exist, that's ok for perf testing
      expect(metrics.statusCode).toBeLessThanOrEqual(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/users/[id]/sessions'
      );
    }, 10000);
  });

  describe('Social Endpoints', () => {
    it('should respond to /api/recent-posts within SLA', async () => {
      const metrics = await measureAPIPerformance(
        '/api/recent-posts',
        () =>
          fetch(`${BASE_URL}/api/recent-posts?limit=20`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/recent-posts: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/recent-posts'
      );
    }, 10000);

    it('should respond to /api/activity-feed within SLA', async () => {
      const metrics = await measureAPIPerformance(
        '/api/activity-feed',
        () =>
          fetch(`${BASE_URL}/api/activity-feed?limit=20`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/activity-feed: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      // May require auth, 401 is acceptable for perf test
      expect(metrics.statusCode).toBeLessThanOrEqual(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/activity-feed'
      );
    }, 10000);
  });

  describe('User Profile Endpoints', () => {
    it('should respond to /api/users/[id]/profile within SLA', async () => {
      const USER_ID = 'test-user-id';
      const metrics = await measureAPIPerformance(
        `/api/users/${USER_ID}/profile`,
        () =>
          fetch(`${BASE_URL}/api/users/${USER_ID}/profile`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/users/[id]/profile: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThanOrEqual(500);
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.READ,
        '/api/users/[id]/profile'
      );
    }, 10000);
  });

  describe('Recommendation Endpoints', () => {
    it('should respond to /api/recommendations/best-times within SLA', async () => {
      const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
      const metrics = await measureAPIPerformance(
        '/api/recommendations/best-times',
        () =>
          fetch(`${BASE_URL}/api/recommendations/best-times?beachId=${BEACH_ID}`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[API] /api/recommendations/best-times: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      expect(metrics.statusCode).toBeLessThanOrEqual(500);
      // Recommendations might take longer due to calculations
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.BULK,
        '/api/recommendations/best-times'
      );
    }, 10000);
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';

      const startTime = performance.now();

      // Fire multiple requests concurrently
      const requests = [
        fetch(`${BASE_URL}/api/beaches/${BEACH_ID}`, { headers: getHeaders() }),
        fetch(`${BASE_URL}/api/forecasts?beachId=${BEACH_ID}`, {
          headers: getHeaders(),
        }),
        fetch(`${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0`, {
          headers: getHeaders(),
        }),
        fetch(`${BASE_URL}/api/sessions?limit=10`, { headers: getHeaders() }),
        fetch(`${BASE_URL}/api/recent-posts?limit=10`, { headers: getHeaders() }),
      ];

      const responses = await Promise.all(requests);
      const duration = performance.now() - startTime;

      console.log(`[Concurrent] 5 requests completed in ${duration.toFixed(2)}ms`);

      // All should succeed (or return acceptable error codes)
      responses.forEach((response, index) => {
        expect(response.status).toBeLessThanOrEqual(500);
      });

      // Concurrent requests should be significantly faster than sequential
      // If they were sequential at 300ms each = 1500ms
      // Concurrent should be much less
      expect(duration).toBeLessThan(1500);
    }, 15000);
  });

  describe('Cache Performance', () => {
    it('should return cached responses faster on second request', async () => {
      const BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';
      const url = `${BASE_URL}/api/beaches/${BEACH_ID}`;

      // First request (cache miss)
      const firstMetrics = await measureAPIPerformance(
        `/api/beaches/${BEACH_ID}`,
        () => fetch(url, { headers: getHeaders() })
      );

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request (potential cache hit)
      const secondMetrics = await measureAPIPerformance(
        `/api/beaches/${BEACH_ID}`,
        () => fetch(url, { headers: getHeaders() })
      );

      console.log(
        `[Cache] First: ${firstMetrics.duration.toFixed(2)}ms, Second: ${secondMetrics.duration.toFixed(2)}ms`
      );

      // Second request should generally be as fast or faster
      // (This may not always be true, but it's a good indicator)
      expect(secondMetrics.duration).toBeLessThanOrEqual(firstMetrics.duration * 1.2);
    }, 15000);
  });

  describe('Error Response Performance', () => {
    it('should return 404 errors quickly', async () => {
      const metrics = await measureAPIPerformance(
        '/api/beaches/nonexistent-beach-id-12345',
        () =>
          fetch(`${BASE_URL}/api/beaches/nonexistent-beach-id-12345`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[404 Error] Response time: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      // Error responses should be fast
      expect(metrics.duration).toBeLessThan(200);
    }, 10000);

    it('should return validation errors quickly', async () => {
      const metrics = await measureAPIPerformance(
        '/api/beaches/nearby (invalid params)',
        () =>
          fetch(`${BASE_URL}/api/beaches/nearby?lat=invalid&lng=invalid`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[Validation Error] Response time: ${metrics.duration.toFixed(2)}ms (${metrics.statusCode})`
      );

      // Validation errors should be very fast
      expect(metrics.duration).toBeLessThan(100);
    }, 10000);
  });

  describe('Large Response Handling', () => {
    it('should handle large result sets efficiently', async () => {
      const metrics = await measureAPIPerformance(
        '/api/beaches/nearby (large result)',
        () =>
          fetch(`${BASE_URL}/api/beaches/nearby?lat=33.0&lng=-117.0&limit=100`, {
            headers: getHeaders(),
          })
      );

      console.log(
        `[Large Response] 100 beaches: ${metrics.duration.toFixed(2)}ms (${metrics.responseSize} bytes)`
      );

      expect(metrics.statusCode).toBeLessThan(500);
      // Larger responses get more time
      assertPerformanceSLA(
        metrics,
        PERFORMANCE_THRESHOLDS.API.SEARCH,
        '/api/beaches/nearby (large)'
      );
    }, 15000);
  });
});

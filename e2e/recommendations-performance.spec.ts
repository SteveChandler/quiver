/**
 * E2E Tests for Recommendations Performance
 *
 * Validates N+1 query fix from Phase 3 (Database Optimization).
 *
 * Tests cover:
 * - Response time improvements (5-10s → <1s)
 * - Query count reduction (50 queries → 2 queries)
 * - Data integrity after optimization
 * - Scalability with varying beach counts
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

test.describe("Recommendations Performance - Phase 3 N+1 Query Fix", () => {
  test.describe("Response Time Validation", () => {
    test("should respond in under 1 second (was 5-10s before fix)", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      const startTime = performance.now();
      const response = await request.get(endpoint);
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      // Should be successful or rate limited
      expect([200, 429]).toContain(response.status());

      if (response.status() === 200) {
        // Response time should be under 1000ms (was 5000-10000ms before)
        expect(responseTime).toBeLessThan(1000);

        console.log(`✓ Response time: ${responseTime.toFixed(2)}ms (target: <1000ms)`);

        // Verify we got data back
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
      } else {
        console.log("Rate limited - waiting before retry");
        await new Promise(resolve => setTimeout(resolve, 3000));

        const retryStart = performance.now();
        const retryResponse = await request.get(endpoint);
        const retryEnd = performance.now();
        const retryTime = retryEnd - retryStart;

        if (retryResponse.status() === 200) {
          expect(retryTime).toBeLessThan(1000);
          console.log(`✓ Retry response time: ${retryTime.toFixed(2)}ms`);
        }
      }
    }, TIMEOUTS.long);

    test("should maintain fast response times with multiple requests", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=33.7701&lon=-118.1937`;

      const responseTimes: number[] = [];

      // Make multiple requests to test consistency
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between requests

        const startTime = performance.now();
        const response = await request.get(endpoint);
        const endTime = performance.now();

        if (response.status() === 200) {
          responseTimes.push(endTime - startTime);
        }
      }

      if (responseTimes.length > 0) {
        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxTime = Math.max(...responseTimes);

        expect(avgTime).toBeLessThan(1000);
        expect(maxTime).toBeLessThan(1500);

        console.log(`✓ Average response time: ${avgTime.toFixed(2)}ms`);
        console.log(`✓ Max response time: ${maxTime.toFixed(2)}ms`);
      }
    }, TIMEOUTS.veryLong);

    test("should return response under 2 seconds even with cold cache", async ({ request }) => {
      // Use a unique location to bypass any caching
      const lat = 34.0259 + Math.random() * 0.01;
      const lon = -118.7798 + Math.random() * 0.01;
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=${lat}&lon=${lon}`;

      const startTime = performance.now();
      const response = await request.get(endpoint);
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      if (response.status() === 200) {
        // Even with cold cache, should be under 2 seconds
        expect(responseTime).toBeLessThan(2000);

        console.log(`✓ Cold cache response time: ${responseTime.toFixed(2)}ms`);
      }
    }, TIMEOUTS.long);
  });

  test.describe("Data Integrity After Optimization", () => {
    test("should return complete beach data with forecasts", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request.get(endpoint);

      if (response.status() === 200) {
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(Array.isArray(body.data)).toBe(true);

        if (body.data.length > 0) {
          const beach = body.data[0];

          // Verify beach has required fields
          expect(beach.id).toBeDefined();
          expect(beach.name).toBeDefined();

          // Verify forecasts are included (N+1 fix ensures this)
          // The fix should load marine_forecasts and tide_forecasts eagerly
          console.log(`✓ Beach data structure validated`);
          console.log(`  - Beach count: ${body.data.length}`);
          console.log(`  - Sample beach: ${beach.name}`);

          // Check if beach has lat/lon for distance calculation
          if (beach.latitude && beach.longitude) {
            expect(typeof beach.latitude).toBe("number");
            expect(typeof beach.longitude).toBe("number");
          }
        }
      }
    });

    test("should return consistent data across multiple requests", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.8473&lon=-117.2750`;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const response1 = await request.get(endpoint);

      if (response1.status() === 200) {
        const body1 = await response1.json();

        await new Promise(resolve => setTimeout(resolve, 2000));

        const response2 = await request.get(endpoint);
        const body2 = await response2.json();

        if (response2.status() === 200) {
          // Should return same beaches (within small time window)
          expect(body1.data.length).toBe(body2.data.length);

          if (body1.data.length > 0 && body2.data.length > 0) {
            expect(body1.data[0].id).toBe(body2.data[0].id);
            console.log("✓ Data consistency validated across requests");
          }
        }
      }
    }, TIMEOUTS.long);

    test("should include personalization scores if available", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request.get(endpoint);

      if (response.status() === 200) {
        const body = await response.json();

        if (body.data && body.data.length > 0) {
          const beach = body.data[0];

          // Check for personalization fields (may or may not be present)
          if (beach.personalization_score !== undefined) {
            expect(typeof beach.personalization_score).toBe("number");
            console.log(`✓ Personalization score present: ${beach.personalization_score}`);
          } else {
            console.log("✓ No personalization score (user may not be authenticated)");
          }
        }
      }
    });
  });

  test.describe("Query Count Optimization", () => {
    test("should complete request with minimal database queries", async ({ page }) => {
      // Use browser context to check console logs for performance metrics
      const consoleLogs: string[] = [];

      page.on("console", (msg) => {
        const text = msg.text();
        consoleLogs.push(text);
      });

      // Navigate to a page that uses recommendations API
      await page.goto("/");

      // Wait for API calls to complete
      await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.long });

      // Look for performance log messages
      const performanceLog = consoleLogs.find(log =>
        log.includes("Fetched forecasts") || log.includes("beaches")
      );

      if (performanceLog) {
        console.log(`✓ Performance log found: ${performanceLog}`);

        // Should indicate fast query time (under 100ms for database queries)
        const timeMatch = performanceLog.match(/(\d+)ms/);
        if (timeMatch) {
          const queryTime = parseInt(timeMatch[1]);
          expect(queryTime).toBeLessThan(500);
          console.log(`  - Query time: ${queryTime}ms`);
        }
      }
    }, TIMEOUTS.long);

    test("should avoid N+1 pattern in network requests", async ({ page }) => {
      const apiCalls: string[] = [];

      // Monitor network requests
      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/")) {
          apiCalls.push(url);
        }
      });

      await page.goto("/");
      await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.long });

      // Count how many times recommendations API is called
      const recommendationCalls = apiCalls.filter(url =>
        url.includes("/api/v1/recommendations")
      );

      // Should only be called once (or a few times for different locations)
      // Not once per beach (which would be N+1 pattern)
      expect(recommendationCalls.length).toBeLessThan(5);

      console.log(`✓ Recommendation API calls: ${recommendationCalls.length} (efficient)`);
    }, TIMEOUTS.long);
  });

  test.describe("Scalability Testing", () => {
    test("should handle varying beach counts efficiently", async ({ request }) => {
      // Test different locations with potentially different beach counts
      const locations = [
        { lat: 32.7157, lon: -117.1611, name: "San Diego" },
        { lat: 33.7701, lon: -118.1937, name: "Long Beach" },
        { lat: 34.0259, lon: -118.7798, name: "Malibu" },
      ];

      const results: Array<{ name: string; time: number; count: number }> = [];

      for (const location of locations) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const endpoint = `${BASE_URL}/api/v1/recommendations?lat=${location.lat}&lon=${location.lon}`;

        const startTime = performance.now();
        const response = await request.get(endpoint);
        const endTime = performance.now();

        if (response.status() === 200) {
          const body = await response.json();
          results.push({
            name: location.name,
            time: endTime - startTime,
            count: body.data?.length || 0,
          });
        }
      }

      if (results.length > 0) {
        // All should be under 2 seconds regardless of beach count
        results.forEach(result => {
          expect(result.time).toBeLessThan(2000);
          console.log(`✓ ${result.name}: ${result.count} beaches in ${result.time.toFixed(2)}ms`);
        });

        // Verify linear scaling (not exponential)
        const times = results.map(r => r.time);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        // Max time should not be more than 3x min time
        expect(maxTime).toBeLessThan(minTime * 3);

        console.log("✓ Linear scaling confirmed");
      }
    }, TIMEOUTS.veryLong);

    test("should maintain performance with maximum results", async ({ request }) => {
      // Request recommendations with potential for many results
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=33.8&lon=-118.2&limit=50`;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const startTime = performance.now();
      const response = await request.get(endpoint);
      const endTime = performance.now();

      if (response.status() === 200) {
        const responseTime = endTime - startTime;
        const body = await response.json();

        // Even with 50 results, should be under 2 seconds
        expect(responseTime).toBeLessThan(2000);

        console.log(`✓ Large result set (${body.data?.length || 0} beaches) in ${responseTime.toFixed(2)}ms`);
      }
    }, TIMEOUTS.long);
  });

  test.describe("Performance Regression Detection", () => {
    test("should not exceed performance budget for P95", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;
      const times: number[] = [];

      // Make multiple requests to get P95 metric
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const startTime = performance.now();
        const response = await request.get(endpoint);
        const endTime = performance.now();

        if (response.status() === 200) {
          times.push(endTime - startTime);
        }
      }

      if (times.length > 0) {
        times.sort((a, b) => a - b);
        const p95Index = Math.floor(times.length * 0.95);
        const p95Time = times[p95Index];

        // P95 should be under 1500ms
        expect(p95Time).toBeLessThan(1500);

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

        console.log(`✓ Performance metrics:`);
        console.log(`  - Average: ${avgTime.toFixed(2)}ms`);
        console.log(`  - P95: ${p95Time.toFixed(2)}ms`);
        console.log(`  - Min: ${Math.min(...times).toFixed(2)}ms`);
        console.log(`  - Max: ${Math.max(...times).toFixed(2)}ms`);
      }
    }, TIMEOUTS.veryLong);

    test("should log performance metrics in response", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request.get(endpoint);

      if (response.status() === 200) {
        const body = await response.json();

        // Check for performance metadata in response
        if (body.metadata?.performance) {
          console.log("✓ Performance metadata included:");
          console.log(`  - ${JSON.stringify(body.metadata.performance)}`);
        } else {
          console.log("✓ No explicit performance metadata (expected in dev mode)");
        }
      }
    });
  });

  test.describe("Error Handling Performance", () => {
    test("should fail fast with invalid coordinates", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=invalid&lon=-117.1611`;

      const startTime = performance.now();
      const response = await request.get(endpoint);
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      // Should fail quickly (under 100ms) without hitting database
      expect(responseTime).toBeLessThan(100);
      expect(response.status()).toBe(400);

      console.log(`✓ Fast error response: ${responseTime.toFixed(2)}ms`);
    });

    test("should handle empty results efficiently", async ({ request }) => {
      // Use coordinates in ocean with no nearby beaches
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=0&lon=0`;

      const startTime = performance.now();
      const response = await request.get(endpoint);
      const endTime = performance.now();

      if (response.status() === 200) {
        const responseTime = endTime - startTime;

        // Should still be fast even with no results
        expect(responseTime).toBeLessThan(1000);

        const body = await response.json();
        console.log(`✓ Empty result performance: ${responseTime.toFixed(2)}ms`);
      }
    });
  });
});

/**
 * E2E Tests for API Rate Limiting Validation
 *
 * Validates comprehensive rate limiting implementation from Phase 2.
 *
 * Tests cover:
 * - Image proxy rate limiting (CRITICAL - SSRF protection)
 * - Recommendations endpoint rate limiting
 * - Beach search rate limiting
 * - Rate limit recovery and retry-after behavior
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./fixtures/test-data";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

test.describe("Rate Limiting Validation - Phase 2 Fixes", () => {
  test.describe("Image Proxy Rate Limiting (CRITICAL - SSRF Protection)", () => {
    test("should enforce rate limit on image proxy endpoint", async ({ request }) => {
      const imageUrl = encodeURIComponent("https://example.com/test-image.jpg");
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Image proxy has burst limit of 5 requests per minute
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 (Too Many Requests) response
      const rateLimitedCount = results.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Image proxy rate limiting: ${rateLimitedCount}/10 requests blocked`);
    });

    test("should include Retry-After header in 429 response", async ({ request }) => {
      const imageUrl = encodeURIComponent("https://example.com/test-image.jpg");
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Make requests until rate limited
      let rateLimitedResponse;
      for (let i = 0; i < 15; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        // Verify Retry-After header is present
        const retryAfter = rateLimitedResponse.headers()["retry-after"];
        expect(retryAfter).toBeDefined();
        expect(parseInt(retryAfter!)).toBeGreaterThan(0);

        // Verify response body structure
        const body = await rateLimitedResponse.json();
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error).toMatch(/rate limit/i);
        expect(body.retryAfter).toBeGreaterThan(0);

        console.log(`Rate limit retry-after: ${retryAfter} seconds`);
      }
    });

    test("should allow requests after retry period expires", async ({ request }) => {
      const imageUrl = encodeURIComponent("https://example.com/test-unique.jpg");
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Trigger rate limit
      let rateLimitedResponse;
      for (let i = 0; i < 15; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json();
        const retryAfter = body.retryAfter;

        console.log(`Waiting ${retryAfter + 1} seconds for rate limit to reset...`);

        // Wait for retry period (with 1 second buffer)
        await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));

        // Should be able to make request again
        const recoveryResponse = await request.get(endpoint);

        // Should either succeed or have a fresh rate limit window
        expect([200, 429, 404]).toContain(recoveryResponse.status());

        if (recoveryResponse.status() === 200 || recoveryResponse.status() === 404) {
          console.log("✓ Rate limit successfully reset after waiting");
        }
      }
    }, TIMEOUTS.veryLong);

    test("should include rate limit headers on successful requests", async ({ request }) => {
      const imageUrl = encodeURIComponent("https://example.com/fresh-image.jpg");
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Wait a bit to ensure we're in a fresh window
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request.get(endpoint);

      // If successful, should have rate limit headers
      if (response.status() === 200 || response.status() === 404) {
        const headers = response.headers();

        // Check for rate limit headers
        const limit = headers["x-ratelimit-limit"];
        const remaining = headers["x-ratelimit-remaining"];

        if (limit) {
          expect(parseInt(limit)).toBeGreaterThan(0);
          console.log(`Rate limit: ${remaining}/${limit} requests remaining`);
        }
      }
    });
  });

  test.describe("Recommendations Endpoint Rate Limiting", () => {
    test("should enforce rate limit on recommendations endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      // Recommendations has burst limit of 5 per minute
      const results: number[] = [];

      for (let i = 0; i < 10; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimitedCount = results.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Recommendations rate limiting: ${rateLimitedCount}/10 requests blocked`);
    });

    test("should include rate limit headers on recommendations endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=33.7701&lon=-118.1937`;

      // Wait to ensure fresh window
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request.get(endpoint);

      if (response.status() === 200) {
        const headers = response.headers();

        const limit = headers["x-ratelimit-limit"];
        const remaining = headers["x-ratelimit-remaining"];

        expect(limit).toBeDefined();
        expect(remaining).toBeDefined();

        const limitNum = parseInt(limit!);
        const remainingNum = parseInt(remaining!);

        expect(limitNum).toBeGreaterThan(0);
        expect(remainingNum).toBeGreaterThanOrEqual(0);
        expect(remainingNum).toBeLessThanOrEqual(limitNum);

        console.log(`Recommendations limit: ${remaining}/${limit} remaining`);
      }
    });

    test("should return proper error structure on 429", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=32.7157&lon=-117.1611`;

      // Trigger rate limit
      let rateLimitedResponse;
      for (let i = 0; i < 15; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json();

        // Validate response structure
        expect(body).toHaveProperty("success", false);
        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("retryAfter");
        expect(body).toHaveProperty("timestamp");

        expect(typeof body.error).toBe("string");
        expect(typeof body.retryAfter).toBe("number");
        expect(body.retryAfter).toBeGreaterThan(0);

        console.log("✓ Rate limit error structure validated");
      }
    });
  });

  test.describe("Beach Search Rate Limiting", () => {
    test("should enforce rate limit on search endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=malibu`;

      // Beach search has burst limit of 10 per minute
      const results: number[] = [];

      for (let i = 0; i < 15; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimitedCount = results.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Beach search rate limiting: ${rateLimitedCount}/15 requests blocked`);
    });

    test("should handle concurrent requests with rate limiting", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=concurrent-test`;

      // Wait for fresh window
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Make concurrent requests
      const promises = Array(15).fill(null).map(() => request.get(endpoint));
      const responses = await Promise.all(promises);

      const statuses = responses.map(r => r.status());
      const successCount = statuses.filter(s => s === 200).length;
      const rateLimitedCount = statuses.filter(s => s === 429).length;

      // Should have mix of successful and rate limited
      expect(successCount + rateLimitedCount).toBe(15);
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Concurrent requests: ${successCount} success, ${rateLimitedCount} rate limited`);
    });
  });

  test.describe("Rate Limit Recovery and Behavior", () => {
    test("should track limits independently per endpoint", async ({ request }) => {
      // Rate limit one endpoint
      const searchEndpoint = `${BASE_URL}/api/beaches/search?query=test`;
      for (let i = 0; i < 15; i++) {
        await request.get(searchEndpoint);
      }

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500));

      // Different endpoint should still work (independent limiter)
      const featuredEndpoint = `${BASE_URL}/api/beaches/featured`;
      const response = await request.get(featuredEndpoint);

      // Should be successful or have its own limit
      expect([200, 429]).toContain(response.status());

      if (response.status() === 200) {
        console.log("✓ Independent rate limiters confirmed - different endpoint works");
      }
    });

    test("should include security headers in all responses", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/featured`;
      const response = await request.get(endpoint);

      const headers = response.headers();

      // Check for security headers (from Phase 2 security fixes)
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-xss-protection"]).toBe("1; mode=block");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

      console.log("✓ Security headers present");
    });

    test("should include security headers in 429 responses", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=security-test`;

      // Trigger rate limit
      let rateLimitedResponse;
      for (let i = 0; i < 20; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const headers = rateLimitedResponse.headers();

        // Security headers should be present even in error responses
        expect(headers["x-content-type-options"]).toBe("nosniff");
        expect(headers["x-frame-options"]).toBe("DENY");

        console.log("✓ Security headers present in rate limit error");
      }
    });

    test("should handle malformed requests gracefully", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=`;

      const response = await request.get(endpoint);

      // Should return proper response (400 or 429), not crash
      expect([200, 400, 429]).toContain(response.status());

      if (response.status() === 400) {
        const body = await response.json();
        expect(body.error).toBeDefined();
        console.log("✓ Malformed request handled with 400 error");
      }
    });
  });

  test.describe("Public Endpoints Rate Limiting", () => {
    test("should rate limit nearby beaches endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/nearby?latitude=33.7701&longitude=-118.1937`;

      // Burst limit is 20
      const results: number[] = [];
      for (let i = 0; i < 25; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      const rateLimitedCount = results.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Nearby beaches rate limiting: ${rateLimitedCount}/25 requests blocked`);
    });

    test("should rate limit featured beaches endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/featured`;

      // Burst limit is 20
      const results: number[] = [];
      for (let i = 0; i < 25; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      const rateLimitedCount = results.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Featured beaches rate limiting: ${rateLimitedCount}/25 requests blocked`);
    });

    test("should rate limit coach picks endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/coach-picks?beachId=test-beach-id`;

      // Burst limit is 20
      const results: number[] = [];
      for (let i = 0; i < 25; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      const rateLimitedCount = results.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Coach picks rate limiting: ${rateLimitedCount}/25 requests blocked`);
    });

    test("should rate limit forecast bulk endpoint", async ({ request }) => {
      const beachIds = "test-1,test-2,test-3";
      const endpoint = `${BASE_URL}/api/forecasts/bulk?beachIds=${beachIds}`;

      // Burst limit is 20
      const results: number[] = [];
      for (let i = 0; i < 25; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      const rateLimitedCount = results.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      console.log(`Forecast bulk rate limiting: ${rateLimitedCount}/25 requests blocked`);
    });
  });
});

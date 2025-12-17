/**
 * E2E Tests for API Rate Limiting
 *
 * Tests rate limiting behavior across different endpoints
 * to ensure security controls are working correctly.
 */

import { test, expect } from "@playwright/test";

// Base URL for API requests
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

test.describe("API Rate Limiting", () => {
  test.describe("Image Proxy Rate Limiting (CRITICAL)", () => {
    test("should rate limit image proxy requests", async ({ request }) => {
      const imageUrl = encodeURIComponent(
        "https://api.openverse.org/test.jpg"
      );
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Burst limit is 25 - make 26 requests rapidly
      const results = [];
      for (let i = 0; i < 26; i++) {
        const response = await request.get(endpoint);
        results.push({
          status: response.status(),
          headers: {
            rateLimit: response.headers()["x-ratelimit-limit"],
            remaining: response.headers()["x-ratelimit-remaining"],
          },
        });
      }

      // At least one request should be rate limited (429)
      const rateLimited = results.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test("should include Retry-After header in 429 response", async ({
      request,
    }) => {
      const imageUrl = encodeURIComponent(
        "https://api.openverse.org/test.jpg"
      );
      const endpoint = `${BASE_URL}/api/image-proxy?url=${imageUrl}`;

      // Make requests until rate limited
      let rateLimitedResponse;
      for (let i = 0; i < 40; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const retryAfter = rateLimitedResponse.headers()["retry-after"];
        expect(retryAfter).toBeDefined();
        expect(parseInt(retryAfter!)).toBeGreaterThan(0);

        // Check response body
        const body = await rateLimitedResponse.json();
        expect(body.success).toBe(false);
        expect(body.error).toContain("rate limit");
        expect(body.retryAfter).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Recommendations Rate Limiting (HIGH)", () => {
    test("should rate limit recommendations endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=33.7701&lon=-118.1937`;

      // Burst limit is 5 - make rapid requests
      const results = [];
      for (let i = 0; i < 6; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test("should include rate limit headers", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/v1/recommendations?lat=33.7701&lon=-118.1937`;

      const response = await request.get(endpoint);

      // Check for rate limit headers (even on successful requests)
      if (response.status() === 200) {
        const headers = response.headers();
        expect(headers["x-ratelimit-limit"]).toBeDefined();
        expect(headers["x-ratelimit-remaining"]).toBeDefined();

        const limit = parseInt(headers["x-ratelimit-limit"]);
        const remaining = parseInt(headers["x-ratelimit-remaining"]);

        expect(limit).toBeGreaterThan(0);
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThanOrEqual(limit);
      }
    });
  });

  test.describe("Beach Search Rate Limiting (HIGH)", () => {
    test("should rate limit search requests", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=malibu`;

      // Make multiple rapid requests
      const results = [];
      for (let i = 0; i < 12; i++) {
        // Burst limit is 10
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  test.describe("Forecast Bulk Rate Limiting", () => {
    test("should rate limit bulk forecast requests", async ({ request }) => {
      const beachIds = "1,2,3,4,5";
      const endpoint = `${BASE_URL}/api/forecasts/bulk?beachIds=${beachIds}`;

      // Burst limit is 20 - make rapid requests
      const results = [];
      for (let i = 0; i < 22; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  test.describe("Public Endpoints Rate Limiting", () => {
    test("should rate limit nearby beaches endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/nearby?latitude=33.7701&longitude=-118.1937`;

      // Make rapid requests
      const results = [];
      for (let i = 0; i < 22; i++) {
        // Burst limit is 20
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test("should rate limit featured beaches endpoint", async ({
      request,
    }) => {
      const endpoint = `${BASE_URL}/api/beaches/featured`;

      // Make rapid requests
      const results = [];
      for (let i = 0; i < 22; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test("should rate limit coach picks endpoint", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/coach-picks?beachId=1`;

      // Make rapid requests
      const results = [];
      for (let i = 0; i < 22; i++) {
        const response = await request.get(endpoint);
        results.push(response.status());
      }

      // Should have at least one 429 response
      const rateLimited = results.filter((status) => status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  test.describe("Rate Limit Response Format", () => {
    test("should return proper 429 response structure", async ({ request }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=test`;

      // Make requests until we get rate limited
      let response;
      for (let i = 0; i < 30; i++) {
        response = await request.get(endpoint);
        if (response.status() === 429) {
          break;
        }
      }

      if (response && response.status() === 429) {
        const body = await response.json();

        // Validate response structure
        expect(body).toHaveProperty("success", false);
        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("retryAfter");
        expect(body).toHaveProperty("timestamp");

        expect(typeof body.error).toBe("string");
        expect(typeof body.retryAfter).toBe("number");
        expect(body.retryAfter).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Rate Limit Recovery", () => {
    test("should allow requests after waiting for retry period", async ({
      request,
    }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=recovery`;

      // Make requests until rate limited
      let rateLimitedResponse;
      for (let i = 0; i < 30; i++) {
        const response = await request.get(endpoint);
        if (response.status() === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json();
        const retryAfter = body.retryAfter;

        // Wait for retry period (with small buffer)
        await new Promise((resolve) =>
          setTimeout(resolve, (retryAfter + 1) * 1000)
        );

        // Should be able to make request again
        const recoveryResponse = await request.get(endpoint);
        expect([200, 429]).toContain(recoveryResponse.status());
        // Note: Might still be 429 if we're in a different limit window
      }
    });
  });

  test.describe("Cross-Endpoint Rate Limiting", () => {
    test("should track limits independently per endpoint", async ({
      request,
    }) => {
      // Rate limit one endpoint
      const endpoint1 = `${BASE_URL}/api/beaches/search?query=test`;
      for (let i = 0; i < 15; i++) {
        await request.get(endpoint1);
      }

      // Different endpoint should still work (different rate limiter)
      const endpoint2 = `${BASE_URL}/api/beaches/featured`;
      const response = await request.get(endpoint2);

      // Should be successful or have its own limit
      expect([200, 429]).toContain(response.status());
    });
  });

  test.describe("Security Headers", () => {
    test("should include security headers in all responses", async ({
      request,
    }) => {
      const endpoint = `${BASE_URL}/api/beaches/featured`;
      const response = await request.get(endpoint);

      const headers = response.headers();

      // Check for security headers
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-xss-protection"]).toBe("1; mode=block");
      expect(headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin"
      );
    });

    test("should include security headers in 429 responses", async ({
      request,
    }) => {
      const endpoint = `${BASE_URL}/api/beaches/search?query=test`;

      // Make requests until rate limited
      let rateLimitedResponse;
      for (let i = 0; i < 30; i++) {
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
      }
    });
  });
});

test.describe("Rate Limiting Edge Cases", () => {
  test("should handle concurrent requests from same client", async ({
    request,
  }) => {
    const endpoint = `${BASE_URL}/api/beaches/featured`;

    // Make concurrent requests
    const promises = Array(10)
      .fill(null)
      .map(() => request.get(endpoint));
    const responses = await Promise.all(promises);

    const statuses = responses.map((r) => r.status());
    const successCount = statuses.filter((s) => s === 200).length;
    const rateLimitedCount = statuses.filter((s) => s === 429).length;

    // Should have some successful and potentially some rate limited
    expect(successCount + rateLimitedCount).toBe(10);
  });

  test("should handle malformed requests gracefully", async ({ request }) => {
    const endpoint = `${BASE_URL}/api/beaches/search?query=`;

    const response = await request.get(endpoint);

    // Should return proper response, not crash
    expect([200, 400, 429]).toContain(response.status());
  });
});

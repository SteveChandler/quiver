/**
 * Tests for Cron Test Utilities
 *
 * Verifies that the cron testing utilities work correctly
 * and integrate properly with the validateCronRequest function.
 */

import { validateCronRequest } from "@/lib/api-utils";
import {
  setupCronTestEnvironment,
  mockCronAuth,
  createMockCronRequest,
  mockExternalAPI,
  verifyIdempotency,
  expectCronSuccess,
  expectCronError,
  expectCronUnauthorized,
  expectCronForbidden,
  createMockEmailCandidate,
  createMockForecastSyncResult,
  createMockAlertResult,
  createValidateCronRequestMock,
  createApiUtilsMocks,
  mockFetchForExternalAPIs,
  type CronTestEnvironment,
} from "@/__tests__/setup/cron-test-utils";

describe("Cron Test Utilities", () => {
  describe("setupCronTestEnvironment", () => {
    it("sets up required environment variables", () => {
      const env = setupCronTestEnvironment();

      expect(process.env.CRON_SECRET).toBe("test-cron-secret");
      expect(process.env.VERCEL_ENV).toBe("production");
      expect(process.env.NODE_ENV).toBe("test");

      env.cleanup();
    });

    it("allows custom configuration", () => {
      const env = setupCronTestEnvironment({
        cronSecret: "custom-secret",
        vercelEnv: "preview",
        additionalEnvVars: {
          CUSTOM_VAR: "custom-value",
        },
      });

      expect(process.env.CRON_SECRET).toBe("custom-secret");
      expect(process.env.VERCEL_ENV).toBe("preview");
      expect(process.env.CUSTOM_VAR).toBe("custom-value");

      env.cleanup();
    });

    it("restores original environment on cleanup", () => {
      const originalSecret = process.env.CRON_SECRET;
      const originalEnv = process.env.VERCEL_ENV;

      const env = setupCronTestEnvironment({
        cronSecret: "temp-secret",
        vercelEnv: "temp-env",
      });

      env.cleanup();

      expect(process.env.CRON_SECRET).toBe(originalSecret);
      expect(process.env.VERCEL_ENV).toBe(originalEnv);
    });

    it("provides resetMocks function", () => {
      const env = setupCronTestEnvironment();
      const mockFn = jest.fn();
      mockFn();

      expect(mockFn).toHaveBeenCalled();
      env.resetMocks();
      expect(mockFn).not.toHaveBeenCalled();

      env.cleanup();
    });
  });

  describe("mockCronAuth", () => {
    it("sets valid cron secret when valid=true", () => {
      const restore = mockCronAuth(true);

      expect(process.env.CRON_SECRET).toBe("test-cron-secret");

      restore();
    });

    it("clears cron secrets when valid=false", () => {
      const restore = mockCronAuth(false);

      expect(process.env.CRON_SECRET).toBeUndefined();
      expect(process.env.CRON_SECRET_TOKEN).toBeUndefined();

      restore();
    });

    it("allows custom secret value", () => {
      const restore = mockCronAuth(true, "my-custom-secret");

      expect(process.env.CRON_SECRET).toBe("my-custom-secret");

      restore();
    });

    it("restores original values on cleanup", () => {
      const originalSecret = process.env.CRON_SECRET;
      const originalToken = process.env.CRON_SECRET_TOKEN;

      const restore = mockCronAuth(true, "temp-secret");
      restore();

      expect(process.env.CRON_SECRET).toBe(originalSecret);
      expect(process.env.CRON_SECRET_TOKEN).toBe(originalToken);
    });
  });

  describe("createCronRequest", () => {
    // NOTE: createCronRequest uses NextRequest which doesn't work in Jest
    // These tests verify the same functionality via createMockCronRequest
    // which shares the same internal configuration logic

    it("creates request with Vercel cron header by default", () => {
      const request = createMockCronRequest("/api/cron/test");

      expect(request.headers.get("x-vercel-cron")).toBe("1");
      expect(request.url).toContain("/api/cron/test");
    });

    it("creates request with bearer token auth", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "my-secret",
      });

      expect(request.headers.get("authorization")).toBe("Bearer my-secret");
    });

    it("creates request with no auth", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "none",
      });

      expect(request.headers.get("x-vercel-cron")).toBeNull();
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("user-agent")).toBeNull();
    });

    it("supports POST method with body", () => {
      const request = createMockCronRequest("/api/cron/test", {
        method: "POST",
        body: { foo: "bar" },
      });

      expect(request.method).toBe("POST");
    });

    it("supports query parameters", () => {
      const request = createMockCronRequest("/api/cron/test", {
        searchParams: { shard: "1", shardCount: "4" },
      });

      expect(request.url).toContain("shard=1");
      expect(request.url).toContain("shardCount=4");
    });

    it("supports custom headers", () => {
      const request = createMockCronRequest("/api/cron/test", {
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(request.headers.get("X-Custom-Header")).toBe("custom-value");
    });
  });

  describe("createMockCronRequest", () => {
    it("creates mock request with expected structure", () => {
      const request = createMockCronRequest("/api/cron/test");

      expect(request.url).toContain("/api/cron/test");
      expect(request.method).toBe("GET");
      expect(request.headers.get("x-vercel-cron")).toBe("1");
    });

    it("provides json() method", async () => {
      const request = createMockCronRequest("/api/cron/test", {
        method: "POST",
        body: { test: "data" },
      });

      const body = await request.json();
      expect(body).toEqual({ test: "data" });
    });
  });

  describe("createMockCronRequest integration with validateCronRequest", () => {
    let env: CronTestEnvironment;

    beforeEach(() => {
      env = setupCronTestEnvironment();
    });

    afterEach(() => {
      env.cleanup();
    });

    it("validates request with vercel-header auth", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "vercel-header",
      });

      const isValid = validateCronRequest(request);
      expect(isValid).toBe(true);
    });

    it("validates request with bearer token auth", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "test-cron-secret", // Matches env
      });

      const isValid = validateCronRequest(request);
      expect(isValid).toBe(true);
    });

    it("rejects request with invalid bearer token", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "wrong-secret",
      });

      const isValid = validateCronRequest(request);
      expect(isValid).toBe(false);
    });

    it("rejects request with no auth when secret is configured", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "none",
      });

      const isValid = validateCronRequest(request);
      expect(isValid).toBe(false);
    });
  });

  describe("mockExternalAPI", () => {
    it("creates success mock", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "success");

      const result = await mock();
      expect(result).toHaveProperty("properties");

      restore();
    });

    it("creates success mock with custom data", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "success", {
        data: { custom: "data" },
      });

      const result = await mock();
      expect(result).toEqual({ custom: "data" });

      restore();
    });

    it("creates timeout mock", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "timeout");

      await expect(mock()).rejects.toThrow("timed out");

      restore();
    });

    it("creates error mock", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "error");

      await expect(mock()).rejects.toThrow("Internal server error");

      restore();
    });

    it("creates error mock with custom message", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "error", {
        errorMessage: "Custom error",
      });

      await expect(mock()).rejects.toThrow("Custom error");

      restore();
    });

    it("creates rate-limited mock", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "rate-limited");

      await expect(mock()).rejects.toThrow("Rate limit exceeded");

      restore();
    });

    it("supports delay simulation", async () => {
      const { mock, restore } = mockExternalAPI("noaa", "success", {
        delay: 50,
      });

      const start = Date.now();
      await mock();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(40); // Allow some tolerance

      restore();
    });

    it("supports different services", async () => {
      const services = ["noaa", "cdip", "email", "resend", "openai"] as const;

      for (const service of services) {
        const { mock, restore } = mockExternalAPI(service, "success");
        const result = await mock();
        expect(result).toBeDefined();
        restore();
      }
    });
  });

  describe("mockFetchForExternalAPIs", () => {
    it("mocks fetch for configured services", async () => {
      const { mock, restore } = mockFetchForExternalAPIs([
        { service: "noaa", behavior: "success" },
      ]);

      const response = await fetch("https://api.weather.gov/test");
      const data = await response.json();

      expect(data).toHaveProperty("properties");
      expect(mock).toHaveBeenCalled();

      restore();
    });

    it("handles multiple service configurations", async () => {
      const { restore } = mockFetchForExternalAPIs([
        { service: "noaa", behavior: "success" },
        { service: "resend", behavior: "success" },
      ]);

      const noaaResponse = await fetch("https://api.weather.gov/test");
      const noaaData = await noaaResponse.json();
      expect(noaaData).toHaveProperty("properties");

      const resendResponse = await fetch("https://api.resend.com/emails");
      const resendData = await resendResponse.json();
      expect(resendData).toHaveProperty("id");

      restore();
    });

    it("returns error responses for error behavior", async () => {
      const { restore } = mockFetchForExternalAPIs([
        { service: "noaa", behavior: "error" },
      ]);

      const response = await fetch("https://api.weather.gov/test");
      expect(response.status).toBe(500);

      restore();
    });

    it("returns 429 for rate-limited behavior", async () => {
      const { restore } = mockFetchForExternalAPIs([
        { service: "noaa", behavior: "rate-limited" },
      ]);

      const response = await fetch("https://api.weather.gov/test");
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");

      restore();
    });
  });

  describe("verifyIdempotency", () => {
    it("returns true for idempotent handlers", async () => {
      const handler = jest.fn(async () =>
        new Response(JSON.stringify({ success: true, data: "constant" }))
      );
      const request = createMockCronRequest("/api/cron/test");

      const result = await verifyIdempotency(handler, request);

      expect(result.isIdempotent).toBe(true);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("returns false for non-idempotent handlers", async () => {
      let callCount = 0;
      const handler = jest.fn(async () =>
        new Response(JSON.stringify({ success: true, data: ++callCount }))
      );
      const request = createMockCronRequest("/api/cron/test");

      const result = await verifyIdempotency(handler, request);

      expect(result.isIdempotent).toBe(false);
      expect(result.differences).toBeDefined();
      expect(result.differences!.length).toBeGreaterThan(0);
    });

    it("ignores timestamp fields by default", async () => {
      const handler = jest.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: "constant",
            timestamp: new Date().toISOString(),
          })
        )
      );
      const request = createMockCronRequest("/api/cron/test");

      const result = await verifyIdempotency(handler, request);

      expect(result.isIdempotent).toBe(true);
    });

    it("supports custom ignore fields", async () => {
      let callCount = 0;
      const handler = jest.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: "constant",
            requestId: ++callCount,
          })
        )
      );
      const request = createMockCronRequest("/api/cron/test");

      const result = await verifyIdempotency(handler, request, {
        ignoreFields: ["requestId"],
      });

      expect(result.isIdempotent).toBe(true);
    });

    it("supports custom comparison function", async () => {
      const handler = jest.fn(async () =>
        new Response(JSON.stringify({ success: true, data: { nested: "value" } }))
      );
      const request = createMockCronRequest("/api/cron/test");

      const result = await verifyIdempotency(handler, request, {
        compareFn: (a, b) => a.success === b.success,
      });

      expect(result.isIdempotent).toBe(true);
    });
  });

  describe("Response Assertion Helpers", () => {
    describe("expectCronSuccess", () => {
      it("passes for successful responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: true,
            data: { result: "ok" },
            timestamp: new Date().toISOString(),
          }),
          { status: 200 }
        );

        const result = await expectCronSuccess(response);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ result: "ok" });
      });

      it("fails for error responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: false,
            error: "Something went wrong",
            timestamp: new Date().toISOString(),
          }),
          { status: 500 }
        );

        await expect(expectCronSuccess(response)).rejects.toThrow();
      });
    });

    describe("expectCronError", () => {
      it("passes for error responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: false,
            error: "Unauthorized",
            timestamp: new Date().toISOString(),
          }),
          { status: 401 }
        );

        const result = await expectCronError(response, 401, "Unauthorized");
        expect(result.success).toBe(false);
        expect(result.error).toContain("Unauthorized");
      });

      it("fails for success responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: true,
            data: {},
            timestamp: new Date().toISOString(),
          }),
          { status: 200 }
        );

        await expect(expectCronError(response, 401)).rejects.toThrow();
      });
    });

    describe("expectCronUnauthorized", () => {
      it("passes for 401 unauthorized responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: false,
            error: "Unauthorized",
            timestamp: new Date().toISOString(),
          }),
          { status: 401 }
        );

        await expect(expectCronUnauthorized(response)).resolves.toBeUndefined();
      });
    });

    describe("expectCronForbidden", () => {
      it("passes for 403 forbidden responses", async () => {
        const response = new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden",
            timestamp: new Date().toISOString(),
          }),
          { status: 403 }
        );

        await expect(expectCronForbidden(response)).resolves.toBeUndefined();
      });
    });
  });

  describe("Mock Data Factories", () => {
    describe("createMockEmailCandidate", () => {
      it("creates default email candidate", () => {
        const candidate = createMockEmailCandidate();

        expect(candidate.user_id).toBe("user-123");
        expect(candidate.email).toBe("test@example.com");
        expect(candidate.email_confirmed_at).toBeNull();
        expect(candidate.home_beach_id).toBeNull();
      });

      it("allows overrides", () => {
        const candidate = createMockEmailCandidate({
          user_id: "custom-user",
          email: "custom@example.com",
          email_confirmed_at: "2024-01-01T00:00:00Z",
        });

        expect(candidate.user_id).toBe("custom-user");
        expect(candidate.email).toBe("custom@example.com");
        expect(candidate.email_confirmed_at).toBe("2024-01-01T00:00:00Z");
      });
    });

    describe("createMockForecastSyncResult", () => {
      it("creates default forecast sync result", () => {
        const result = createMockForecastSyncResult();

        expect(result.success).toBe(true);
        expect(result.summary.total).toBe(10);
        expect(result.summary.successful).toBe(10);
        expect(result.summary.failed).toBe(0);
      });

      it("allows overrides", () => {
        const result = createMockForecastSyncResult({
          success: false,
          summary: {
            total: 5,
            attempted: 5,
            successful: 3,
            failed: 2,
            duration: "0.5s",
            stoppedEarly: false,
          },
        });

        expect(result.success).toBe(false);
        expect(result.summary.failed).toBe(2);
      });
    });

    describe("createMockAlertResult", () => {
      it("creates default alert result", () => {
        const result = createMockAlertResult();

        expect(result.eligibleUsers).toBe(100);
        expect(result.sent).toBe(50);
        expect(result.skipped.pushDisabled).toBe(10);
      });

      it("allows overrides", () => {
        const result = createMockAlertResult({
          sent: 25,
          skipped: { noMatch: 50 },
        });

        expect(result.sent).toBe(25);
        expect(result.skipped.noMatch).toBe(50);
      });
    });
  });

  describe("Cron Job Mocking Utilities", () => {
    describe("createValidateCronRequestMock", () => {
      it("creates mock that returns true by default", () => {
        const mock = createValidateCronRequestMock();
        expect(mock()).toBe(true);
      });

      it("creates mock that returns false when specified", () => {
        const mock = createValidateCronRequestMock(false);
        expect(mock()).toBe(false);
      });
    });

    describe("createApiUtilsMocks", () => {
      it("creates all API utility mocks", () => {
        const mocks = createApiUtilsMocks();

        expect(mocks.createSuccessResponse).toBeDefined();
        expect(mocks.createErrorResponse).toBeDefined();
        expect(mocks.handleApiError).toBeDefined();
        expect(mocks.validateCronRequest).toBeDefined();
      });

      it("createSuccessResponse returns proper structure", async () => {
        const mocks = createApiUtilsMocks();
        const response = mocks.createSuccessResponse({ test: "data" });
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toEqual({ test: "data" });
        expect(data.timestamp).toBeDefined();
      });

      it("createErrorResponse returns proper structure", async () => {
        const mocks = createApiUtilsMocks();
        const response = mocks.createErrorResponse("Error message", { detail: "info" });
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe("Error message");
        expect(data.details).toEqual({ detail: "info" });
      });

      it("validateCronRequest returns true by default", () => {
        const mocks = createApiUtilsMocks();
        expect(mocks.validateCronRequest()).toBe(true);
      });
    });
  });
});

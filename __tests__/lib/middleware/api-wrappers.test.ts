/**
 * API Wrappers Unit Tests
 *
 * Tests higher-order function wrappers for API routes including:
 * - withErrorHandler: Try-catch wrapping
 * - withAuth: Authentication injection
 * - createApiHandler: Composable pipeline
 * - Validation helpers
 * - Ownership helpers
 */

// Mock NextResponse BEFORE imports
jest.mock("next/server", () => {
  // Create a mock Response class
  class MockResponse {
    body: string;
    status: number;
    headers: Map<string, string>;

    constructor(body: string | null, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body || "";
      this.status = init?.status || 200;
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return JSON.parse(this.body);
    }
  }

  return {
    NextResponse: {
      json: (body: any, init?: { status?: number; headers?: Record<string, string> }) => {
        return new MockResponse(JSON.stringify(body), init);
      },
    },
    NextRequest: jest.fn().mockImplementation((url: string, init?: any) => ({
      url,
      method: init?.method || "GET",
      headers: new Map(Object.entries(init?.headers || {})),
      json: jest.fn().mockResolvedValue(init?.body ? JSON.parse(init.body) : {}),
      nextUrl: {
        pathname: "/api/test",
        searchParams: new URLSearchParams(),
      },
    })),
  };
});

jest.mock("@/lib/utils/enhanced-rate-limiter", () => ({
  getCachedRateLimiter: jest.fn(() => ({
    canMakeRequest: jest.fn(() => true),
    getRetryAfter: jest.fn(() => 0),
    recordRequest: jest.fn(),
    getStatus: jest.fn(() => ({ requestsRemaining: 10, timeUntilReset: 0 })),
    getDiagnostics: jest.fn(() => ({})),
  })),
}));

jest.mock("@/lib/api/rate-limit-config", () => ({
  RATE_LIMITS: {
    "public-default": { requestsPerMinute: 60 },
    "authenticated-default": { requestsPerMinute: 120 },
  },
  getRateLimitMessage: jest.fn(() => "Rate limit exceeded"),
}));

jest.mock("@/lib/monitoring/rate-limit-telemetry", () => ({
  logRateLimitViolation: jest.fn(),
}));

import { NextResponse } from "next/server";
import {
  withErrorHandler,
  withAuth,
  withRateLimit,
  createApiHandler,
  validateUuidParam,
  validateRequiredParams,
  requireOwnership,
} from "@/lib/middleware/api-wrappers";
import { createMockUser } from "@/test-utils/api-test-helpers";

// Mock Supabase server client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Separate mock for the bearer-token client so withAuth's Bearer branch can
// be tested independently of the cookie path.
const mockBearerSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockBearerSupabaseClient),
}));

// Helper to create mock request
function createTestRequest(method = "GET", body?: any) {
  return {
    url: "http://localhost:3000/api/test",
    method,
    headers: new Map([["content-type", "application/json"]]),
    json: jest.fn().mockResolvedValue(body || {}),
    nextUrl: {
      pathname: "/api/test",
      searchParams: new URLSearchParams(),
    },
  };
}

// Helper to create a mock request that carries an Authorization: Bearer header
function createBearerRequest(token: string, method = "GET", body?: any) {
  return {
    url: "http://localhost:3000/api/test",
    method,
    headers: new Map([
      ["content-type", "application/json"],
      ["authorization", `Bearer ${token}`],
    ]),
    json: jest.fn().mockResolvedValue(body || {}),
    nextUrl: {
      pathname: "/api/test",
      searchParams: new URLSearchParams(),
    },
  };
}

// Helper to mock authenticated user
function mockAuthenticatedUser(user = createMockUser()) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
  return user;
}

// Helper to mock unauthenticated user
function mockUnauthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

describe("API Wrappers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("withErrorHandler", () => {
    it("should pass through successful responses", async () => {
      const mockResponse = NextResponse.json({ success: true, data: { test: "data" } });
      const successHandler = jest.fn().mockResolvedValue(mockResponse);

      const wrappedHandler = withErrorHandler(successHandler);
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);
      const data = await response.json();

      expect(successHandler).toHaveBeenCalledWith(request, undefined);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({ test: "data" });
    });

    it("should catch and handle thrown errors", async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error("Test error"));

      const wrappedHandler = withErrorHandler(errorHandler, {
        errorMessage: "Custom error message",
      });
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Custom error message");
    });

    it("should handle errors without custom message", async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error("Original error"));

      const wrappedHandler = withErrorHandler(errorHandler);
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);

      expect(response.status).toBe(500);
    });

    it("should pass context to handler", async () => {
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withErrorHandler(handler);
      const request = createTestRequest();
      const context = { params: { id: "test-123" } };

      await wrappedHandler(request as any, context);

      expect(handler).toHaveBeenCalledWith(request, context);
    });
  });

  describe("withAuth", () => {
    it("should inject user and supabase for authenticated users", async () => {
      const mockUser = mockAuthenticatedUser();

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true, data: { userId: mockUser.id } })
      );

      const wrappedHandler = withAuth(handler);
      const request = createTestRequest();

      const response = await wrappedHandler(request as any, { params: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          user: mockUser,
          supabase: mockSupabaseClient,
          params: {},
        })
      );
    });

    it("should return 401 for unauthenticated users", async () => {
      mockUnauthenticatedUser();

      const handler = jest.fn();

      const wrappedHandler = withAuth(handler);
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should allow unauthenticated access with optional: true", async () => {
      mockUnauthenticatedUser();

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true, data: { isLoggedIn: false } })
      );

      const wrappedHandler = withAuth(handler, { optional: true });
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          user: null,
          supabase: mockSupabaseClient,
        })
      );
    });

    it("should use custom auth error message", async () => {
      mockUnauthenticatedUser();

      const handler = jest.fn();

      const wrappedHandler = withAuth(handler, {
        authErrorMessage: "Please sign in to continue",
      });
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Please sign in to continue");
    });

    it("should handle errors in handler with error handling", async () => {
      mockAuthenticatedUser();

      const handler = jest.fn().mockRejectedValue(new Error("Handler error"));

      const wrappedHandler = withAuth(handler, {
        errorMessage: "Failed to process request",
      });
      const request = createTestRequest();

      const response = await wrappedHandler(request as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to process request");
    });

    it("should pass params from context", async () => {
      mockAuthenticatedUser();

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

      const wrappedHandler = withAuth(handler);
      const request = createTestRequest();
      const context = { params: { id: "session-123", commentId: "comment-456" } };

      await wrappedHandler(request as any, context);

      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          params: { id: "session-123", commentId: "comment-456" },
        })
      );
    });

    describe("Bearer token auth (native clients)", () => {
      it("should use the bearer-scoped client when Authorization: Bearer is present", async () => {
        const mockUser = createMockUser();
        mockBearerSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const handler = jest.fn().mockResolvedValue(
          NextResponse.json({ success: true, data: { userId: mockUser.id } })
        );

        const wrappedHandler = withAuth(handler);
        const request = createBearerRequest("valid-jwt");

        const response = await wrappedHandler(request as any, { params: {} });
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(mockBearerSupabaseClient.auth.getUser).toHaveBeenCalledWith("valid-jwt");
        // Handler must receive the bearer-scoped client so its RLS-protected
        // queries are scoped to the correct user, not the anon cookie client.
        expect(handler).toHaveBeenCalledWith(
          request,
          expect.objectContaining({
            user: mockUser,
            supabase: mockBearerSupabaseClient,
          })
        );
        // Cookie path must not be consulted when a Bearer token is present.
        expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
      });

      it("should return 401 when Bearer token is invalid and auth is required", async () => {
        mockBearerSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { name: "AuthError", message: "invalid JWT" } as any,
        });

        const handler = jest.fn();

        const wrappedHandler = withAuth(handler);
        const request = createBearerRequest("forged-jwt");

        const response = await wrappedHandler(request as any);

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
      });

      it("should run handler with user: null when Bearer is invalid but auth is optional", async () => {
        mockBearerSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { name: "AuthError", message: "expired JWT" } as any,
        });

        const handler = jest.fn().mockResolvedValue(
          NextResponse.json({ success: true, data: { isLoggedIn: false } })
        );

        const wrappedHandler = withAuth(handler, { optional: true });
        const request = createBearerRequest("stale-jwt");

        const response = await wrappedHandler(request as any);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(handler).toHaveBeenCalledWith(
          request,
          expect.objectContaining({
            user: null,
            // Still uses the bearer-scoped client even with a bad token —
            // the handler decides what it can do anonymously.
            supabase: mockBearerSupabaseClient,
          })
        );
      });
    });
  });

  describe("createApiHandler", () => {
    it("should create authenticated handler by default", async () => {
      const mockUser = mockAuthenticatedUser();

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true, data: "test" })
      );

      const apiHandler = createApiHandler(handler);
      const request = createTestRequest();

      await apiHandler(request as any);

      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          user: mockUser,
          supabase: mockSupabaseClient,
        })
      );
    });

    it("should create optional auth handler", async () => {
      mockUnauthenticatedUser();

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

      const apiHandler = createApiHandler(handler, { optionalAuth: true });
      const request = createTestRequest();

      await apiHandler(request as any);

      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          user: null,
        })
      );
    });

    it("should apply error message to handler", async () => {
      mockAuthenticatedUser();

      const handler = jest.fn().mockRejectedValue(new Error("Test error"));

      const apiHandler = createApiHandler(handler, {
        errorMessage: "Custom API error",
      });
      const request = createTestRequest();

      const response = await apiHandler(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Custom API error");
    });

    it("should work with auth: false (public routes)", async () => {
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));

      const apiHandler = createApiHandler(handler, { auth: false });
      const request = createTestRequest();

      await apiHandler(request as any);

      expect(handler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          user: null,
          supabase: mockSupabaseClient,
        })
      );
    });
  });

  describe("validateUuidParam", () => {
    it("should return valid UUID", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const result = validateUuidParam(validUuid);

      expect("value" in result).toBe(true);
      if ("value" in result) {
        expect(result.value).toBe(validUuid);
      }
    });

    it("should return error for invalid UUID", () => {
      const result = validateUuidParam("invalid-uuid");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(400);
      }
    });

    it("should return error for undefined", () => {
      const result = validateUuidParam(undefined);

      expect("error" in result).toBe(true);
    });

    it("should return error for empty string", () => {
      const result = validateUuidParam("");

      expect("error" in result).toBe(true);
    });

    it("should use custom parameter name in error", async () => {
      const result = validateUuidParam("invalid", "session");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        const data = await result.error.json();
        expect(data.error).toContain("session");
      }
    });
  });

  describe("validateRequiredParams", () => {
    it("should return null for valid params", () => {
      const params = { lat: "33.75", lon: "-118.41" };
      const result = validateRequiredParams(params, ["lat", "lon"]);

      expect(result).toBeNull();
    });

    it("should return error for missing params", async () => {
      const params = { lat: "33.75" };
      const result = validateRequiredParams(params, ["lat", "lon"]);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.status).toBe(400);
        const data = await result.json();
        expect(data.error).toContain("lon");
      }
    });

    it("should return error for null params", () => {
      const params = { lat: "33.75", lon: null };
      const result = validateRequiredParams(params, ["lat", "lon"]);

      expect(result).not.toBeNull();
    });

    it("should return error for multiple missing params", async () => {
      const params = { name: "test" };
      const result = validateRequiredParams(params, ["lat", "lon", "name"]);

      expect(result).not.toBeNull();
      if (result) {
        const data = await result.json();
        expect(data.details.missing).toContain("lat");
        expect(data.details.missing).toContain("lon");
      }
    });
  });

  describe("requireOwnership", () => {
    it("should return ok for owned resource", async () => {
      const userId = "user-123";
      const resourceId = "resource-456";

      // Mock database query
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: resourceId, user_id: userId },
          error: null,
        }),
      }));

      const result = await requireOwnership(
        mockSupabaseClient as any,
        "sessions" as any,
        resourceId,
        userId,
        "Session"
      );

      expect("ok" in result).toBe(true);
    });

    it("should return 404 for non-existent resource", async () => {
      // Mock PGRST116 error (not found)
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      }));

      const result = await requireOwnership(
        mockSupabaseClient as any,
        "sessions" as any,
        "non-existent-id",
        "user-123",
        "Session"
      );

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(404);
        const data = await result.error.json();
        expect(data.error).toBe("Session not found");
      }
    });

    it("should return 403 for resource owned by different user", async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "resource-123", user_id: "different-user" },
          error: null,
        }),
      }));

      const result = await requireOwnership(
        mockSupabaseClient as any,
        "sessions" as any,
        "resource-123",
        "user-123",
        "Session"
      );

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(403);
        const data = await result.error.json();
        expect(data.error).toBe("Forbidden");
      }
    });

    it("should throw for other database errors", async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "OTHER_ERROR", message: "Database error" },
        }),
      }));

      await expect(
        requireOwnership(
          mockSupabaseClient as any,
          "sessions" as any,
          "resource-123",
          "user-123"
        )
      ).rejects.toEqual({ code: "OTHER_ERROR", message: "Database error" });
    });
  });

  describe("Integration: Full API Handler Flow", () => {
    it("should handle complete authenticated CRUD flow", async () => {
      const mockUser = mockAuthenticatedUser();

      // Mock database for ownership check and data fetch
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: "session-123", user_id: mockUser.id, notes: "Updated notes" },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      }));

      const handler = createApiHandler(
        async (request: any, { user, supabase, params }: any) => {
          // Validate UUID
          const uuidResult = validateUuidParam(params.id, "session");
          if ("error" in uuidResult) return uuidResult.error;

          // Check ownership
          const ownership = await requireOwnership(
            supabase,
            "sessions" as any,
            params.id,
            user.id,
            "Session"
          );
          if ("error" in ownership) return ownership.error;

          // Business logic (simulated)
          return NextResponse.json({
            success: true,
            data: { session: { id: params.id, user_id: user.id } },
            timestamp: new Date().toISOString(),
          });
        },
        { auth: true, errorMessage: "Failed to update session" }
      );

      const request = createTestRequest("PATCH");
      const context = { params: { id: "123e4567-e89b-12d3-a456-426614174000" } };

      const response = await handler(request as any, context);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.session.user_id).toBe(mockUser.id);
    });

    it("should reject unauthenticated access to protected route", async () => {
      mockUnauthenticatedUser();

      const handler = createApiHandler(
        async () => NextResponse.json({ success: true }),
        { auth: true }
      );

      const request = createTestRequest();
      const response = await handler(request as any);

      expect(response.status).toBe(401);
    });

    it("should handle public routes with optional auth", async () => {
      mockUnauthenticatedUser();

      const handler = createApiHandler(
        async (request: any, { user }: any) => {
          return NextResponse.json({
            success: true,
            data: { isLoggedIn: !!user },
            timestamp: new Date().toISOString(),
          });
        },
        { optionalAuth: true }
      );

      const request = createTestRequest();
      const response = await handler(request as any);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.isLoggedIn).toBe(false);
    });
  });

  describe("withRateLimit (authAware)", () => {
    it("should use authenticated limit key when user is authenticated", async () => {
      const { getCachedRateLimiter } = await import("@/lib/utils/enhanced-rate-limiter");
      (getCachedRateLimiter as any).mockClear();

      mockAuthenticatedUser();

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withRateLimit(handler, {
        authAware: {
          publicLimitKey: "public-default",
          authenticatedLimitKey: "authenticated-default",
        },
      } as any);

      const request = createTestRequest();
      await wrapped(request as any, { params: {} });

      expect(getCachedRateLimiter).toHaveBeenCalledWith(
        "authenticated-default",
        expect.anything()
      );
      expect(handler).toHaveBeenCalled();
    });

    it("should use public limit key when user is unauthenticated", async () => {
      const { getCachedRateLimiter } = await import("@/lib/utils/enhanced-rate-limiter");
      (getCachedRateLimiter as any).mockClear();

      mockUnauthenticatedUser();

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withRateLimit(handler, {
        authAware: {
          publicLimitKey: "public-default",
          authenticatedLimitKey: "authenticated-default",
        },
      } as any);

      const request = createTestRequest();
      await wrapped(request as any, { params: {} });

      expect(getCachedRateLimiter).toHaveBeenCalledWith(
        "public-default",
        expect.anything()
      );
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("withRateLimit (error handling)", () => {
    it("should fail closed (503) when the rate limiter throws, and must not call handler", async () => {
      const { getCachedRateLimiter } = await import("@/lib/utils/enhanced-rate-limiter");

      (getCachedRateLimiter as any).mockReturnValueOnce({
        canMakeRequest: jest.fn(() => {
          throw new Error("Limiter backend failure");
        }),
        getRetryAfter: jest.fn(() => 0),
        recordRequest: jest.fn(),
        getStatus: jest.fn(() => ({ requestsRemaining: 10, timeUntilReset: 0 })),
        getDiagnostics: jest.fn(() => ({})),
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withRateLimit(handler as any, { key: "public-default" } as any);

      const request = createTestRequest();
      const response = await wrapped(request as any, { params: {} });

      expect(response.status).toBe(503);
      expect(handler).not.toHaveBeenCalled();

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("should not throw a ReferenceError when auth-aware limitKey resolution fails mid-await", async () => {
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = withRateLimit(handler as any, {
        authAware: {
          publicLimitKey: "public-default",
          authenticatedLimitKey: "authenticated-default",
        },
      } as any);

      // Trigger an error before the rate limit key is resolved (simulates the
      // previous TDZ/ReferenceError scenario where the catch block referenced
      // an uninitialized `limitKey`).
      const request = {
        ...createTestRequest(),
        headers: {
          get: () => {
            throw new Error("Header access failed");
          },
        },
      };
      const response = await wrapped(request as any, { params: {} });

      expect(response.status).toBe(503);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

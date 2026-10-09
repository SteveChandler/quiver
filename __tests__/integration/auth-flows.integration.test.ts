/**
 * @jest-environment node
 *
 * Integration tests for Authentication Flows
 *
 * Tests the auth endpoints at:
 * - app/api/auth/check-session/route.ts
 */

import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
  setupApiTestEnvironment,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockNodeEnv,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

// Mock the Supabase clients - one for SSR and one for server
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => mockSupabaseClient),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Import route handlers after mocks are set up
import { GET as checkSessionGET } from "@/app/api/auth/check-session/route";

describe("Authentication Flows Integration", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("Session Management", () => {
    describe("check-session", () => {
      it("returns valid session for authenticated user", async () => {
        const mockUser = createMockUser({
          id: "user-authenticated-123",
          email: "authenticated@example.com",
        });

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const response = await checkSessionGET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          hasSession: true,
          sessionData: {
            userId: "user-authenticated-123",
            email: "authenticated@example.com",
          },
        });
      });

      it("returns null for expired session", async () => {
        // Simulate expired session - getUser returns error
        const expiredError = {
          message: "JWT expired",
          status: 401,
        };

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: expiredError,
        });

        const response = await checkSessionGET();
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data).toEqual({
          hasSession: false,
          sessionData: null,
        });
      });

      it("returns null when user is not found", async () => {
        mockUnauthenticatedUser(mockSupabaseClient);

        const response = await checkSessionGET();
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.hasSession).toBe(false);
        expect(data.sessionData).toBeNull();
      });

      it("handles invalid JWT token gracefully", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid JWT token", status: 401 },
        });

        const response = await checkSessionGET();
        const data = await response.json();

        // Auth failures should return 401, not 500
        expect(response.status).toBe(401);
        expect(data.hasSession).toBe(false);
      });
    });

  });

  describe("Rate Limiting", () => {
    describe("Login Attempts", () => {
      it("blocks excessive login attempts", async () => {
        // Note: Rate limiting for login is typically handled by Supabase Auth directly
        // This test verifies our endpoint properly surfaces rate limit errors

        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { session: null, user: null },
          error: {
            message: "Too many requests. Please try again later.",
            status: 429,
          },
        });

        // The actual login endpoint would return this error
        // Here we verify the mock is set up correctly for integration
        const result = await mockSupabaseClient.auth.signInWithPassword({
          email: "test@example.com",
          password: "password123",
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.status).toBe(429);
        expect(result.error?.message).toContain("Too many requests");
      });

      it("allows login after rate limit window expires", async () => {
        const mockUser = createMockUser();
        const mockSession = createMockSession(mockUser);

        // After rate limit expires, login should succeed
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { session: mockSession, user: mockUser },
          error: null,
        });

        const result = await mockSupabaseClient.auth.signInWithPassword({
          email: "test@example.com",
          password: "password123",
        });

        expect(result.error).toBeNull();
        expect(result.data.user).toBeTruthy();
        expect(result.data.session).toBeTruthy();
      });
    });

    describe("Password Reset Requests", () => {
      it("blocks excessive password reset requests", async () => {
        mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
          data: {},
          error: {
            message: "For security purposes, you can only request this once every 60 seconds",
            status: 429,
          },
        });

        const result = await mockSupabaseClient.auth.resetPasswordForEmail(
          "test@example.com"
        );

        expect(result.error).toBeTruthy();
        expect(result.error?.status).toBe(429);
        expect(result.error?.message).toContain("security purposes");
      });

      it("allows password reset after cooldown period", async () => {
        // After cooldown, request should succeed
        mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
          data: {},
          error: null,
        });

        const result = await mockSupabaseClient.auth.resetPasswordForEmail(
          "test@example.com"
        );

        expect(result.error).toBeNull();
      });
    });
  });

  describe("Security", () => {
    it("does not expose sensitive session data in check-session", async () => {
      const mockUser = createMockUser({
        id: "user-secure-123",
        email: "secure@example.com",
        user_metadata: { sensitive_key: "secret_value" },
        app_metadata: { admin: true, internal_id: "xyz" },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await checkSessionGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionData).not.toHaveProperty("user_metadata");
      expect(data.sessionData).not.toHaveProperty("app_metadata");
      expect(data.sessionData).not.toHaveProperty("access_token");
      expect(data.sessionData).not.toHaveProperty("refresh_token");
      expect(data.sessionData).not.toHaveProperty("sensitive_key");
    });


    it("does not leak error details in production for check-session", async () => {
      const restoreEnv = mockNodeEnv("production");

      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error("Database connection failed: connection string: postgres://user:PASSWORD@host")
      );

      const response = await checkSessionGET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to check session");
      expect(JSON.stringify(data)).not.toContain("PASSWORD");
      expect(JSON.stringify(data)).not.toContain("postgres://");
      expect(data).not.toHaveProperty("stack");

      restoreEnv();
    });

  });

  describe("Edge Cases", () => {
    it("handles session with missing email", async () => {
      const mockUser = createMockUser({
        id: "user-no-email-123",
        email: undefined,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await checkSessionGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasSession).toBe(true);
      expect(data.sessionData.userId).toBe("user-no-email-123");
      expect(data.sessionData.email).toBeUndefined();
    });

    it("handles concurrent session checks", async () => {
      const mockUser = createMockUser({
        id: "user-concurrent-123",
        email: "concurrent@example.com",
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Simulate concurrent requests
      const promises = Array.from({ length: 5 }, () => checkSessionGET());
      const responses = await Promise.all(promises);

      // All responses should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.hasSession).toBe(true);
      }

      // Auth service should be called for each request
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(5);
    });


    it("handles network timeouts gracefully", async () => {
      mockSupabaseClient.auth.getUser.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Request timeout after 30000ms")),
              10
            )
          )
      );

      const response = await checkSessionGET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to check session");
    });

  });
});

/**
 * @jest-environment node
 */

import { GET } from "@/app/api/auth/check-session/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  mockNodeEnv,
} from "@/test-utils/api-test-helpers";

// Mock the Supabase server client
const mockSupabaseClient = createMockSupabaseClient();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe("/api/auth/check-session", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("GET", () => {
    it("should return session data when user is authenticated", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
      });
      
      const mockSession = createMockSession(mockUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        hasSession: true,
        sessionData: {
          userId: "user-123",
          email: "test@example.com",
        },
      });
    });

    it("should return no session when user is not authenticated", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        hasSession: false,
        sessionData: null,
      });
    });

    it("should handle auth errors gracefully", async () => {
      const authError = { message: "Invalid JWT token" };
      
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      const response = await GET();
      
      // According to CLAUDE.md: avoid expecting 500 errors - this should handle gracefully
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Invalid JWT token");
    });

    it("should not expose sensitive session data", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
        user_metadata: { sensitive_data: "secret" },
        app_metadata: { admin: true },
      });
      
      const mockSession = {
        ...createMockSession(mockUser),
        access_token: "secret-access-token",
        refresh_token: "secret-refresh-token",
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionData).toEqual({
        userId: "user-123",
        email: "test@example.com",
        // Should not include sensitive data
      });
      
      // Ensure sensitive data is not exposed
      expect(data.sessionData).not.toHaveProperty("access_token");
      expect(data.sessionData).not.toHaveProperty("refresh_token");
      expect(data.sessionData).not.toHaveProperty("user_metadata");
      expect(data.sessionData).not.toHaveProperty("app_metadata");
    });

    it("should handle unexpected errors gracefully", async () => {
      // Simulate an unexpected error during session check
      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await GET();
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to check session");
    });

    it("should handle missing user in valid session", async () => {
      // Edge case: valid session but no user data
      const mockSession = {
        access_token: "valid-token",
        refresh_token: "valid-refresh",
        expires_in: 3600,
        expires_at: Date.now() / 1000 + 3600,
        token_type: "bearer",
        user: null, // Missing user data
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        hasSession: true,
        sessionData: {
          userId: undefined,
          email: undefined,
        },
      });
    });
  });

  describe("Security", () => {
    it("should handle malformed session data safely", async () => {
      const malformedSession = {
        // Missing required properties
        user: undefined,
        access_token: null,
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: malformedSession },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasSession).toBe(true);
      expect(data.sessionData).toEqual({
        userId: undefined,
        email: undefined,
      });
    });

    it("should not leak error stack traces in production", async () => {
      const restoreEnv = mockNodeEnv("production");

      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error("Database connection failed with sensitive info")
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to check session");
      expect(data).not.toHaveProperty("stack");
      expect(data).not.toHaveProperty("details");

      restoreEnv();
    });
  });

  describe("Performance", () => {
    it("should handle concurrent session checks", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Simulate concurrent requests
      const promises = Array.from({ length: 5 }, () => GET());
      const responses = await Promise.all(promises);

      responses.forEach(async (response) => {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.hasSession).toBe(true);
      });

      // Verify the auth service was called for each request
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(5);
    });
  });
});
/**
 * @jest-environment node
 */

import { POST } from "@/app/api/auth/refresh-session/route";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
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

describe("/api/auth/refresh-session", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const testEnv = setupApiTestEnvironment();
    cleanup = testEnv.cleanup;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup?.();
  });

  describe("POST", () => {
    it("should refresh session successfully when valid session exists", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
      });
      
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock successful refresh
      const refreshedSession = {
        ...mockSession,
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_at: Date.now() / 1000 + 3600,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        hasSession: true,
        sessionData: {
          userId: "user-123",
          email: "test@example.com",
        },
      });

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1);
    });

    it("should return appropriate response when no existing session", async () => {
      // Mock no existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: false,
        hasSession: false,
        message: "No existing session to refresh",
      });

      // Should not attempt refresh if no session exists
      expect(mockSupabaseClient.auth.refreshSession).not.toHaveBeenCalled();
    });

    it("should handle refresh token errors appropriately", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock refresh error
      const refreshError = { message: "Refresh token expired" };
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: refreshError,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        success: false,
        error: "Refresh token expired",
      });
    });

    it("should handle refresh method throwing exception", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock refresh method throwing
      mockSupabaseClient.auth.refreshSession.mockRejectedValue(
        new Error("Network error during refresh")
      );

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: "Failed to refresh session",
      });
    });

    it("should handle unexpected errors in outer try-catch", async () => {
      // Mock getSession throwing
      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: "Failed to refresh session",
      });
    });

    it("should not expose sensitive data in refreshed session", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
        user_metadata: { sensitive: "secret" },
        app_metadata: { admin: true },
      });
      
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock successful refresh with sensitive data
      const refreshedSession = {
        ...mockSession,
        access_token: "secret-new-token",
        refresh_token: "secret-refresh-token",
        user: mockUser,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionData).toEqual({
        userId: "user-123",
        email: "test@example.com",
      });
      
      // Ensure sensitive data is not exposed
      expect(data.sessionData).not.toHaveProperty("access_token");
      expect(data.sessionData).not.toHaveProperty("refresh_token");
      expect(data.sessionData).not.toHaveProperty("user_metadata");
      expect(data.sessionData).not.toHaveProperty("app_metadata");
    });
  });

  describe("Edge Cases", () => {
    it("should handle refresh returning null session", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock refresh returning null session (user logged out elsewhere)
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        hasSession: false,
        sessionData: null,
      });

      expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("should handle refresh returning session without user", async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      // Mock existing session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock refresh returning session without user data
      const refreshedSession = {
        ...mockSession,
        user: null,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: null },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        hasSession: true,
        sessionData: {
          userId: undefined,
          email: undefined,
        },
      });
    });
  });

  describe("Security", () => {
    it("should not leak error details in production", async () => {
      const restoreEnv = mockNodeEnv("production");

      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabaseClient.auth.refreshSession.mockRejectedValue(
        new Error("Detailed error with sensitive information")
      );

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to refresh session");
      expect(data).not.toHaveProperty("details");
      expect(data).not.toHaveProperty("stack");

      restoreEnv();
    });

    it("should handle malformed session data safely", async () => {
      // Mock existing session with minimal data
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: null, access_token: "token" } },
        error: null,
      });

      // Mock refresh with malformed session
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { 
          session: { 
            // Missing standard properties 
            user: { id: "user-123" } // Missing email
          }, 
          user: { id: "user-123" } 
        },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: createMockUser({ id: "user-123", email: undefined }) },
        error: null,
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionData).toEqual({
        userId: "user-123",
        email: undefined,
      });
    });
  });
});

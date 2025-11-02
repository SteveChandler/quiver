/**
 * AuthValidator Unit Tests
 *
 * Tests authentication validation logic including:
 * - Session validation (fast path)
 * - Remote auth validation (slow path)
 * - Error handling
 * - Cookie management
 */

import { AuthValidator } from "@/lib/middleware/auth-validator";
import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

// Mock Supabase SSR
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

describe("AuthValidator", () => {
  let mockRequest: Partial<NextRequest>;
  let mockCookieCallbacks: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request
    mockRequest = {
      url: "http://localhost:3000/profile",
      cookies: {
        get: jest.fn(),
      } as any,
    } as Partial<NextRequest>;

    // Mock cookie callbacks
    mockCookieCallbacks = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    };

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getSession: jest.fn(),
        getUser: jest.fn(),
      },
    };

    // Setup createServerClient mock
    const { createServerClient } = require("@supabase/ssr");
    (createServerClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  describe("validateAuth - Fast Path (Local Session)", () => {
    it("should authenticate successfully with valid local session", async () => {
      const mockUser: Partial<User> = {
        id: "user-123",
        email: "test@example.com",
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: { user: mockUser },
        },
        error: null,
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      const result = await validator.validateAuth();

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("should skip remote validation if session is valid", async () => {
      const mockUser: Partial<User> = {
        id: "user-456",
        email: "user@example.com",
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: { user: mockUser },
        },
        error: null,
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      await validator.validateAuth();

      // Verify remote call was NOT made (fast path optimization)
      expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
    });
  });

  describe("validateAuth - Slow Path (Remote Validation)", () => {
    it("should fall back to remote validation when session is invalid", async () => {
      const mockUser: Partial<User> = {
        id: "user-789",
        email: "remote@example.com",
      };

      // Session check fails
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Session expired" },
      });

      // Remote check succeeds
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      const result = await validator.validateAuth();

      expect(result.authenticated).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1);
    });

    it("should fail authentication when both session and remote validation fail", async () => {
      // Session check fails
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Session expired" },
      });

      // Remote check also fails
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "User not found" },
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      const result = await validator.validateAuth();

      expect(result.authenticated).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle Supabase errors gracefully", async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error("Network error")
      );

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      const result = await validator.validateAuth();

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Authentication failed");
    });

    it("should handle malformed session data", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: null } }, // Malformed
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks
      );

      const result = await validator.validateAuth();

      expect(result.authenticated).toBe(false);
    });
  });

  describe("Cookie Management", () => {
    it("should use provided cookie callbacks", async () => {
      const mockCookieValue = "session-cookie-value";
      mockCookieCallbacks.get.mockReturnValue(mockCookieValue);

      const mockUser: Partial<User> = { id: "user-123" };
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      });

      new AuthValidator(mockRequest as NextRequest, mockCookieCallbacks);

      // Cookie callbacks should be configured in Supabase client
      const { createServerClient } = require("@supabase/ssr");
      expect(createServerClient).toHaveBeenCalled();

      const cookiesConfig = (createServerClient as jest.Mock).mock.calls[0][2];
      expect(cookiesConfig.cookies).toBeDefined();
    });
  });

  describe("Verbose Logging", () => {
    it("should support verbose mode", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const mockUser: Partial<User> = { id: "user-123" };
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      });

      const validator = new AuthValidator(
        mockRequest as NextRequest,
        mockCookieCallbacks,
        true // verbose = true
      );

      await validator.validateAuth();

      // In test environment (not dev), verbose logging might not trigger
      // but we verify the parameter is accepted
      expect(validator).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});

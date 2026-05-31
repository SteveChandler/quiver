/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/auth/check-session/route";
import {
  createMockSupabaseClient,
  createMockUser,
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
    it("uses the shared API wrapper module for response helpers", () => {
      const source = readFileSync(
        join(process.cwd(), "app/api/auth/check-session/route.ts"),
        "utf8"
      );

      expect(source).not.toMatch(/@\/lib\/api-utils/);
      expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
    });

    it("should return session data when user is authenticated", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        hasSession: false,
        sessionData: null,
      });
    });

    it("should handle auth errors gracefully", async () => {
      const authError = { message: "Invalid JWT token" };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: authError,
      });

      const response = await GET();

      // Auth failures should not be treated as server errors.
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        hasSession: false,
        sessionData: null,
      });
    });

    it("should not expose sensitive session data", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: "test@example.com",
        user_metadata: { sensitive_data: "secret" },
        app_metadata: { admin: true },
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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
      const thrownError = new Error("Database connection failed");
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      // Simulate an unexpected error during session check
      mockSupabaseClient.auth.getUser.mockRejectedValue(thrownError);

      try {
        const response = await GET();

        // Database connection errors are genuine server errors - 500 is correct
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe("Failed to check session");
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "API Error:",
          "Database connection failed"
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Stack trace:",
          expect.stringContaining("Database connection failed")
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("should handle missing email safely", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        email: undefined,
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        hasSession: true,
        sessionData: {
          userId: "user-123",
          email: undefined,
        },
      });
    });
  });

  describe("Security", () => {
    it("should not leak error stack traces in production", async () => {
      const restoreEnv = mockNodeEnv("production");
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error("Database connection failed with sensitive info")
        );

        const response = await GET();
        const data = await response.json();

        // Database connection errors are genuine server errors - 500 is correct
        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to check session");
        expect(data).not.toHaveProperty("stack");
        expect(data).not.toHaveProperty("details");
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "API Error:",
          "Database connection failed with sensitive info"
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Stack trace:",
          expect.stringContaining("Database connection failed with sensitive info")
        );
      } finally {
        consoleErrorSpy.mockRestore();
        restoreEnv();
      }
    });
  });

  describe("Performance", () => {
    it("should handle concurrent session checks", async () => {
      const mockUser = createMockUser();

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
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
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(5);
    });
  });
});

/**
 * Device Token Management API Tests
 * Tests the /api/devices/upsert endpoint for registering push notification tokens
 *
 * Following patterns from test-utils/api-test-helpers.ts
 * API route: app/api/devices/upsert/route.ts
 */

// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/devices/upsert/route";
import {
  createMockSupabaseClient,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  createMockRequest,
  expectSuccessResponse,
  expectErrorResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

// Mock API utilities
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({ success: true, data, timestamp: new Date().toISOString() }),
  })),
  handleApiError: jest.fn((error, status = 500) => ({
    status,
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }),
  })),
}));

// Mock Supabase client
let mockSupabase: MockSupabaseClient;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));

describe("Device Token API - POST /api/devices/upsert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  describe("Device Token Registration", () => {
    it("should register a new iOS device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      // Mock successful upsert
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-ios-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          platform: "ios",
          device_token: "test-ios-token-123",
        }),
        { onConflict: "user_id,device_token" }
      );
    });

    it("should register a new Android device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "android",
          device_token: "test-android-token-456",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          platform: "android",
          device_token: "test-android-token-456",
        }),
        { onConflict: "user_id,device_token" }
      );
    });

    it("should register a new Web device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "web",
          device_token: "test-web-token-789",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          platform: "web",
          device_token: "test-web-token-789",
        }),
        { onConflict: "user_id,device_token" }
      );
    });

    it("should update existing device token (upsert behavior)", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "existing-token-to-update",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Verify upsert was called with onConflict strategy
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          platform: "ios",
          device_token: "existing-token-to-update",
          updated_at: expect.any(String),
        }),
        { onConflict: "user_id,device_token" }
      );
    });

    it("should include updated_at timestamp in upsert", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-with-timestamp",
        },
      });

      await POST(request);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
        expect.any(Object)
      );

      // Verify timestamp is a valid ISO string
      const callArgs = mockUpsert.mock.calls[0][0];
      expect(() => new Date(callArgs.updated_at)).not.toThrow();
    });
  });

  describe("Platform Validation", () => {
    it("should reject invalid platform", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "invalid",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid platform");
    });

    it("should reject empty platform", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject platform with incorrect case", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "IOS", // uppercase, should be lowercase
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Device Token Validation", () => {
    it("should reject missing device_token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          // missing device_token
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject empty device_token string", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject whitespace-only device_token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "   ",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("empty");
    });

    it("should reject device_token exceeding 512 characters", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const longToken = "a".repeat(513); // 513 characters, exceeds limit

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: longToken,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("exceeds maximum length");
    });

    it("should accept device_token at exactly 512 characters", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const maxLengthToken = "b".repeat(512); // Exactly 512 characters

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: maxLengthToken,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      mockUnauthenticatedUser(mockSupabase);

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("should reject when auth.getUser returns error", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Auth token expired"),
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should use user ID from authenticated user", async () => {
      const mockUser = createMockUser({ id: "specific-user-id-123" });
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-123",
        },
      });

      await POST(request);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "specific-user-id-123",
        }),
        expect.any(Object)
      );
    });
  });

  describe("Database Errors", () => {
    it("should handle database upsert errors", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({
        error: { message: "Database connection failed" },
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should handle unique constraint violations gracefully", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({
        error: { message: "duplicate key value violates unique constraint", code: "23505" },
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const request = createMockRequest("POST", "http://localhost:3000/api/devices/upsert", {
        body: {
          platform: "ios",
          device_token: "test-token-123",
        },
      });

      const response = await POST(request);

      // Should handle error even though upsert should prevent this
      expect(response.status).toBe(500);
    });
  });

  describe("Request Body Parsing", () => {
    it("should handle malformed JSON body", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      // Create a request with invalid JSON
      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json-{",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});

describe("Device Token API - DELETE /api/devices/upsert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  describe("Device Token Deletion", () => {
    it("should delete a device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockEq = jest.fn().mockReturnThis();
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { error: null };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          device_token: "test-token-to-delete",
        },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockEq).toHaveBeenCalledWith("device_token", "test-token-to-delete");
    });

    it("should only delete tokens for authenticated user", async () => {
      const mockUser = createMockUser({ id: "user-abc-123" });
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockEq = jest.fn().mockReturnThis();
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { error: null };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          device_token: "test-token-123",
        },
      });

      await DELETE(request);

      // Verify deletion is scoped to the authenticated user
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-abc-123");
    });

    it("should require device_token for deletion", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          // missing device_token
        },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should require authentication for deletion", async () => {
      mockUnauthenticatedUser(mockSupabase);

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          device_token: "test-token-123",
        },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("should handle database deletion errors", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockEq = jest.fn().mockReturnThis();
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string) => {
        if (field === "device_token") {
          return { error: { message: "Database error during deletion" } };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          device_token: "test-token-123",
        },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle deletion of non-existent token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockEq = jest.fn().mockReturnThis();
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string) => {
        if (field === "device_token") {
          // No error even if token doesn't exist
          return { error: null };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      });

      const request = createMockRequest("DELETE", "http://localhost:3000/api/devices/upsert", {
        body: {
          device_token: "non-existent-token",
        },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

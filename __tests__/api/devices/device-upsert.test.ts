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

// Mock API utilities — signatures must match real ones in lib/api-utils.ts:
// - handleApiError(error, errorMessage?) always returns 500
// - createAuthError(message?) returns 401
// - createSuccessResponse(data) returns 200
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
  })),
  handleApiError: jest.fn((error, _errorMessage?: string) => ({
    status: 500,
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }),
  })),
  createAuthError: jest.fn((message = "Authentication required") => ({
    status: 401,
    json: async () => ({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    }),
  })),
}));

// Mock Supabase client — used by both bearer and cookie auth paths in withAuth
let mockSupabase: MockSupabaseClient;

function mockSuccessfulDeviceRegistration(
  mockUpsert: jest.Mock = jest.fn().mockResolvedValue({ error: null }),
): {
  mockUpsert: jest.Mock;
  mockProfileUpdate: jest.Mock;
  mockProfileEq: jest.Mock;
  mockProfileIs: jest.Mock;
} {
  const mockProfileIs = jest.fn().mockResolvedValue({ error: null });
  const mockProfileEq = jest.fn(() => ({
    error: null,
    is: mockProfileIs,
  }));
  const mockProfileUpdate = jest.fn(() => ({
    eq: mockProfileEq,
  }));

  (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "profiles") {
      return { update: mockProfileUpdate };
    }

    return { upsert: mockUpsert };
  });
  mockSupabase.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
    const metadata = (args.p_metadata ?? {}) as Record<string, unknown>;
    const result = await mockUpsert(
      {
        user_id: args.p_user_id,
        platform: args.p_platform,
        device_token: args.p_device_token,
        ...metadata,
      },
      { onConflict: "user_id,device_token" },
    );
    return result ?? { error: null };
  });

  return { mockUpsert, mockProfileUpdate, mockProfileEq, mockProfileIs };
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));
jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockSupabase),
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
      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-ios-token-123",
          },
        },
      );

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
        { onConflict: "user_id,device_token" },
      );
    });

    it("should register a new Android device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "android",
            device_token: "test-android-token-456",
          },
        },
      );

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
        { onConflict: "user_id,device_token" },
      );
    });

    it("should register a new Web device token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "web",
            device_token: "test-web-token-789",
          },
        },
      );

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
        { onConflict: "user_id,device_token" },
      );
    });

    it("should update existing device token (upsert behavior)", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "existing-token-to-update",
          },
        },
      );

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
        { onConflict: "user_id,device_token" },
      );
    });

    it("should include updated_at timestamp in upsert", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-with-timestamp",
          },
        },
      );

      await POST(request);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
        expect.any(Object),
      );

      // Verify timestamp is a valid ISO string
      const callArgs = mockUpsert.mock.calls[0][0];
      expect(new Date(callArgs.updated_at).getTime()).not.toBeNaN();
    });
  });

  describe("Platform Validation", () => {
    it("should reject invalid platform", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "invalid",
            device_token: "test-token-123",
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid platform");
    });

    it("should reject empty platform", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "",
            device_token: "test-token-123",
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject platform with incorrect case", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "IOS", // uppercase, should be lowercase
            device_token: "test-token-123",
          },
        },
      );

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

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            // missing device_token
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject empty device_token string", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "",
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should reject whitespace-only device_token", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "   ",
          },
        },
      );

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

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: longToken,
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("exceeds maximum length");
    });

    it("should accept device_token at exactly 512 characters", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const maxLengthToken = "b".repeat(512); // Exactly 512 characters

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: maxLengthToken,
          },
        },
      );

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

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-123",
          },
        },
      );

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

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-123",
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should use user ID from authenticated user", async () => {
      const mockUser = createMockUser({ id: "specific-user-id-123" });
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-123",
          },
        },
      );

      await POST(request);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "specific-user-id-123",
        }),
        expect.any(Object),
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
      mockSupabase.rpc.mockResolvedValue({
        error: { message: "Database connection failed" },
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-123",
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should handle unique constraint violations gracefully", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockUpsert = jest.fn().mockResolvedValue({
        error: {
          message: "duplicate key value violates unique constraint",
          code: "23505",
        },
      });
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });
      mockSupabase.rpc.mockResolvedValue({
        error: {
          message: "duplicate key value violates unique constraint",
          code: "23505",
        },
      });

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "test-token-123",
          },
        },
      );

      const response = await POST(request);

      // Should handle error even though upsert should prevent this
      expect(response.status).toBe(500);
    });
  });

  describe("Phase 5l: device metadata", () => {
    it("passes app_version, build_number, os_version, expo_sdk through to upsert when provided", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            app_version: "0.6.0",
            build_number: "10",
            os_version: "17.4",
            expo_sdk: "55.0.0",
          },
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          app_version: "0.6.0",
          build_number: "10",
          os_version: "17.4",
          expo_sdk: "55.0.0",
        }),
        expect.any(Object),
      );
    });

    it("rejects metadata strings longer than 32 chars", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            build_number: "x".repeat(33),
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain("build_number");
      expect(data.error).toContain("exceeds maximum length");
    });

    it("rejects non-string metadata", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            os_version: 17,
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain("os_version");
    });

    it("does NOT include metadata fields in upsert when omitted (preserves prior values)", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: { platform: "android", device_token: "tok" },
        },
      );

      await POST(request);

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg).not.toHaveProperty("app_version");
      expect(upsertArg).not.toHaveProperty("build_number");
      expect(upsertArg).not.toHaveProperty("os_version");
      expect(upsertArg).not.toHaveProperty("expo_sdk");
      expect(upsertArg).not.toHaveProperty("expo_update_id");
      expect(upsertArg).not.toHaveProperty("expo_channel");
      expect(upsertArg).not.toHaveProperty("expo_runtime_version");
      expect(upsertArg).not.toHaveProperty("expo_is_embedded_launch");
      expect(upsertArg).not.toHaveProperty("expo_is_emergency_launch");
    });

    it("does NOT include null or blank metadata fields in upsert so existing values are preserved", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            app_version: "",
            build_number: null,
            os_version: "   ",
            expo_sdk: " 55.0.0 ",
          },
        },
      );

      await POST(request);

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg).not.toHaveProperty("app_version");
      expect(upsertArg).not.toHaveProperty("build_number");
      expect(upsertArg).not.toHaveProperty("os_version");
      expect(upsertArg).toHaveProperty("expo_sdk", "55.0.0");
    });
  });

  describe("Expo Updates identity", () => {
    it("passes valid identity fields through the conflict upsert", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();
      const updateId = "u".repeat(64);
      const channel = "c".repeat(64);
      const runtimeVersion = "r".repeat(64);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            expo_update_id: updateId,
            expo_channel: channel,
            expo_runtime_version: runtimeVersion,
            expo_is_embedded_launch: false,
            expo_is_emergency_launch: true,
          },
        },
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          expo_update_id: updateId,
          expo_channel: channel,
          expo_runtime_version: runtimeVersion,
          expo_is_embedded_launch: false,
          expo_is_emergency_launch: true,
        }),
        { onConflict: "user_id,device_token" },
      );
    });

    it("persists explicit null identity fields so stale values can be cleared", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const { mockUpsert } = mockSuccessfulDeviceRegistration();

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "android",
            device_token: "tok",
            expo_update_id: null,
            expo_channel: null,
            expo_runtime_version: null,
            expo_is_embedded_launch: null,
            expo_is_emergency_launch: null,
          },
        },
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          expo_update_id: null,
          expo_channel: null,
          expo_runtime_version: null,
          expo_is_embedded_launch: null,
          expo_is_emergency_launch: null,
        }),
        { onConflict: "user_id,device_token" },
      );
    });

    it.each([
      ["expo_update_id", 123],
      ["expo_channel", false],
      ["expo_runtime_version", { version: "1.0.0" }],
      ["expo_is_embedded_launch", "false"],
      ["expo_is_emergency_launch", 0],
    ])("rejects invalid %s types", async (field, invalidValue) => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            [field]: invalidValue,
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain(field);
      expect(data.error).toContain(
        field.startsWith("expo_is_") ? "boolean" : "string",
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it.each([
      "expo_update_id",
      "expo_channel",
      "expo_runtime_version",
    ])("rejects %s values longer than 64 characters", async (field) => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            platform: "ios",
            device_token: "tok",
            [field]: "x".repeat(65),
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain(field);
      expect(data.error).toContain("64 characters");
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Request Body Parsing", () => {
    it("should handle malformed JSON body", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      // Create a request with invalid JSON
      const request = new NextRequest(
        "http://localhost:3000/api/devices/upsert",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid-json-{",
        },
      );

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
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { is: jest.fn().mockResolvedValue({ error: null }) };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            device_token: "test-token-to-delete",
          },
        },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        retired_at: expect.any(String),
        retired_reason: "logout",
      });
      expect(mockEq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockEq).toHaveBeenCalledWith(
        "device_token",
        "test-token-to-delete",
      );
    });

    it("should only delete tokens for authenticated user", async () => {
      const mockUser = createMockUser({ id: "user-abc-123" });
      mockAuthenticatedUser(mockSupabase, mockUser);

      const mockEq = jest.fn().mockReturnThis();
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { is: jest.fn().mockResolvedValue({ error: null }) };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            device_token: "test-token-123",
          },
        },
      );

      await DELETE(request);

      // Verify deletion is scoped to the authenticated user
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-abc-123");
    });

    it("should require device_token for deletion", async () => {
      const mockUser = createMockUser();
      mockAuthenticatedUser(mockSupabase, mockUser);

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            // missing device_token
          },
        },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    it("should require authentication for deletion", async () => {
      mockUnauthenticatedUser(mockSupabase);

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            device_token: "test-token-123",
          },
        },
      );

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
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string) => {
        if (field === "device_token") {
          return {
            is: jest.fn().mockResolvedValue({
              error: { message: "Database error during deletion" },
            }),
          };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            device_token: "test-token-123",
          },
        },
      );

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
      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string) => {
        if (field === "device_token") {
          // No error even if token doesn't exist
          return { is: jest.fn().mockResolvedValue({ error: null }) };
        }
        return { eq: mockEq };
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const request = createMockRequest(
        "DELETE",
        "http://localhost:3000/api/devices/upsert",
        {
          body: {
            device_token: "non-existent-token",
          },
        },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

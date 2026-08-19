/**
 * Tests for Device Token API
 * Tests the /api/devices/upsert endpoint for registering push notification tokens
 */

// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/devices/upsert/route";

// Mock API utilities — match real signatures in lib/api-utils.ts
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  })),
  handleApiError: jest.fn((error, _errorMessage?: string) => ({
    status: 500,
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  })),
  createAuthError: jest.fn((message = "Authentication required") => ({
    status: 401,
    json: async () => ({
      success: false,
      error: message,
    }),
  })),
}));

// Mock Supabase client — shared by bearer and cookie auth paths in withAuth
const mockUpsert = jest.fn();
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockProfileUpdate = jest.fn();
const mockProfileEq = jest.fn();
const mockProfileIs = jest.fn();
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((table: string) => {
    if (table === "user_devices") {
      return {
        upsert: mockUpsert,
        update: mockUpdate,
      };
    }
    if (table === "profiles") {
      return {
        update: mockProfileUpdate,
      };
    }
    return {};
  }),
  rpc: mockRpc,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));
jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockSupabase),
}));

describe("Device Token API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
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
    mockProfileIs.mockResolvedValue({ error: null });
    mockProfileEq.mockImplementation((_field: string, _value: string) => ({
      error: null,
      is: mockProfileIs,
    }));
    mockProfileUpdate.mockReturnValue({ eq: mockProfileEq });
  });

  describe("POST /api/devices/upsert", () => {
    it("should register a new device token", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpsert.mockResolvedValue({ error: null });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          device_token: "test-token-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          platform: "ios",
          device_token: "test-token-123",
        }),
        { onConflict: "user_id,device_token" }
      );
      expect(mockProfileUpdate).toHaveBeenCalledWith({
        notif_push_enabled: true,
      });
      expect(mockProfileEq).toHaveBeenCalledWith("id", "user-123");
    });

    it("stores a valid IANA timezone and fills missing profile timezone", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      mockUpsert.mockResolvedValue({ error: null });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          device_token: "test-token-123",
          timezone: "America/New_York",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: "America/New_York",
        }),
        { onConflict: "user_id,device_token" }
      );
      expect(mockProfileUpdate).toHaveBeenNthCalledWith(1, {
        notif_push_enabled: true,
      });
      expect(mockProfileUpdate).toHaveBeenNthCalledWith(2, {
        timezone: "America/New_York",
      });
      expect(mockProfileEq).toHaveBeenNthCalledWith(1, "id", "user-123");
      expect(mockProfileEq).toHaveBeenNthCalledWith(2, "id", "user-123");
      expect(mockProfileIs).toHaveBeenCalledWith("timezone", null);
    });

    it("rejects invalid timezone strings before upserting the device", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          device_token: "test-token-123",
          timezone: "Mars/Olympus",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockProfileUpdate).not.toHaveBeenCalled();
    });

    it("should reject invalid platform", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "invalid",
          device_token: "test-token-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("should require authentication", async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          device_token: "test-token-123",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("should validate required fields", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        body: JSON.stringify({
          platform: "ios",
          // missing device_token
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("Bearer token auth path", () => {
    // These tests pin the invariant that a native Authorization: Bearer request
    // goes through createBearerTokenClient + supabase.auth.getUser(token), NOT
    // the cookie-based createSupabaseServerClient. Without this pin, the PR #199
    // hotfix could silently regress because the existing "should require
    // authentication" test passes regardless of which path runs.
    it("routes Authorization: Bearer requests through createBearerTokenClient with the token", async () => {
      const { createBearerTokenClient } = require("@/lib/supabase/bearer-client");
      const { createSupabaseServerClient } = require("@/lib/supabase/server");

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: "user-bearer-42" } },
        error: null,
      });
      mockUpsert.mockResolvedValue({ error: null });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        headers: { authorization: "Bearer fake-native-jwt-xyz" },
        body: JSON.stringify({ platform: "android", device_token: "fcm-abc-123" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(createBearerTokenClient).toHaveBeenCalledWith("fake-native-jwt-xyz");
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith("fake-native-jwt-xyz");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-bearer-42", platform: "android" }),
        { onConflict: "user_id,device_token" }
      );
    });

    it("returns 401 with { success, error } shape when Bearer token is rejected", async () => {
      // Simulates Supabase auth.getUser rejecting an expired/invalid JWT.
      // The response body must carry an `error` field so the native client's
      // ApiError.message is informative (see quiver-native api-client.ts).
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { name: "AuthApiError", message: "JWT expired" },
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "POST",
        headers: { authorization: "Bearer expired-jwt" },
        body: JSON.stringify({ platform: "android", device_token: "fcm-abc-123" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/devices/upsert", () => {
    it("should delete a device token", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockEq = jest.fn().mockReturnThis();
      mockUpdate.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { is: jest.fn().mockResolvedValue({ error: null }) };
        }
        return { eq: mockEq };
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "DELETE",
        body: JSON.stringify({
          device_token: "test-token-123",
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        retired_at: expect.any(String),
        retired_reason: "logout",
      });
    });

    it("should require authentication for deletion", async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest("http://localhost:3000/api/devices/upsert", {
        method: "DELETE",
        body: JSON.stringify({
          device_token: "test-token-123",
        }),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});

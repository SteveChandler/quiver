/**
 * Tests for Device Token API
 * Tests the /api/devices/upsert endpoint for registering push notification tokens
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

// Mock API utilities
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({ success: true, data }),
  })),
  handleApiError: jest.fn((error, status = 500) => ({
    status,
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  })),
}));

// Mock Supabase client
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn((table: string) => {
    if (table === "user_devices") {
      return {
        upsert: mockUpsert,
        delete: mockDelete,
      };
    }
    return {};
  }),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));

describe("Device Token API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/devices/upsert", () => {
    it("should register a new device token", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockUpsert.mockResolvedValue({ error: null });

      const { POST } = await import("@/app/api/devices/upsert/route");

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
    });

    it("should reject invalid platform", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const { POST } = await import("@/app/api/devices/upsert/route");

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

      const { POST } = await import("@/app/api/devices/upsert/route");

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

      const { POST } = await import("@/app/api/devices/upsert/route");

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

  describe("DELETE /api/devices/upsert", () => {
    it("should delete a device token", async () => {
      const mockUser = { id: "user-123" };
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockEq = jest.fn().mockReturnThis();
      mockDelete.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockImplementation((field: string, value: string) => {
        if (field === "device_token") {
          return { error: null };
        }
        return { eq: mockEq };
      });

      const { DELETE } = await import("@/app/api/devices/upsert/route");

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
      expect(mockDelete).toHaveBeenCalled();
    });

    it("should require authentication for deletion", async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const { DELETE } = await import("@/app/api/devices/upsert/route");

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
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});


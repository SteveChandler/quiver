/**
 * @jest-environment node
 */

/**
 * Tests for Session Likes API
 * Tests the POST/GET endpoints for liking sessions and getting like status
 */

// Use lightweight NextRequest/NextResponse mock
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";

// Mock createSupabaseServerClient before imports
const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock the server action
jest.mock("@/actions/like-actions", () => ({
  toggleSessionLike: jest.fn(),
}));

// Import route handlers after mocks are set up
import { GET } from "@/app/api/sessions/[id]/likes/route";
import { POST } from "@/app/api/sessions/[id]/likes/toggle/route";
import { toggleSessionLike as mockToggleSessionLike } from "@/actions/like-actions";

describe("Session Likes API", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const otherUserId = "111fcdeb-51a2-43c1-a123-456789abcd11";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/sessions/[id]/likes - Get Like Status", () => {
    it("returns like status when user is authenticated", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock user's like check
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: "like-123" },
        error: null,
      });
      const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });

      // Mock total likes count - uses select with count option
      const mockCountEq = jest.fn().mockResolvedValue({
        count: 42,
        error: null,
      });
      const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for user's like
          return { select: mockSelect };
        } else {
          // Second call is for total count
          return { select: mockCountSelect };
        }
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(true);
      expect(data.data.likesCount).toBe(42);
    });

    it("returns liked=false when user hasn't liked", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock user's like check - no like found
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });

      // Mock total likes count
      const mockCountEq = jest.fn().mockResolvedValue({
        count: 10,
        error: null,
      });
      const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: mockSelect };
        } else {
          return { select: mockCountSelect };
        }
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(false);
      expect(data.data.likesCount).toBe(10);
    });

    it("works without authentication (optional auth)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Mock total likes count
      const mockCountEq = jest.fn().mockResolvedValue({
        count: 5,
        error: null,
      });
      const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq });

      mockFrom.mockReturnValue({
        select: mockCountSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(false);
      expect(data.data.likesCount).toBe(5);
    });

    it("returns 0 likes when no likes exist", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Mock total likes count - 0 likes
      const mockCountEq = jest.fn().mockResolvedValue({
        count: 0,
        error: null,
      });
      const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq });

      mockFrom.mockReturnValue({
        select: mockCountSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.likesCount).toBe(0);
    });

    it("validates session ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("handles database errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock database error
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST301", message: "Database error" },
      });
      const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to load like status");
    });
  });

  describe("POST /api/sessions/[id]/likes/toggle - Toggle Like", () => {
    it("toggles like on public session successfully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: true,
        liked: true,
        message: "Session liked",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(true);
      expect(mockToggleSessionLike).toHaveBeenCalledWith(validSessionId);
    });

    it("toggles unlike when already liked", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: true,
        liked: false,
        message: "Session unliked",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(false);
    });

    it("prevents duplicate likes (handled by action)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // First like
      (mockToggleSessionLike as jest.Mock).mockResolvedValueOnce({
        success: true,
        liked: true,
        message: "Session liked",
      });

      const request1 = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response1 = await POST(request1, { params: { id: validSessionId } });
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.data.liked).toBe(true);

      // Second toggle (unlike)
      (mockToggleSessionLike as jest.Mock).mockResolvedValueOnce({
        success: true,
        liked: false,
        message: "Session unliked",
      });

      const request2 = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response2 = await POST(request2, { params: { id: validSessionId } });
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.data.liked).toBe(false);
    });

    it("requires authentication", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("validates session ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("rejects like on private non-owned session (via action)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock action returning RLS error
      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: false,
        error: "new row violates row-level security policy",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      // RLS policy violations are currently returned as 500, but should ideally be 403
      // The action error is handled by withAuth error handler which returns 500
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("handles action errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database connection failed",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      // Database connection errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to toggle like");
    });
  });

  describe("Edge Cases", () => {
    it("handles non-existent session ID gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: false,
        error: "Session not found",
      });

      const nonExistentId = "999e9999-e99b-99d9-a999-999999999999";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${nonExistentId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: nonExistentId } });
      const data = await response.json();

      // Valid UUID format passes validation, so error comes from action
      // which may return 400 (validation) or 500 (server error)
      expect([400, 500]).toContain(response.status);
      expect(data.success).toBe(false);
    });

    it("handles rapid toggle requests", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Simulate rapid toggles
      (mockToggleSessionLike as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          liked: true,
          message: "Session liked",
        })
        .mockResolvedValueOnce({
          success: true,
          liked: false,
          message: "Session unliked",
        })
        .mockResolvedValueOnce({
          success: true,
          liked: true,
          message: "Session liked",
        });

      const requests = Array(3)
        .fill(null)
        .map(
          () =>
            new NextRequest(
              `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
              { method: "POST" }
            )
        );

      const responses = await Promise.all(
        requests.map((req) => POST(req, { params: { id: validSessionId } }))
      );

      const dataArray = await Promise.all(
        responses.map((res) => res.json())
      );

      expect(responses.every((res) => res.status === 200)).toBe(true);
      expect(dataArray.every((d) => d.success === true)).toBe(true);
      expect(mockToggleSessionLike).toHaveBeenCalledTimes(3);
    });

    it("returns current like status after toggle", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      (mockToggleSessionLike as jest.Mock).mockResolvedValue({
        success: true,
        liked: true,
        message: "Session liked",
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("liked");
      expect(data.data.liked).toBe(true);
    });
  });
});

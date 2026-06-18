/**
 * @jest-environment node
 */

/**
 * Tests for Session Comments API
 * Tests the /api/sessions/[id]/comments endpoint for reading and posting comments
 */

// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
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

// Import route handlers after mocks are set up
import { GET, POST, DELETE } from "@/app/api/sessions/[id]/comments/route";

describe("Session Comments API", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "987fcdeb-51a2-43c1-a123-456789abcdef";

  function mockExistingSessionThenInsert(
    mockInsert: jest.Mock,
    sessionId: string = validSessionId
  ): void {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { id: sessionId },
      error: null,
    });
    const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === "sessions") {
        return { select: mockSelect };
      }
      if (tableName === "comments") {
        return { insert: mockInsert };
      }
      return {};
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/sessions/[id]/comments", () => {
    it("returns comments with user profiles for a valid session", async () => {
      const mockComments = [
        {
          id: "comment-1",
          session_id: validSessionId,
          user_id: validUserId,
          content: "Great session!",
          created_at: "2024-01-23T12:00:00Z",
          user: {
            full_name: "John Doe",
            avatar_url: "https://example.com/avatar.jpg",
            email: "john@example.com",
          },
        },
        {
          id: "comment-2",
          session_id: validSessionId,
          user_id: "another-user-id",
          content: "Amazing waves!",
          created_at: "2024-01-23T11:00:00Z",
          user: {
            full_name: "Jane Smith",
            avatar_url: "https://example.com/avatar2.jpg",
            email: "jane@example.com",
          },
        },
      ];

      // Mock Supabase query chain
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      // Optional auth - user can be null
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.comments).toHaveLength(2);
      expect(data.data.comments[0]).toMatchObject({
        content: "Great session!",
        user: {
          full_name: "John Doe",
        },
      });

      // Verify query was built correctly
      expect(mockFrom).toHaveBeenCalledWith("comments");
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining("user:profiles(full_name, avatar_url, email)")
      );
      expect(mockEq).toHaveBeenCalledWith("session_id", validSessionId);
      expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("returns empty array when no comments exist", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.comments).toEqual([]);
    });

    it("works without authentication (optional auth)", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "Public comment",
          user: { full_name: "Public User" },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockComments,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      // No user authenticated
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.comments).toHaveLength(1);
    });

    it("returns validation error for invalid session ID format", async () => {
      const invalidSessionId = "not-a-uuid";

      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/comments`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("handles database errors gracefully", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });
      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });
      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        { method: "GET" }
      );

      const response = await GET(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to load comments");
    });
  });

  describe("POST /api/sessions/[id]/comments", () => {
    it("creates a comment with valid data and authentication", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "This was an amazing surf session!",
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe("Comment created successfully");

      // Verify insert was called with correct data
      expect(mockFrom).toHaveBeenCalledWith("comments");
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: validSessionId,
        user_id: validUserId,
        content: "This was an amazing surf session!",
      });
    });

    it("requires authentication (401 without auth)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "This should fail",
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects empty content", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "",
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("rejects content exceeding max length (2000 characters)", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const longContent = "a".repeat(2001); // 2001 characters

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: longContent,
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("accepts content at max length boundary (2000 characters)", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockExistingSessionThenInsert(mockInsert);

      const maxContent = "a".repeat(2000); // Exactly 2000 characters

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: maxContent,
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("rejects invalid Content-Type header", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: "not json",
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("rejects malformed JSON", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{ invalid json }",
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("validates session ID format", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "This should fail due to invalid session ID",
          }),
        }
      );

      const response = await POST(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("handles database insert errors gracefully", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Foreign key constraint violation"),
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "This should fail due to database error",
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to create comment");
    });

    it("trims whitespace from content", async () => {
      const mockUser = {
        id: validUserId,
        email: "user@example.com",
      };

      mockAuthGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: "  Trimmed content  ",
          }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: validSessionId,
        user_id: validUserId,
        content: "Trimmed content", // Should be trimmed
      });
    });
  });

  describe("DELETE /api/sessions/[id]/comments", () => {
    it("returns method not allowed", async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        { method: "DELETE" }
      );

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Method Not Allowed");
      expect(response.headers.get("Allow")).toBe("GET, POST");
    });
  });
});

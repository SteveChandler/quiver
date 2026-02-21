/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: MockSupabaseClient;

// Mock bot blocking and rate limiting middleware
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit: (handler: any) => handler,
}));

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// Import after mocks
 
const { GET, POST } = require("@/app/api/users/[id]/comments/route");

describe("GET /api/users/[id]/comments", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  describe("Validation", () => {
    it("returns 400 when user id is not a valid UUID", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/not-a-uuid/comments"
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: "not-a-uuid" }) });
      await expectErrorResponse(res, 400, "Invalid user");
    });

    it("returns 400 when user id is missing", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users//comments"
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: "" }) });
      await expectErrorResponse(res, 400, "Invalid user");
    });

    it("returns 400 when user id is undefined", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/undefined/comments"
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: undefined as any }) });
      await expectErrorResponse(res, 400, "Invalid user");
    });
  });

  describe("Success scenarios", () => {
    it("returns empty array when user has no comments", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: [], error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).comments).toEqual([]);
      expect(commentsChain.select).toHaveBeenCalledWith(
        expect.stringContaining("session:sessions")
      );
      expect(commentsChain.eq).toHaveBeenCalledWith("user_id", userId);
      expect(commentsChain.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("returns user comments sorted by created_at desc", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const mockComments = [
        {
          id: "comment-3",
          user_id: userId,
          session_id: "session-3",
          content: "Latest comment",
          created_at: "2024-01-03T00:00:00Z",
          session: {
            beach: { name: "Ocean Beach" },
          },
        },
        {
          id: "comment-2",
          user_id: userId,
          session_id: "session-2",
          content: "Middle comment",
          created_at: "2024-01-02T00:00:00Z",
          session: {
            beach: { name: "La Jolla Shores" },
          },
        },
        {
          id: "comment-1",
          user_id: userId,
          session_id: "session-1",
          content: "Oldest comment",
          created_at: "2024-01-01T00:00:00Z",
          session: {
            beach: { name: "Pacific Beach" },
          },
        },
      ];

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: mockComments, error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).comments).toHaveLength(3);
      expect((body.data as any).comments[0].id).toBe("comment-3");
      expect((body.data as any).comments[1].id).toBe("comment-2");
      expect((body.data as any).comments[2].id).toBe("comment-1");
    });

    it("includes session and beach information in comments", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const mockComments = [
        {
          id: "comment-1",
          user_id: userId,
          session_id: "session-1",
          content: "Great waves today!",
          created_at: "2024-01-01T00:00:00Z",
          session: {
            beach: { name: "Windansea Beach" },
          },
        },
      ];

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: mockComments, error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).comments[0]).toHaveProperty("session");
      expect((body.data as any).comments[0].session).toHaveProperty("beach");
      expect((body.data as any).comments[0].session.beach.name).toBe(
        "Windansea Beach"
      );
    });

    it("handles comments with null session gracefully", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const mockComments = [
        {
          id: "comment-1",
          user_id: userId,
          session_id: "session-1",
          content: "Comment without session data",
          created_at: "2024-01-01T00:00:00Z",
          session: null,
        },
      ];

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: mockComments, error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).comments[0].session).toBeNull();
    });

    it("works for both authenticated and unauthenticated users", async () => {
      // This endpoint is public - no auth required
      mockUnauthenticatedUser(mockSupabaseClient);

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: [], error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      await expectSuccessResponse(res, 200);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when database query fails", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({
            data: null,
            error: { message: "Database connection failed", code: "PGRST001" },
          })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      await expectErrorResponse(res, 500, "Failed to load user comments");
    });

    it("handles unexpected errors gracefully", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      await expectErrorResponse(res, 500);
    });
  });

  describe("Method validation", () => {
    it("returns 405 for POST requests", async () => {
      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await POST(req as any, { params: Promise.resolve({ id: userId }) });

      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Method Not Allowed");
      expect(res.headers.get("Allow")).toBe("GET");
    });

    it("returns 405 for PUT requests", async () => {
      const req = createMockRequest(
        "PUT",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      // PUT falls through to POST handler which returns 405
      const res = await POST(req as any, { params: Promise.resolve({ id: userId }) });

      expect(res.status).toBe(405);
    });

    it("returns 405 for DELETE requests", async () => {
      const req = createMockRequest(
        "DELETE",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await POST(req as any, { params: Promise.resolve({ id: userId }) });

      expect(res.status).toBe(405);
    });
  });

  describe("Edge cases", () => {
    it("handles large number of comments", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const mockComments = Array.from({ length: 100 }, (_, i) => ({
        id: `comment-${i}`,
        user_id: userId,
        session_id: `session-${i}`,
        content: `Comment ${i}`,
        created_at: new Date(2024, 0, i + 1).toISOString(),
        session: {
          beach: { name: `Beach ${i}` },
        },
      }));

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: mockComments, error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).comments).toHaveLength(100);
    });

    it("handles special characters in user id gracefully", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/550e8400-e29b-41d4-a716-446655440000%20/comments"
      );

      const res = await GET(req as any, {
        params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000 " }),
      });
      await expectErrorResponse(res, 400);
    });

    it("handles null data from database query", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const commentsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn((onResolve: any) =>
          onResolve({ data: null, error: null })
        ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "comments") return commentsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/comments`
      );

      const res = await GET(req as any, { params: Promise.resolve({ id: userId }) });
      const body = await expectSuccessResponse(res, 200);

      // Should return empty array when data is null
      expect((body.data as any).comments).toEqual([]);
    });
  });
});

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

// The toggle route was migrated from delegating to a `"use server"` action
// (`toggleSessionLike`) to inline DB queries via the Bearer-aware Supabase
// client returned by withAuth — required so native (Bearer) callers
// authenticate correctly. Tests mock the supabase chain directly.
//
// `creditAuthorWithXP` is fired-and-forgotten on the success path; stub it
// to avoid hitting the real service-role client during tests.
jest.mock("@/lib/gamification", () => ({
  creditAuthorWithXP: jest.fn().mockResolvedValue(undefined),
}));

// Import route handlers after mocks are set up
import { GET } from "@/app/api/sessions/[id]/likes/route";
import { POST } from "@/app/api/sessions/[id]/likes/toggle/route";

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

      // Custom chain: SELECT returns null (not liked yet) → INSERT path.
      // The DELETE chain isn't exercised here. The route's INSERT path is
      // `.from("session_likes").insert(...)` (terminal — no further chain).
      // Then `.from("sessions").select().eq().single()`.
      let lastTable = "";
      mockFrom.mockImplementation((table: string) => {
        lastTable = table;
        if (table === "session_likes") {
          const selectChain: any = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
          return {
            ...selectChain,
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { user_id: validUserId },
              error: null,
            }),
          };
        }
        return {};
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
      expect(data.data.message).toContain("liked");
      expect(lastTable).toBeTruthy();
    });

    it("toggles unlike when already liked", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // SELECT returns existing row → DELETE path.
      // The route makes TWO `.from("session_likes")` calls:
      //   1. .select("id").eq().eq().maybeSingle() → existing
      //   2. .delete().eq("id", existing.id)        → terminal eq
      // Each `.from()` invocation returns its own chain so eq's behavior
      // doesn't have to do double-duty.
      let fromCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table !== "session_likes") return {};
        fromCall++;
        if (fromCall === 1) {
          // SELECT chain
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "like-existing" },
              error: null,
            }),
          };
        }
        // DELETE chain — eq is terminal
        return {
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        };
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
      expect(data.data.message).toContain("unliked");
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

    it("returns 500 when SELECT throws non-PGRST116", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "session_likes") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "OTHER", message: "RLS violation" },
            }),
          };
        }
        return {};
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("returns 500 when INSERT fails", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "session_likes") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockResolvedValue({
              error: { message: "Database connection failed" },
            }),
          };
        }
        return {};
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to toggle like");
    });
  });

  describe("Edge Cases", () => {
    it("handles SELECT failures on non-existent session as a 500", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // For non-existent sessions, the route still hits session_likes
      // (which has no rows for that session_id) and returns the INSERT
      // path. The INSERT then fails on FK violation. We simulate the
      // FK error and expect a generic 500.
      mockFrom.mockImplementation((table: string) => {
        if (table === "session_likes") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockResolvedValue({
              error: { code: "23503", message: "FK violation: sessions" },
            }),
          };
        }
        return {};
      });

      const nonExistentId = "999e9999-e99b-99d9-a999-999999999999";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${nonExistentId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: nonExistentId } });
      const data = await response.json();

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

      // 3 sequential toggles: like → unlike → like.
      // Each request is independent; we re-arm `mockFrom` per request and
      // hand out fresh chain objects per `.from()` call (the SELECT/DELETE/
      // INSERT chains have different terminal-method semantics for `.eq()`).
      const states: Array<"like" | "unlike" | "like"> = ["like", "unlike", "like"];
      const responses: Response[] = [];
      for (const state of states) {
        const existing = state === "unlike" ? { id: "like-existing" } : null;
        let fromCall = 0;
        mockFrom.mockImplementation((table: string) => {
          if (table === "session_likes") {
            fromCall++;
            if (fromCall === 1) {
              // SELECT chain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                  data: existing,
                  error: null,
                }),
              };
            }
            // Second call: DELETE (unlike) or INSERT (like)
            if (existing) {
              return {
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ error: null }),
              };
            }
            return { insert: jest.fn().mockResolvedValue({ error: null }) };
          }
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { user_id: validUserId },
                error: null,
              }),
            };
          }
          return {};
        });

        const request = new NextRequest(
          `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
          { method: "POST" }
        );
        responses.push(
          await POST(request, { params: { id: validSessionId } })
        );
      }

      const dataArray = await Promise.all(responses.map((res) => res.json()));

      expect(responses.every((res) => res.status === 200)).toBe(true);
      expect(dataArray.every((d) => d.success === true)).toBe(true);
      // first and third toggles are likes; second is unlike
      expect(dataArray[0].data.liked).toBe(true);
      expect(dataArray[1].data.liked).toBe(false);
      expect(dataArray[2].data.liked).toBe(true);
    });

    it("returns current like status after toggle", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "session_likes") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "sessions") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { user_id: validUserId },
              error: null,
            }),
          };
        }
        return {};
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

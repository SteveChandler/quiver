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
const mockRpc = jest.fn();
const mockAuthGetUser = jest.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
  rpc: mockRpc,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// The POST route fires creditAuthorWithXP() (fire-and-forget) after
// inserting a like. Mock it so it resolves immediately without
// touching the real gamification path.
jest.mock("@/lib/gamification", () => ({
  creditAuthorWithXP: jest.fn(() => Promise.resolve()),
}));

// Defensive guard: the route previously called enqueueNotification directly.
// Phase 5f moved that into the like_session_with_notification Postgres
// function, so the import is no longer used by the route — but a regression
// test catches accidental re-introduction.
const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

// Import route handlers after mocks are set up
import { GET } from "@/app/api/sessions/[id]/likes/route";
import { POST } from "@/app/api/sessions/[id]/likes/toggle/route";
import { creditAuthorWithXP as mockCreditAuthorWithXP } from "@/lib/gamification";

/**
 * Configure mocks for the POST route. Phase 5f flow:
 *   1. supabase.from("session_likes").select("id").eq().eq().maybeSingle()
 *   2a. supabase.from("session_likes").delete().eq()                            (existing → unlike)
 *   2b. supabase.rpc("like_session_with_notification", { p_session_id, ... })  (no existing → atomic like+notif)
 *       then supabase.from("sessions").select("user_id").eq().single()         (XP author lookup, only when !was_existing)
 *
 * `insertError` here represents an RPC-level failure (route propagates it),
 * since the actual insert now happens inside the Postgres function.
 */
function setupSessionLikesScenario(opts: {
  existing?: { id: string } | null;
  selectError?: { code: string; message: string } | null;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  sessionAuthor?: { user_id: string; beach_name?: string | null } | null;
  rpcResult?: {
    liked: boolean;
    was_existing: boolean;
    event_id: string | null;
    notification_dedup_collision: boolean;
  };
}) {
  const existing = opts.existing ?? null;
  const selectError = opts.selectError ?? null;
  const insertError = opts.insertError ?? null;
  const deleteError = opts.deleteError ?? null;
  const sessionAuthor = opts.sessionAuthor ?? null;
  const rpcResult = opts.rpcResult ?? {
    liked: true,
    was_existing: false,
    event_id: "evt-mock",
    notification_dedup_collision: false,
  };

  const sessionLikesSelectChain: any = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() =>
      Promise.resolve({ data: existing, error: selectError })
    ),
  };
  const sessionLikesDeleteChain: any = {
    eq: jest.fn(() => Promise.resolve({ error: deleteError })),
  };

  const sessionsSelectChain: any = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() =>
      Promise.resolve({ data: sessionAuthor, error: null })
    ),
  };

  mockFrom.mockImplementation((table: string) => {
    if (table === "session_likes") {
      return {
        select: jest.fn(() => sessionLikesSelectChain),
        delete: jest.fn(() => sessionLikesDeleteChain),
      };
    }
    if (table === "sessions") {
      return {
        select: jest.fn(() => sessionsSelectChain),
      };
    }
    throw new Error(`Unexpected supabase.from(${table})`);
  });

  mockRpc.mockImplementation((fn: string) => {
    if (fn === "like_session_with_notification") {
      return Promise.resolve({
        data: insertError ? null : rpcResult,
        error: insertError ?? null,
      });
    }
    throw new Error(`Unexpected supabase.rpc(${fn})`);
  });
}

describe("Session Likes API", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const otherUserId = "111fcdeb-51a2-43c1-a123-456789abcd11";

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-mock",
    });
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
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: otherUserId },
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
      expect(data.data.message).toBe("Session liked");
      expect(mockCreditAuthorWithXP).toHaveBeenCalledWith(
        otherUserId,
        "session",
        validSessionId,
      );
    });

    it("toggles unlike when already liked", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      setupSessionLikesScenario({ existing: { id: "like-row-1" } });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(false);
      expect(data.data.message).toBe("Session unliked");
      // XP must NOT be credited on unlike
      expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
    });

    it("prevents duplicate likes (handled by route)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // Insert raises a unique-constraint violation when a like already exists
      // and the route's existence check missed it (race condition).
      setupSessionLikesScenario({
        existing: null,
        insertError: {
          message: "duplicate key value violates unique constraint",
        },
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
        data: { user: { id: validUserId, email: "user@example.com" } },
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

    it("rejects like on private non-owned session via RLS error", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: otherUserId, email: "other@example.com" } },
        error: null,
      });

      // RLS blocks the insert with a row-level-security error.
      setupSessionLikesScenario({
        existing: null,
        insertError: {
          message: "new row violates row-level security policy",
        },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      // RLS policy violations are currently returned as 500.
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("handles database errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // The initial select for an existing like raises a non-PGRST116 error.
      setupSessionLikesScenario({
        existing: null,
        selectError: { code: "P0001", message: "Database connection failed" },
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

    it("does NOT credit XP when liking own session", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // sessionAuthor matches the authed user — route should skip crediting.
      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: validUserId },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.liked).toBe(true);
      expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
    });

    it("invokes the like_session_with_notification RPC on like (Phase 5f atomicity)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: otherUserId, beach_name: "Mavericks" },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      await POST(request, { params: { id: validSessionId } });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("like_session_with_notification", {
        p_session_id: validSessionId,
        p_actor_id: validUserId,
        p_dedupe_key: `like:${validSessionId}:${validUserId}`,
      });
      // Phase 5f: route never calls enqueueNotification directly anymore.
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    });

    it("does NOT invoke the RPC on unlike (Phase 5f)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      setupSessionLikesScenario({ existing: { id: "like-row-1" } });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      await POST(request, { params: { id: validSessionId } });

      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    });

    it("skips XP credit when RPC reports the like already existed (idempotent re-POST) (Phase 5f)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // Local session_likes existence check missed it (race), but the RPC
      // reports was_existing=true — route should skip the XP lookup entirely.
      setupSessionLikesScenario({
        existing: null,
        rpcResult: {
          liked: true,
          was_existing: true,
          event_id: null,
          notification_dedup_collision: false,
        },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.liked).toBe(true);
      expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
    });

    it("does NOT credit XP when the session has been deleted", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // Deleted-session edge case: session lookup returns null, route still
      // succeeds the like but skips XP attribution.
      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.liked).toBe(true);
      expect(mockCreditAuthorWithXP).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles non-existent session ID gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // The like INSERT itself succeeds but the subsequent sessions lookup
      // returns null (session was deleted before the like landed). The
      // route returns 200 with liked=true — XP is silently skipped.
      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: null,
      });

      const nonExistentId = "999e9999-e99b-49d9-a999-999999999999";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${nonExistentId}/likes/toggle`,
        { method: "POST" }
      );

      const response = await POST(request, { params: { id: nonExistentId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.liked).toBe(true);
    });

    it("handles rapid toggle requests", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      // First request: no existing → creates a like.
      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: otherUserId },
      });
      const r1 = await POST(
        new NextRequest(
          `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
          { method: "POST" }
        ),
        { params: { id: validSessionId } }
      );
      const d1 = await r1.json();
      expect(r1.status).toBe(200);
      expect(d1.data.liked).toBe(true);

      // Second request: existing now found → unlikes.
      setupSessionLikesScenario({ existing: { id: "like-row-rapid" } });
      const r2 = await POST(
        new NextRequest(
          `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
          { method: "POST" }
        ),
        { params: { id: validSessionId } }
      );
      const d2 = await r2.json();
      expect(r2.status).toBe(200);
      expect(d2.data.liked).toBe(false);

      // Third request: no existing again → re-likes.
      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: otherUserId },
      });
      const r3 = await POST(
        new NextRequest(
          `http://localhost:3000/api/sessions/${validSessionId}/likes/toggle`,
          { method: "POST" }
        ),
        { params: { id: validSessionId } }
      );
      const d3 = await r3.json();
      expect(r3.status).toBe(200);
      expect(d3.data.liked).toBe(true);
    });

    it("returns current like status after toggle", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: validUserId, email: "user@example.com" } },
        error: null,
      });

      setupSessionLikesScenario({
        existing: null,
        sessionAuthor: { user_id: otherUserId },
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

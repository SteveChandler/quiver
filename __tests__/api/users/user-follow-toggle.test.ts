/**
 * @jest-environment node
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  expectErrorResponse,
  expectSuccessResponse,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";

let mockSupabaseClient: MockSupabaseClient;

// The route uses the Bearer-aware supabase client from the withAuth context.
// withAuth itself goes through createSupabaseServerClient() in the wrapper,
// so we mock that to return our test client.
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// revalidatePath is a side-effect call we just need to no-op.
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

// Import after mocks.

const { POST, GET } = require("@/app/api/users/[id]/follow/toggle/route");

/**
 * Phase 5f flow (route uses RPC for the create-follow path):
 *   1. supabase.from("user_follows").select("id").eq().eq().maybeSingle()       → existing check
 *   2a. supabase.from("user_follows").delete().eq("id", ...)                     (existing → unfollow)
 *   2b. supabase.rpc("follow_user_with_notification", { ... })                   (no existing → atomic follow+notif)
 *
 * `insertError` here represents an RPC-level failure (route propagates it),
 * since the actual user_follows insert now happens inside the Postgres function.
 */
function setupUserFollowsTable(opts: {
  existing?: { id: string } | null;
  selectError?: { code: string; message: string } | null;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  counts?: { followers_count: number; following_count: number };
  countsError?: { message: string } | null;
  rpcResult?: {
    followed: boolean;
    was_existing: boolean;
    event_id: string | null;
    notification_dedup_collision: boolean;
  };
}) {
  const existing = opts.existing ?? null;
  const selectError = opts.selectError ?? null;
  const insertError = opts.insertError ?? null;
  const deleteError = opts.deleteError ?? null;
  const counts = opts.counts ?? { followers_count: 11, following_count: 4 };
  const countsError = opts.countsError ?? null;
  const rpcResult = opts.rpcResult ?? {
    followed: true,
    was_existing: false,
    event_id: "evt-mock",
    notification_dedup_collision: false,
  };

  const selectChain: any = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve({ data: existing, error: selectError })),
  };
  const deleteChain: any = {
    eq: jest.fn(() => Promise.resolve({ error: deleteError })),
  };
  const profileChain: any = {
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data: counts, error: countsError })),
  };

  (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "user_follows") {
      return {
        select: jest.fn(() => selectChain),
        delete: jest.fn(() => deleteChain),
      } as any;
    }
    if (table === "profiles") {
      return {
        select: jest.fn(() => profileChain),
      } as any;
    }
    throw new Error(`Unexpected supabase.from(${table}) — test only mocks follow tables`);
  });

  (mockSupabaseClient.rpc as jest.Mock).mockImplementation((fn: string) => {
    if (fn === "follow_user_with_notification") {
      return Promise.resolve({
        data: insertError ? null : rpcResult,
        error: insertError ?? null,
      });
    }
    throw new Error(`Unexpected supabase.rpc(${fn})`);
  });
}

describe("POST /api/users/[id]/follow/toggle", () => {
  const followerId = "550e8400-e29b-41d4-a716-446655440000";
  const targetUserId = "550e8400-e29b-41d4-a716-446655440001";
  const followerUser = createMockUser({ id: followerId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-mock",
    });
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 401, "Authentication required");
    });

    it("returns 401 when auth check fails", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", name: "AuthError", status: 401 } as any,
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 401);
    });
  });

  describe("Validation", () => {
    it("returns 400 when user id is not a valid UUID", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      const req = createMockRequest(
        "POST",
        "http://localhost:3000/api/users/not-a-uuid/follow/toggle",
      );
      const res = await POST(req as any, { params: { id: "not-a-uuid" } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });

    it("returns 400 when user id is missing", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      const req = createMockRequest(
        "POST",
        "http://localhost:3000/api/users//follow/toggle",
      );
      const res = await POST(req as any, { params: { id: "" } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });

    it("returns 400 when user id is undefined", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      const req = createMockRequest(
        "POST",
        "http://localhost:3000/api/users/undefined/follow/toggle",
      );
      const res = await POST(req as any, { params: { id: undefined as any } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });
  });

  describe("Self-follow prevention", () => {
    it("returns 500 when user tries to follow themselves", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: null });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${followerId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: followerId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });
  });

  describe("Follow (toggle when not following)", () => {
    it("creates a follow relationship when not already following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: null });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).following).toBe(true);
      expect((body.data as any).followersCount).toBe(11);
      expect((body.data as any).followingCount).toBe(4);
      expect((body.data as any).message).toBe("Now following");
    });

    it("returns 500 when database insert fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: null,
        insertError: { message: "duplicate key value violates unique constraint" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });

    it("invokes the follow_user_with_notification RPC on follow (Phase 5f atomicity)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: null });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      await POST(req as any, { params: { id: targetUserId } });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
      // Dedupe key carries an ISO `YYYY-Www` time bucket so unfollow → re-follow
      // within the same week stays deduped, but re-engagement next week
      // notifies again. The bucket is computed from `new Date()` at request
      // time, so we assert the prefix rather than a hard-coded week.
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "follow_user_with_notification",
        expect.objectContaining({
          p_target_user_id: targetUserId,
          p_actor_id: followerId,
          p_dedupe_key: expect.stringMatching(
            new RegExp(
              `^follow:${followerId}:${targetUserId}:\\d{4}-W\\d{2}$`
            )
          ),
        })
      );
      // Phase 5f: route never calls enqueueNotification directly anymore.
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    });

    it("returns 500 when the RPC fails (Phase 5f — atomicity rollback observable as error)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: null,
        insertError: { message: "boom" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
      // Even on failure the route must not call the legacy enqueue path —
      // atomicity is the function's responsibility, not the route's.
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    });
  });

  describe("Unfollow (toggle when already following)", () => {
    it("removes follow relationship when already following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: { id: "follow-existing-1" } });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).following).toBe(false);
      expect((body.data as any).followersCount).toBe(11);
      expect((body.data as any).followingCount).toBe(4);
      expect((body.data as any).message).toBe("Unfollowed");
    });

    it("does NOT invoke the RPC on unfollow (Phase 5f)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: { id: "follow-existing-3" } });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      await POST(req as any, { params: { id: targetUserId } });

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    });

    it("returns 500 when unfollow delete fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: { id: "follow-existing-2" },
        deleteError: { message: "row level security blocked delete" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });
  });

  describe("Toggle behavior", () => {
    it("flips from not-following to following on first POST", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: null });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);
      expect((body.data as any).following).toBe(true);
    });

    it("flips from following to not-following when an existing row is found", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: { id: "follow-row-toggle" } });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);
      expect((body.data as any).following).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("returns 500 when select returns a non-PGRST116 error", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: null,
        selectError: { code: "P0001", message: "boom" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });

    it("treats PGRST116 (no rows) as no-existing and inserts", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: null,
        selectError: { code: "PGRST116", message: "no rows" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);
      expect((body.data as any).following).toBe(true);
    });
  });
});

describe("GET /api/users/[id]/follow/toggle", () => {
  it("returns 405 method not allowed", async () => {
    const res: any = GET();
    expect(res.status).toBe(405);
  });
});

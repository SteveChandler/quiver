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
 * The route does up to 3 chained calls on supabase.from("user_follows"):
 *   1. .select("id").eq("follower_id", X).eq("following_id", Y).maybeSingle()  → existing follow check
 *   2a. .delete().eq("id", existing.id)                                          (when following → unfollow)
 *   2b. .insert({ follower_id, following_id })                                    (when not following → follow)
 */
function setupUserFollowsTable(opts: {
  existing?: { id: string } | null;
  selectError?: { code: string; message: string } | null;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const existing = opts.existing ?? null;
  const selectError = opts.selectError ?? null;
  const insertError = opts.insertError ?? null;
  const deleteError = opts.deleteError ?? null;

  const selectChain: any = {
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve({ data: existing, error: selectError })),
  };
  const deleteChain: any = {
    eq: jest.fn(() => Promise.resolve({ error: deleteError })),
  };
  const insertChain: any = Promise.resolve({ error: insertError });

  (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "user_follows") {
      return {
        select: jest.fn(() => selectChain),
        delete: jest.fn(() => deleteChain),
        insert: jest.fn(() => insertChain),
      } as any;
    }
    throw new Error(`Unexpected supabase.from(${table}) — test only mocks user_follows`);
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

    it("enqueues a `follow` notification event on successful follow (Phase 3c)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: null });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      await POST(req as any, { params: { id: targetUserId } });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
      // Dedupe key carries an ISO `YYYY-Www` time bucket so unfollow → re-follow
      // within the same week stays deduped, but re-engagement next week
      // notifies again. The bucket is computed from `new Date()` at request
      // time, so we assert the prefix rather than a hard-coded week.
      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "follow",
          recipientUserId: targetUserId,
          actorUserId: followerId,
          entityType: "user",
          entityId: targetUserId,
          payload: {},
          dedupeKey: expect.stringMatching(
            new RegExp(
              `^follow:${followerId}:${targetUserId}:\\d{4}-W\\d{2}$`
            )
          ),
        })
      );
    });

    it("does NOT enqueue a notification when the follow insert fails (Phase 3c)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({
        existing: null,
        insertError: { message: "boom" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      await POST(req as any, { params: { id: targetUserId } });
      await Promise.resolve();
      await Promise.resolve();

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
      expect((body.data as any).message).toBe("Unfollowed");
    });

    it("does NOT enqueue a notification on unfollow (Phase 3c)", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      setupUserFollowsTable({ existing: { id: "follow-existing-3" } });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`,
      );
      await POST(req as any, { params: { id: targetUserId } });
      await Promise.resolve();
      await Promise.resolve();

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

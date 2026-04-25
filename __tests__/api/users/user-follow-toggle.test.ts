/**
 * @jest-environment node
 */

/**
 * Tests for POST /api/users/[id]/follow/toggle
 *
 * The route was migrated from delegating to a `"use server"` action
 * (`toggleUserFollow`) to inline DB queries via the Bearer-aware Supabase
 * client returned by withAuth — required so native (Bearer) callers
 * authenticate correctly. Tests now exercise the route's DB chain directly.
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

// withAuth uses createSupabaseServerClient for cookie-auth path. Bearer path
// uses createBearerTokenClient — these tests use cookie auth.
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// Bearer auth path is unused here but the route module loads transitively.
jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: () => mockSupabaseClient,
}));

// Mock revalidatePath to avoid Next.js cache machinery in tests.
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// Import after mocks
const { POST, GET } = require("@/app/api/users/[id]/follow/toggle/route");

/**
 * Build a chainable mock for the user_follows table.
 *
 * @param existing - what `.maybeSingle()` returns from the SELECT path
 *   (`{ id: string }` to simulate an existing follow that should be deleted,
 *    `null` to simulate no existing follow → INSERT path)
 * @param overrides - per-method error injection
 */
function mockUserFollowsChain(
  client: MockSupabaseClient,
  existing: { id: string } | null,
  overrides: {
    selectError?: { code?: string; message: string };
    insertError?: { message: string };
    deleteError?: { message: string };
  } = {}
) {
  const selectChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: existing,
      error: overrides.selectError ?? null,
    }),
  };
  const deleteChain: any = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: overrides.deleteError ?? null }),
  };
  const insertChain: any = {
    insert: jest.fn().mockResolvedValue({ error: overrides.insertError ?? null }),
  };

  client.from.mockImplementation(() => {
    // Return a single chain that supports select/delete/insert; the route
    // calls one terminal method per query so this single object is fine.
    return {
      ...selectChain,
      ...deleteChain,
      ...insertChain,
      // re-bind so chains continue to return the merged object
      select: jest.fn().mockReturnValue(selectChain),
      delete: jest.fn().mockReturnValue(deleteChain),
      insert: insertChain.insert,
    } as any;
  });
}

describe("POST /api/users/[id]/follow/toggle", () => {
  const followerId = "550e8400-e29b-41d4-a716-446655440000";
  const targetUserId = "550e8400-e29b-41d4-a716-446655440001";
  const followerUser = createMockUser({ id: followerId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
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
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
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
        "http://localhost:3000/api/users/not-a-uuid/follow/toggle"
      );

      const res = await POST(req as any, { params: { id: "not-a-uuid" } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });

    it("returns 400 when user id is missing", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      const req = createMockRequest(
        "POST",
        "http://localhost:3000/api/users//follow/toggle"
      );

      const res = await POST(req as any, { params: { id: "" } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });

    it("returns 400 when user id is undefined", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      const req = createMockRequest(
        "POST",
        "http://localhost:3000/api/users/undefined/follow/toggle"
      );

      const res = await POST(req as any, { params: { id: undefined as any } });
      await expectErrorResponse(res, 400, "Invalid user format");
    });
  });

  describe("Self-follow prevention", () => {
    it("returns 500 when user tries to follow themselves", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${followerId}/follow/toggle`
      );

      // Self-follow throws "Cannot follow yourself" — bubbles to withAuth
      // error handler and surfaces as the route's `errorMessage`.
      const res = await POST(req as any, { params: { id: followerId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });
  });

  describe("Follow (toggle when not following)", () => {
    it("creates a follow relationship when not already following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, null);

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).following).toBe(true);
      expect((body.data as any).message).toContain("Now following");
    });

    it("returns 500 when database insert fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, null, {
        insertError: { message: "Database error" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
    });
  });

  describe("Unfollow (toggle when already following)", () => {
    it("removes follow relationship when already following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, { id: "follow-existing" });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).following).toBe(false);
      expect((body.data as any).message).toContain("Unfollowed");
    });

    it("returns 500 when unfollow delete fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(
        mockSupabaseClient,
        { id: "follow-existing" },
        { deleteError: { message: "Failed to delete follow relationship" } }
      );

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
    });
  });

  describe("Toggle behavior", () => {
    it("correctly toggles from not following to following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, null);

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).following).toBe(true);
      expect((body.data as any).message).toContain("Now following");
    });

    it("correctly toggles from following to not following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, { id: "follow-existing" });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).following).toBe(false);
      expect((body.data as any).message).toContain("Unfollowed");
    });
  });

  describe("Edge cases", () => {
    it("returns 500 when SELECT throws a non-PGRST116 error", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);
      mockUserFollowsChain(mockSupabaseClient, null, {
        selectError: { code: "OTHER", message: "Database connection failed" },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });
  });

  describe("Method validation", () => {
    it("returns 405 for GET requests", async () => {
      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });

      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Method Not Allowed");
      expect(res.headers.get("Allow")).toBe("POST");
    });

    it("returns 405 for PUT requests (falls through to GET handler)", async () => {
      const req = createMockRequest(
        "PUT",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      expect(res.status).toBe(405);
    });

    it("returns 405 for DELETE requests (falls through to GET handler)", async () => {
      const req = createMockRequest(
        "DELETE",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      expect(res.status).toBe(405);
    });
  });
});

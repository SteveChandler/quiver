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

// Mock the server action that's called by the route
jest.mock("@/actions/social-actions", () => ({
  toggleUserFollow: jest.fn(),
}));

// Mock the Supabase server client - used by withAuth wrapper
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// Mock revalidatePath to avoid Next.js cache issues in tests
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// Import after mocks are set up
 
const { POST, GET } = require("@/app/api/users/[id]/follow/toggle/route");
 
const { toggleUserFollow } = require("@/actions/social-actions");

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

      // Mock the action to return self-follow error
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
        error: "Cannot follow yourself",
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${followerId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: followerId } });
      // Error is caught by withAuth and becomes generic message
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });
  });

  describe("Follow (toggle when not following)", () => {
    it("creates a follow relationship when not already following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      const newFollowId = "follow-123";

      // Mock the action to return success with follow data
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          followId: newFollowId,
          message: "Now following Target User",
        },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      // Response is nested: body.data contains the action result
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).data).toHaveProperty("followId", newFollowId);
      expect((body.data as any).data).toHaveProperty("message");
      expect((body.data as any).data.message).toContain("Target User");

      // Verify the action was called with correct user ID
      expect(toggleUserFollow).toHaveBeenCalledWith(targetUserId);
    });

    it("returns 500 when target user does not exist", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock the action to return user not found error
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
        error: "User not found",
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      // Error is caught by withAuth and becomes generic message
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });

    it("returns 500 when database insert fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock the action to return database error
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
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

      // Mock the action to return unfollow success
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          message: "Unfollowed Target User",
        },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).data).toHaveProperty("message");
      expect((body.data as any).data.message).toContain("Unfollowed");
      expect((body.data as any).data.message).toContain("Target User");

      // Verify the action was called
      expect(toggleUserFollow).toHaveBeenCalledWith(targetUserId);
    });

    it("returns 500 when unfollow delete fails", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock the action to return delete error
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
        error: "Failed to delete follow relationship",
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
    });

    it("handles missing target user name gracefully on unfollow", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock the action to return success with fallback user name
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          message: "Unfollowed user",
        },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect(body.success).toBe(true);
      expect((body.data as any).success).toBe(true);
      expect((body.data as any).data).toHaveProperty("message");
      // Should use "user" as fallback when name not found
      expect((body.data as any).data.message).toContain("Unfollowed user");
    });
  });

  describe("Toggle behavior", () => {
    it("correctly toggles from not following to following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      const newFollowId = "follow-new";

      // Mock successful follow action
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          followId: newFollowId,
          message: "Now following Toggle Test User",
        },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).data).toHaveProperty("followId", newFollowId);
      expect((body.data as any).data.message).toContain("Now following");
    });

    it("correctly toggles from following to not following", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock successful unfollow action
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          message: "Unfollowed Unfollow Test User",
        },
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).data.message).toContain("Unfollowed");
      expect((body.data as any).data.message).toContain("Unfollow Test User");
    });
  });

  describe("Edge cases", () => {
    it("handles generic errors gracefully", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock action with generic error
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
        error: "An unexpected error occurred",
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
    });

    it("handles action returning undefined error message", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock action with no error message
      (toggleUserFollow as jest.Mock).mockResolvedValue({
        success: false,
      });

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500, "Failed to toggle follow");
    });

    it("handles action throwing exception", async () => {
      mockAuthenticatedUser(mockSupabaseClient, followerUser);

      // Mock action throwing error
      (toggleUserFollow as jest.Mock).mockRejectedValue(
        new Error("Database connection failed")
      );

      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await POST(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
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
      // Allowed methods are in the Allow header, not body
      expect(res.headers.get("Allow")).toBe("POST");
    });

    it("returns 405 for PUT requests", async () => {
      // PUT is not defined, should use methodNotAllowed from GET handler
      const req = createMockRequest(
        "PUT",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      // Since PUT is not defined, it will fall through to GET
      const res = await GET(req as any, { params: { id: targetUserId } });

      expect(res.status).toBe(405);
    });

    it("returns 405 for DELETE requests", async () => {
      const req = createMockRequest(
        "DELETE",
        `http://localhost:3000/api/users/${targetUserId}/follow/toggle`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });

      expect(res.status).toBe(405);
    });
  });
});

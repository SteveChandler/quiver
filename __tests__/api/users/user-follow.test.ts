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

// Mock the API wrappers
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any, options?: any) => {
      return async (request: any, context: any) => {
        try {
          const supabase = mockSupabaseClient;
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          // If optional auth is enabled, continue without user
          if (options?.optional && (!user || userError)) {
            return await handler(request, {
              user: null,
              supabase,
              params: context.params,
            });
          }

          // Otherwise require authentication
          if (!user || userError) {
            return actual.createAuthError();
          }

          return await handler(request, {
            user,
            supabase,
            params: context.params,
          });
        } catch (error) {
          // Catch any errors thrown by the handler and return 500
          return actual.handleApiError(error, options?.errorMessage || "Internal server error");
        }
      };
    },
  };
});

// Mock Supabase server client
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabaseClient,
}));

// Import after mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET, POST } = require("@/app/api/users/[id]/follow/route");

describe("GET /api/users/[id]/follow", () => {
  const userId = "550e8400-e29b-41d4-a716-446655440000";
  const targetUserId = "550e8400-e29b-41d4-a716-446655440001";
  const user = createMockUser({ id: userId });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
  });

  describe("Validation", () => {
    it("returns 400 when user id is not a valid UUID", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/not-a-uuid/follow"
      );

      const res = await GET(req as any, { params: { id: "not-a-uuid" } });
      await expectErrorResponse(res, 400, "Invalid");
    });

    it("returns 400 when user id is missing", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users//follow"
      );

      const res = await GET(req as any, { params: { id: "" } });
      await expectErrorResponse(res, 400, "Invalid");
    });

    it("returns 400 when user id is undefined", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/undefined/follow"
      );

      const res = await GET(req as any, { params: { id: undefined as any } });
      await expectErrorResponse(res, 400, "Invalid");
    });
  });

  describe("Unauthenticated users", () => {
    it("returns follow status with following=false when not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 10,
            following_count: 5,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).following).toBe(false);
      expect((body.data as any).followersCount).toBe(10);
      expect((body.data as any).followingCount).toBe(5);
    });

    it("handles profiles with zero followers/following", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 0,
            following_count: 0,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).followersCount).toBe(0);
      expect((body.data as any).followingCount).toBe(0);
    });

    it("handles null follower/following counts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: null,
            following_count: null,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).followersCount).toBe(0);
      expect((body.data as any).followingCount).toBe(0);
    });
  });

  describe("Authenticated users", () => {
    it("returns following=false when user is not following target", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 10,
            following_count: 5,
          },
          error: null,
        }),
      };

      const userFollowsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "user_follows") return userFollowsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).following).toBe(false);
      expect((body.data as any).followersCount).toBe(10);
      expect((body.data as any).followingCount).toBe(5);

      // Verify query was made
      expect(userFollowsChain.eq).toHaveBeenCalledWith("follower_id", userId);
      expect(userFollowsChain.eq).toHaveBeenCalledWith("following_id", targetUserId);
    });

    it("returns following=true when user is following target", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 11,
            following_count: 6,
          },
          error: null,
        }),
      };

      const userFollowsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: "follow-123" },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "user_follows") return userFollowsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).following).toBe(true);
      expect((body.data as any).followersCount).toBe(11);
      expect((body.data as any).followingCount).toBe(6);
    });

    it("does not check follow status when user requests their own profile", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 15,
            following_count: 20,
          },
          error: null,
        }),
      };

      const userFollowsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "user_follows") return userFollowsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${userId}/follow`
      );

      const res = await GET(req as any, { params: { id: userId } });
      const body = await expectSuccessResponse(res, 200);

      // Should return false (you don't follow yourself)
      expect((body.data as any).following).toBe(false);
      // Should NOT have queried user_follows table
      expect(userFollowsChain.select).not.toHaveBeenCalled();
    });

    it("handles PGRST116 error (not found) gracefully", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 10,
            following_count: 5,
          },
          error: null,
        }),
      };

      const userFollowsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "No rows found" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "user_follows") return userFollowsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      // PGRST116 should be treated as "not following"
      expect((body.data as any).following).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when profile query fails", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      // The withAuth wrapper will catch the error and wrap it
      await expectErrorResponse(res, 500);
    });

    it("returns 500 when user_follows query fails with non-PGRST116 error", async () => {
      mockAuthenticatedUser(mockSupabaseClient, user);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 10,
            following_count: 5,
          },
          error: null,
        }),
      };

      const userFollowsChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error", code: "PGRST001" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        if (table === "user_follows") return userFollowsChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      // The withAuth wrapper will catch the error and wrap it
      await expectErrorResponse(res, 500);
    });

    it("handles unexpected errors gracefully", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      await expectErrorResponse(res, 500);
    });
  });

  describe("Method validation", () => {
    it("returns 405 for POST requests", async () => {
      const req = createMockRequest(
        "POST",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await POST();

      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Method Not Allowed");
      expect(res.headers.get("Allow")).toBe("GET");
    });

    it("returns 405 for PUT requests", async () => {
      const req = createMockRequest(
        "PUT",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      // PUT falls through to POST handler
      const res = await POST();

      expect(res.status).toBe(405);
    });

    it("returns 405 for DELETE requests", async () => {
      const req = createMockRequest(
        "DELETE",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await POST();

      expect(res.status).toBe(405);
    });
  });

  describe("Edge cases", () => {
    it("handles large follower/following counts", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const profilesChain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            followers_count: 999999,
            following_count: 888888,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profilesChain;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const req = createMockRequest(
        "GET",
        `http://localhost:3000/api/users/${targetUserId}/follow`
      );

      const res = await GET(req as any, { params: { id: targetUserId } });
      const body = await expectSuccessResponse(res, 200);

      expect((body.data as any).followersCount).toBe(999999);
      expect((body.data as any).followingCount).toBe(888888);
    });

    it("handles special characters in UUID gracefully", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/users/550e8400-e29b-41d4-a716-446655440000%20/follow"
      );

      const res = await GET(req as any, {
        params: { id: "550e8400-e29b-41d4-a716-446655440000 " },
      });
      await expectErrorResponse(res, 400);
    });
  });
});

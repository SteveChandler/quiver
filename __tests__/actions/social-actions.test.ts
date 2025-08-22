import { followUser, unfollowUser, getUserFollowing, getUserFollowers, isFollowing, getSuggestedUsers } from "@/actions/social-actions";

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      not: jest.fn(() => ({
        gt: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: "follow-id" }, error: null })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    })),
  })),
};

const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: jest.fn((callback) => async (...args: any[]) => {
    try {
      const data = await callback(mockUser, mockSupabaseClient, ...args);
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

describe("Social Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("followUser", () => {
    it("should successfully follow a user", async () => {
      // Mock: no existing follow relationship
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        }),
      });

      // Mock: target user exists
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ 
              data: { id: "target-user-id", full_name: "Test User" }, 
              error: null 
            }),
          }),
        }),
      });

      // Mock: successful follow creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => ({ 
              data: { id: "follow-id" }, 
              error: null 
            }),
          }),
        }),
      });

      const result = await followUser("target-user-id");

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("Now following Test User");
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("user_follows");
    });

    it("should prevent self-follow", async () => {
      await expect(followUser(mockUser.id)).rejects.toThrow("Cannot follow yourself");
    });

    it("should prevent duplicate follows", async () => {
      // Mock: existing follow relationship
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: { id: "existing-follow" }, error: null }),
            }),
          }),
        }),
      });

      await expect(followUser("target-user-id")).rejects.toThrow("Already following this user");
    });

    it("should handle non-existent target user", async () => {
      // Mock: no existing follow
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        }),
      });

      // Mock: target user not found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ data: null, error: { message: "Not found" } }),
          }),
        }),
      });

      await expect(followUser("non-existent-user")).rejects.toThrow("User not found");
    });
  });

  describe("unfollowUser", () => {
    it("should successfully unfollow a user", async () => {
      // Mock: existing follow relationship
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: { id: "follow-id" }, error: null }),
            }),
          }),
        }),
      });

      // Mock: successful delete
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: () => ({
          eq: () => ({ error: null }),
        }),
      });

      // Mock: get target user name
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ data: { full_name: "Test User" }, error: null }),
          }),
        }),
      });

      const result = await unfollowUser("target-user-id");

      expect(result.success).toBe(true);
      expect(result.data.message).toContain("Unfollowed Test User");
    });

    it("should handle non-existent follow relationship", async () => {
      // Mock: no follow relationship found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: { message: "Not found" } }),
            }),
          }),
        }),
      });

      await expect(unfollowUser("target-user-id")).rejects.toThrow("Follow relationship not found");
    });
  });

  describe("getUserFollowing", () => {
    it("should return list of users being followed", async () => {
      const mockFollowData = [
        {
          id: "follow-1",
          created_at: "2025-08-19T12:00:00Z",
          following: { id: "user-1", full_name: "User One" }
        },
        {
          id: "follow-2", 
          created_at: "2025-08-19T11:00:00Z",
          following: { id: "user-2", full_name: "User Two" }
        }
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ data: mockFollowData, error: null }),
            }),
          }),
        }),
      });

      const result = await getUserFollowing();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].full_name).toBe("User One");
      expect(result.data[1].full_name).toBe("User Two");
    });

    it("should handle empty following list", async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await getUserFollowing();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getUserFollowers", () => {
    it("should return list of followers", async () => {
      const mockFollowerData = [
        {
          id: "follow-1",
          created_at: "2025-08-19T12:00:00Z", 
          follower: { id: "user-1", full_name: "Follower One" }
        }
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({ data: mockFollowerData, error: null }),
            }),
          }),
        }),
      });

      const result = await getUserFollowers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].full_name).toBe("Follower One");
    });
  });

  describe("isFollowing", () => {
    it("should return true when following user", async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: { id: "follow-id" }, error: null }),
            }),
          }),
        }),
      });

      const result = await isFollowing("target-user-id");

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should return false when not following user", async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      });

      const result = await isFollowing("target-user-id");

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
  });

  describe("getSuggestedUsers", () => {
    it("should return suggested users to follow", async () => {
      // Mock: get currently following users
      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({ data: [{ following_id: "already-following" }], error: null }),
        }),
      });

      // Mock: get suggested users
      const mockSuggested = [
        { id: "user-1", full_name: "Popular User", followers_count: 10 },
        { id: "user-2", full_name: "Another User", followers_count: 5 }
      ];

      mockSupabaseClient.from.mockReturnValueOnce({
        select: () => ({
          not: () => ({
            gt: () => ({
              order: () => ({
                limit: () => ({ data: mockSuggested, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await getSuggestedUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].full_name).toBe("Popular User");
    });
  });
});
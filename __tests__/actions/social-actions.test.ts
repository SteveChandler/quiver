// Mock Supabase client with flexible chaining for social actions
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

// Helper to create chainable mock methods
const createMockChain = (finalResult: any): any => {
  const chainMethods: any = {
    select: jest.fn(() => chainMethods),
    eq: jest.fn(() => chainMethods),
    single: jest.fn(() => Promise.resolve(finalResult)),
    insert: jest.fn(() => chainMethods),
    delete: jest.fn(() => chainMethods),
    order: jest.fn(() => chainMethods),
    limit: jest.fn(() => Promise.resolve(finalResult)),
    not: jest.fn(() => chainMethods),
    gt: jest.fn(() => chainMethods),
  };
  return chainMethods;
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// Import after mocking
import {
  followUser,
  unfollowUser,
  getUserFollowing,
  getUserFollowers,
  isFollowing,
  toggleUserFollow,
  getSuggestedUsers,
} from "@/actions/social-actions";
import { revalidatePath } from "next/cache";

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

const mockTargetUser = {
  id: "user-2",
  full_name: "Target User",
};

const mockFollowRecord = {
  id: "follow-1",
  follower_id: "user-1",
  following_id: "user-2",
  created_at: "2024-01-01T00:00:00Z",
};

describe("Social Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful auth mock
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe("followUser", () => {
    it("should successfully follow a user", async () => {
      // Mock existing follow check (none found) - called first
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );

      // Mock target user lookup (found) - called second
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockTargetUser,
          error: null,
        })
      );

      // Mock follow insert (success) - called third
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      const result = await followUser("user-2");

      expect(result.success).toBe(true);
      expect(result.data!.data.followId).toBe("follow-1");
      expect(result.data!.data.message).toBe("Now following Target User");
      expect(revalidatePath).toHaveBeenCalledWith("/profile");
      expect(revalidatePath).toHaveBeenCalledWith("/profile/user-2");
    });

    it("should prevent following yourself", async () => {
      const result = await followUser("user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot follow yourself");
    });

    it("should handle already following error", async () => {
      // Mock existing follow relationship
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      const result = await followUser("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Already following this user");
    });

    it("should handle user not found error", async () => {
      // Mock no existing follow
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );

      // Mock user not found
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: { message: "User not found" },
        })
      );

      const result = await followUser("nonexistent-user");
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not found");
    });

    it("should handle database errors during insert", async () => {
      // Mock successful existing follow check and user lookup
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockTargetUser,
          error: null,
        })
      );

      // Mock insert error
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: { message: "Database error" },
        })
      );

      const result = await followUser("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should require authentication", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const result = await followUser("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Authentication error: Not authenticated");
    });
  });

  describe("unfollowUser", () => {
    it("should successfully unfollow a user", async () => {
      // Mock finding the follow relationship
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      // Mock successful delete
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );

      // Mock getting target user name
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockTargetUser,
          error: null,
        })
      );

      const result = await unfollowUser("user-2");

      expect(result.success).toBe(true);
      expect(result.data!.data.message).toBe("Unfollowed Target User");
      expect(revalidatePath).toHaveBeenCalledWith("/profile");
      expect(revalidatePath).toHaveBeenCalledWith("/profile/user-2");
    });

    it("should handle follow relationship not found", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Follow relationship not found" },
        })
      );

      const result = await unfollowUser("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Follow relationship not found");
    });

    it("should handle delete errors", async () => {
      // Mock finding the follow relationship (succeeds)
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      // Mock delete error (fails)
      const deleteChain: any = {
        select: jest.fn(() => deleteChain),
        eq: jest.fn(() => deleteChain),
        single: jest.fn(() => Promise.resolve({ data: null, error: { message: "Delete failed" } })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: { message: "Delete failed" } }))
        })),
      };
      
      mockSupabaseClient.from.mockReturnValueOnce(deleteChain);

      const result = await unfollowUser("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
    });
  });

  describe("getUserFollowing", () => {
    const mockFollowingData = [
      {
        id: "follow-1",
        created_at: "2024-01-01T00:00:00Z",
        following: mockTargetUser,
      },
    ];

    it("should get users that current user is following", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowingData,
          error: null,
        })
      );

      const result = await getUserFollowing();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([mockTargetUser]);
    });

    it("should get users for specific user ID", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowingData,
          error: null,
        })
      );

      const result = await getUserFollowing("user-3", 10);

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([mockTargetUser]);
    });

    it("should handle empty following list", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: [],
          error: null,
        })
      );

      const result = await getUserFollowing();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Database error" },
        })
      );

      const result = await getUserFollowing();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should filter out null following relationships", async () => {
      const mixedData = [
        {
          id: "follow-1",
          created_at: "2024-01-01T00:00:00Z",
          following: mockTargetUser,
        },
        {
          id: "follow-2",
          created_at: "2024-01-02T00:00:00Z",
          following: null,
        },
      ];

      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mixedData,
          error: null,
        })
      );

      const result = await getUserFollowing();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([mockTargetUser]);
    });
  });

  describe("getUserFollowers", () => {
    const mockFollowerData = [
      {
        id: "follow-1",
        created_at: "2024-01-01T00:00:00Z",
        follower: {
          id: "user-3",
          full_name: "Follower User",
        },
      },
    ];

    it("should get users that are following current user", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowerData,
          error: null,
        })
      );

      const result = await getUserFollowers();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([mockFollowerData[0].follower]);
    });

    it("should get followers for specific user ID", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowerData,
          error: null,
        })
      );

      const result = await getUserFollowers("user-3", 20);

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([mockFollowerData[0].follower]);
    });

    it("should handle empty followers list", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: [],
          error: null,
        })
      );

      const result = await getUserFollowers();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Database error" },
        })
      );

      const result = await getUserFollowers();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("isFollowing", () => {
    it("should return true when following user", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      const result = await isFollowing("user-2");

      expect(result.success).toBe(true);
      expect(result.data!.data).toBe(true);
    });

    it("should return false when not following user", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { code: "PGRST116" }, // No rows returned
        })
      );

      const result = await isFollowing("user-2");

      expect(result.success).toBe(true);
      expect(result.data!.data).toBe(false);
    });

    it("should handle other database errors", async () => {
      mockSupabaseClient.from.mockReturnValue(
        createMockChain({
          data: null,
          error: { message: "Database error", code: "OTHER_ERROR" },
        })
      );

      const result = await isFollowing("user-2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("toggleUserFollow", () => {
    it("should follow user when not already following", async () => {
      // Mock not following
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );

      // Mock successful follow operations
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockTargetUser,
          error: null,
        })
      );
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(true);
      expect((result.data!.data!.data as any).followId).toBe("follow-1");
    });

    it("should unfollow user when already following", async () => {
      // Mock already following
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );

      // Mock successful unfollow operations
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockFollowRecord,
          error: null,
        })
      );
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: null,
        })
      );
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockTargetUser,
          error: null,
        })
      );

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(true);
      expect(result.data!.data!.data!.message).toBe("Unfollowed Target User");
    });
  });

  describe("getSuggestedUsers", () => {
    const mockSuggestedUsers = [
      {
        id: "user-3",
        full_name: "Popular User",
        followers_count: 10,
      },
      {
        id: "user-4",
        full_name: "Another User",
        followers_count: 5,
      },
    ];

    it("should get suggested users to follow", async () => {
      // Mock current following
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: [{ following_id: "user-2" }],
          error: null,
        })
      );

      // Mock suggested users
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: mockSuggestedUsers,
          error: null,
        })
      );

      const result = await getSuggestedUsers(5);

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual(mockSuggestedUsers);
    });

    it("should handle empty suggestions", async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: [],
          error: null,
        })
      );

      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: [],
          error: null,
        })
      );

      const result = await getSuggestedUsers();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: [],
          error: null,
        })
      );

      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: null,
          error: { message: "Database error" },
        })
      );

      const result = await getSuggestedUsers();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should exclude already followed users and self", async () => {
      // Mock current following
      mockSupabaseClient.from.mockReturnValueOnce(
        createMockChain({
          data: [{ following_id: "user-2" }],
          error: null,
        })
      );

      // The profiles query should exclude user-1 (self) and user-2 (already following)
      const profilesChain = createMockChain({
        data: mockSuggestedUsers,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValueOnce(profilesChain);

      const result = await getSuggestedUsers();

      expect(result.success).toBe(true);
      expect(result.data!.data).toEqual(mockSuggestedUsers);
    });
  });
});
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
  getUserFollowing,
  getUserFollowers,
  isFollowing,
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
      expect(result.data).toEqual([mockTargetUser]);
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
      expect(result.data).toEqual([mockTargetUser]);
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
      expect(result.data).toEqual([]);
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
      expect(result.data).toEqual([mockTargetUser]);
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
      expect(result.data).toEqual([mockFollowerData[0].follower]);
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
      expect(result.data).toEqual([mockFollowerData[0].follower]);
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
      expect(result.data).toEqual([]);
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

});

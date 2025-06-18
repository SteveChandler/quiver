// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn(),
        })),
        single: jest.fn(),
      })),
      order: jest.fn(() => ({
        limit: jest.fn(),
      })),
    })),
    insert: jest.fn(),
    delete: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
};

// Mock revalidatePath
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

// Import after mocking
import {
  toggleUserFollow,
  getUserFollowStatus,
  getUserFollowers,
  getUserFollowing,
} from "@/actions/social-actions";
import { revalidatePath } from "next/cache";

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

const mockTargetUser = {
  id: "user-2",
  email: "user2@example.com",
};

const mockProfile = {
  id: "user-2",
  followers_count: 5,
  following_count: 10,
};

const mockFollowConnection = {
  id: "follow-1",
  follower_id: "user-1",
  following_id: "user-2",
  created_at: "2024-01-16T10:00:00Z",
};

const mockFollower = {
  id: "follow-1",
  created_at: "2024-01-16T10:00:00Z",
  follower: {
    id: "user-1",
    full_name: "John Doe",
    avatar_url: "https://example.com/avatar.jpg",
    email: "john@example.com",
  },
};

const mockFollowing = {
  id: "follow-1",
  created_at: "2024-01-16T10:00:00Z",
  following: {
    id: "user-2",
    full_name: "Jane Smith",
    avatar_url: "https://example.com/avatar2.jpg",
    email: "jane@example.com",
  },
};

describe("Social Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toggleUserFollow", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should follow a user when not already following", async () => {
      // Mock checking for existing follow (none found)
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      // Mock insert operation
      const mockInsert = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          insert: mockInsert,
        });

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(true);
      expect(result.following).toBe(true);
      expect(result.message).toBe("Following user");

      expect(mockSelect).toHaveBeenCalledWith("id");
      expect(mockEq1).toHaveBeenCalledWith("follower_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("following_id", "user-2");
      expect(mockInsert).toHaveBeenCalledWith({
        follower_id: "user-1",
        following_id: "user-2",
      });
    });

    it("should unfollow a user when already following", async () => {
      // Mock checking for existing follow (found)
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: mockFollowConnection,
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      // Mock delete operation
      const mockDeleteEq = jest.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: mockDeleteEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
        });

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(true);
      expect(result.following).toBe(false);
      expect(result.message).toBe("Unfollowed user");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "follow-1");
    });

    it("should prevent self-following", async () => {
      const result = await toggleUserFollow("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot follow yourself");
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should handle database errors during follow check", async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      const mockEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should handle insert errors", async () => {
      // Mock checking for existing follow (none found)
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      // Mock insert error
      const mockInsert = jest.fn().mockResolvedValue({
        error: new Error("Insert failed"),
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          insert: mockInsert,
        });

      const result = await toggleUserFollow("user-2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insert failed");
    });
  });

  describe("getUserFollowStatus", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should return correct follow status and counts", async () => {
      // Mock follow check
      const mockFollowMaybeSingle = jest.fn().mockResolvedValue({
        data: mockFollowConnection,
        error: null,
      });

      const mockFollowEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockFollowMaybeSingle,
      });

      const mockFollowEq1 = jest.fn().mockReturnValue({
        eq: mockFollowEq2,
      });

      const mockFollowSelect = jest.fn().mockReturnValue({
        eq: mockFollowEq1,
      });

      // Mock profile counts
      const mockProfileSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const mockProfileEq = jest.fn().mockReturnValue({
        single: mockProfileSingle,
      });

      const mockProfileSelect = jest.fn().mockReturnValue({
        eq: mockProfileEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockFollowSelect,
        })
        .mockReturnValueOnce({
          select: mockProfileSelect,
        });

      const result = await getUserFollowStatus("user-2");

      expect(result.success).toBe(true);
      expect(result.following).toBe(true);
      expect(result.followersCount).toBe(5);
      expect(result.followingCount).toBe(10);

      expect(mockFollowSelect).toHaveBeenCalledWith("id");
      expect(mockProfileSelect).toHaveBeenCalledWith(
        "followers_count, following_count"
      );
    });

    it("should return false for unauthenticated users", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getUserFollowStatus("user-2");

      expect(result.success).toBe(true);
      expect(result.following).toBe(false);
      expect(result.followersCount).toBe(0);
      expect(result.followingCount).toBe(0);
    });

    it("should handle profile fetch errors", async () => {
      // Mock follow check (no follow found)
      const mockFollowMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockFollowEq2 = jest.fn().mockReturnValue({
        maybeSingle: mockFollowMaybeSingle,
      });

      const mockFollowEq1 = jest.fn().mockReturnValue({
        eq: mockFollowEq2,
      });

      const mockFollowSelect = jest.fn().mockReturnValue({
        eq: mockFollowEq1,
      });

      // Mock profile error
      const mockProfileSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Profile not found"),
      });

      const mockProfileEq = jest.fn().mockReturnValue({
        single: mockProfileSingle,
      });

      const mockProfileSelect = jest.fn().mockReturnValue({
        eq: mockProfileEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockFollowSelect,
        })
        .mockReturnValueOnce({
          select: mockProfileSelect,
        });

      const result = await getUserFollowStatus("user-2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Profile not found");
    });
  });

  describe("getUserFollowers", () => {
    it("should return list of followers", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [mockFollower],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowers("user-2", 25);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockFollower]);

      expect(mockSelect).toHaveBeenCalledWith(`
        id,
        created_at,
        follower:profiles!user_follows_follower_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `);
      expect(mockEq).toHaveBeenCalledWith("following_id", "user-2");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(25);
    });

    it("should handle empty followers list", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowers("user-2");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowers("user-2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getUserFollowing", () => {
    it("should return list of users being followed", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [mockFollowing],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowing("user-1", 25);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockFollowing]);

      expect(mockSelect).toHaveBeenCalledWith(`
        id,
        created_at,
        following:profiles!user_follows_following_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `);
      expect(mockEq).toHaveBeenCalledWith("follower_id", "user-1");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockLimit).toHaveBeenCalledWith(25);
    });

    it("should use default limit when none provided", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowing("user-1");

      expect(result.success).toBe(true);
      expect(mockLimit).toHaveBeenCalledWith(50); // Default limit
    });

    it("should handle database errors", async () => {
      const mockLimit = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Connection failed"),
      });

      const mockOrder = jest.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserFollowing("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection failed");
    });
  });
});

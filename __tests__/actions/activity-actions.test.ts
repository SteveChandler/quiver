// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          range: jest.fn(),
        })),
      })),
      order: jest.fn(() => ({
        range: jest.fn(),
      })),
      in: jest.fn(() => ({
        order: jest.fn(() => ({
          range: jest.fn(),
        })),
      })),
    })),
  })),
  rpc: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

// Import after mocking
import {
  getUserActivityFeed,
  getUserActivities,
  getGlobalActivityFeed,
  createActivity,
} from "@/actions/activity-actions";
import type { ActivityFeedItem } from "@/types/database";

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

const mockActivity: ActivityFeedItem = {
  id: "activity-1",
  user_id: "user-1",
  activity_type: "session_logged",
  entity_type: "session",
  entity_id: "session-1",
  metadata: { beach_name: "Malibu Beach", status: "completed" },
  created_at: "2024-01-16T10:00:00Z",
  user_name: "John Doe",
  user_avatar: "https://example.com/avatar.jpg",
};

const mockActivityWithProfile = {
  id: "activity-1",
  user_id: "user-1",
  activity_type: "session_logged",
  entity_type: "session",
  entity_id: "session-1",
  metadata: { beach_name: "Malibu Beach", status: "completed" },
  created_at: "2024-01-16T10:00:00Z",
  profiles: {
    full_name: "John Doe",
    avatar_url: "https://example.com/avatar.jpg",
  },
};

const mockActivities: ActivityFeedItem[] = [
  mockActivity,
  {
    ...mockActivity,
    id: "activity-2",
    activity_type: "beach_reviewed",
    entity_type: "beach_review",
    metadata: { beach_id: "beach-1", overall_rating: 5 },
  },
];

describe("Activity Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserActivityFeed", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should return user activity feed using RPC function", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockActivities,
        error: null,
      });

      const result = await getUserActivityFeed("user-1", 25, 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockActivities);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_user_activity_feed",
        {
          p_user_id: "user-1",
          p_limit: 25,
          p_offset: 0,
        }
      );
    });

    it("should use default parameters", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getUserActivityFeed("user-1");

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_user_activity_feed",
        {
          p_user_id: "user-1",
          p_limit: 50,
          p_offset: 0,
        }
      );
    });

    it("should handle RPC function errors", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: new Error("Function execution failed"),
      });

      const result = await getUserActivityFeed("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Function execution failed");
    });

    it("should require authentication", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const result = await getUserActivityFeed("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should handle empty results", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await getUserActivityFeed("user-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getUserActivities", () => {
    it("should return user's specific activities", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: [mockActivityWithProfile],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
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

      const result = await getUserActivities("user-1", undefined, 25, 0);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data![0]).toEqual({
        id: "activity-1",
        user_id: "user-1",
        activity_type: "session_logged",
        entity_type: "session",
        entity_id: "session-1",
        metadata: { beach_name: "Malibu Beach", status: "completed" },
        created_at: "2024-01-16T10:00:00Z",
        user_name: "John Doe",
        user_avatar: "https://example.com/avatar.jpg",
      });

      expect(mockSelect).toHaveBeenCalledWith(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `);
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockRange).toHaveBeenCalledWith(0, 24); // offset to offset + limit - 1
    });

    it("should filter by activity types when provided", async () => {
      const mockIn = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      // Create object that can be awaited AND has .in() method
      const mockRangeResult = Object.assign(
        Promise.resolve({
          data: [],
          error: null,
        }),
        {
          in: mockIn,
        }
      );

      const mockRange = jest.fn().mockReturnValue(mockRangeResult);

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
      });

      // Create a proper chain: eq() returns an object that has order() method
      const mockEqResult = {
        order: mockOrder,
      };

      const mockEq = jest.fn().mockReturnValue(mockEqResult);

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserActivities("user-1", [
        "session_logged",
        "beach_reviewed",
      ]);

      expect(result.success).toBe(true);
      expect(mockIn).toHaveBeenCalledWith("activity_type", [
        "session_logged",
        "beach_reviewed",
      ]);
    });

    it("should use default parameters", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
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

      const result = await getUserActivities("user-1");

      expect(result.success).toBe(true);
      expect(mockRange).toHaveBeenCalledWith(0, 49); // Default limit of 50
    });

    it("should handle database errors", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
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

      const result = await getUserActivities("user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should handle empty profiles in data transformation", async () => {
      const activityWithoutProfile = {
        ...mockActivityWithProfile,
        profiles: null,
      };

      const mockRange = jest.fn().mockResolvedValue({
        data: [activityWithoutProfile],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
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

      const result = await getUserActivities("user-1");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data![0].user_name).toBeNull();
      expect(result.data![0].user_avatar).toBeNull();
    });
  });

  describe("getGlobalActivityFeed", () => {
    it("should return global activity feed", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: [mockActivityWithProfile],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getGlobalActivityFeed(25, 0);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      expect(mockSelect).toHaveBeenCalledWith(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `);
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
      expect(mockRange).toHaveBeenCalledWith(0, 24);
    });

    it("should use default parameters", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getGlobalActivityFeed();

      expect(result.success).toBe(true);
      expect(mockRange).toHaveBeenCalledWith(0, 49); // Default limit of 50
    });

    it("should handle database errors", async () => {
      const mockRange = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Global feed error"),
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getGlobalActivityFeed();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Global feed error");
    });
  });

  describe("createActivity", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should create activity using RPC function", async () => {
      const activityId = "new-activity-id";
      mockSupabaseClient.rpc.mockResolvedValue({
        data: activityId,
        error: null,
      });

      const result = await createActivity(
        "session_logged",
        "session",
        "session-123",
        { beach_name: "Malibu Beach" }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe(activityId);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("create_activity", {
        p_user_id: "user-1",
        p_activity_type: "session_logged",
        p_entity_type: "session",
        p_entity_id: "session-123",
        p_metadata: { beach_name: "Malibu Beach" },
      });
    });

    it("should use empty metadata when none provided", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: "activity-id",
        error: null,
      });

      const result = await createActivity(
        "beach_reviewed",
        "beach_review",
        "review-123"
      );

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("create_activity", {
        p_user_id: "user-1",
        p_activity_type: "beach_reviewed",
        p_entity_type: "beach_review",
        p_entity_id: "review-123",
        p_metadata: {},
      });
    });

    it("should require authentication", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const result = await createActivity(
        "session_logged",
        "session",
        "session-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("should handle RPC function errors", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: new Error("Activity creation failed"),
      });

      const result = await createActivity(
        "session_logged",
        "session",
        "session-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Activity creation failed");
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createActivity(
        "session_logged",
        "session",
        "session-123"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });
  });
});

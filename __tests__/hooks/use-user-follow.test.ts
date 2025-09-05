import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserFollow } from "@/hooks/use-user-follow";
import { data as dataGateway } from "@/lib/data/client";

// Mock the auth context
const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
  })),
}));

// Mock the data gateway follow APIs
jest.mock("@/lib/data/client", () => ({
  data: {
    users: {
      follow: {
        getStatusAndCounts: jest.fn(),
        toggle: jest.fn(),
      },
    },
  },
}));

// Mock Supabase client
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        maybeSingle: jest.fn(),
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(),
        })),
      })),
    })),
  })),
  channel: jest.fn(() => mockChannel),
  removeChannel: jest.fn(),
};

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe("useUserFollow", () => {
  const mockGetStatusAndCounts =
    (dataGateway.users.follow.getStatusAndCounts as unknown) as jest.Mock;
  const mockToggleFollowGateway =
    (dataGateway.users.follow.toggle as unknown) as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Initial state", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useUserFollow("user-2", 5, 10));

      expect(result.current.following).toBe(false);
      expect(result.current.followersCount).toBe(5);
      expect(result.current.followingCount).toBe(10);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isToggling).toBe(false);
    });

    it("should not load data for current user", () => {
      const { result } = renderHook(() => useUserFollow("user-1"));

      expect(result.current.following).toBe(false);
      expect(result.current.followersCount).toBe(0);
      expect(result.current.followingCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    it("should not load data for empty userId", () => {
      const { result } = renderHook(() => useUserFollow(""));

      expect(result.current.following).toBe(false);
      expect(result.current.followersCount).toBe(0);
      expect(result.current.followingCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Data fetching", () => {
    it("should fetch profile counts successfully", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 15,
        followingCount: 8,
        following: true,
      });

      const { result } = renderHook(() => useUserFollow("user-2"));

      await waitFor(() => {
        expect(result.current.followersCount).toBe(15);
        expect(result.current.followingCount).toBe(8);
        expect(result.current.following).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should handle profile fetch errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockGetStatusAndCounts.mockRejectedValue(new Error("Profile not found"));

      const { result } = renderHook(() => useUserFollow("user-2", 5, 10));

      await waitFor(() => {
        expect(result.current.followersCount).toBe(5); // Falls back to initial
        expect(result.current.followingCount).toBe(10);
        expect(result.current.following).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle no existing follow relationship", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 10,
        followingCount: 5,
        following: false,
      });

      const { result } = renderHook(() => useUserFollow("user-2"));

      await waitFor(() => {
        expect(result.current.following).toBe(false);
        expect(result.current.followersCount).toBe(10);
        expect(result.current.followingCount).toBe(5);
      });
    });
  });

  describe("toggleFollow functionality", () => {
    it("should toggle follow successfully", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 10,
        followingCount: 5,
        following: false,
      });
      mockToggleFollowGateway.mockResolvedValue({ success: true, data: { followId: "follow-1" } });

      const { result } = renderHook(() => useUserFollow("user-2", 10, 5));

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(mockToggleFollowGateway).toHaveBeenCalledWith("user-2");
      expect(result.current.following).toBe(true);
      expect(result.current.followersCount).toBe(11); // Optimistic update
      expect(result.current.isToggling).toBe(false);
    });

    it("should toggle unfollow successfully", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 10,
        followingCount: 5,
        following: true,
      });
      mockToggleFollowGateway.mockResolvedValue({ success: true, data: {} });

      const { result } = renderHook(() => useUserFollow("user-2", 10, 5));

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(result.current.following).toBe(false);
      expect(result.current.followersCount).toBe(9); // Optimistic update (10 - 1)
    });

    it("should handle toggle follow errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 0, followingCount: 0, following: false });
      mockToggleFollowGateway.mockResolvedValue({ success: false, error: "Failed to follow user" });

      const { result } = renderHook(() => useUserFollow("user-2"));

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to toggle follow:",
        "Failed to follow user"
      );

      consoleSpy.mockRestore();
    });

    it("should not toggle when user not authenticated", async () => {
      const { useAuth } = require("@/context/auth-context");
      useAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => useUserFollow("user-2"));

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(mockToggleFollowGateway).not.toHaveBeenCalled();

      // Reset mock
      useAuth.mockReturnValue({ user: mockUser });
    });

    it("should not toggle when already toggling", async () => {
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 0, followingCount: 0, following: false });
      mockToggleFollowGateway.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true, following: true }), 100)
          )
      );

      const { result } = renderHook(() => useUserFollow("user-2"));

      // Start first toggle
      act(() => {
        result.current.toggleFollow();
      });

      expect(result.current.isToggling).toBe(true);

      // Try to toggle again while first is in progress
      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(mockToggleFollowGateway).toHaveBeenCalledTimes(1);
    });

    it("should not toggle when userId matches current user", async () => {
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 0, followingCount: 0, following: false });
      const { result } = renderHook(() => useUserFollow("user-1")); // Same as mockUser.id

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(mockToggleFollowGateway).not.toHaveBeenCalled();
    });

    it("should handle network errors during toggle", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 0, followingCount: 0, following: false });
      mockToggleFollowGateway.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useUserFollow("user-2"));

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error toggling follow:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Real-time subscriptions", () => {
    it("should set up Supabase channel subscription", () => {
      renderHook(() => useUserFollow("user-2"));

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        "user_follows_user-2"
      );
      expect(mockChannel.on).toHaveBeenCalledTimes(2); // INSERT and DELETE events
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it("should clean up subscription on unmount", () => {
      const { unmount } = renderHook(() => useUserFollow("user-2"));

      unmount();

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(
        mockChannel
      );
    });

    it("should update state on INSERT event for current user", () => {
      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "INSERT") {
          // Simulate INSERT event for current user
          callback({ new: { follower_id: "user-1" } });
        }
        return mockChannel;
      });

      const { result } = renderHook(() => useUserFollow("user-2", 10, 5));

      // The callback should update following state for current user
      expect(result.current.followersCount).toBe(11); // Should increment
    });

    it("should update state on DELETE event for current user", () => {
      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "DELETE") {
          // Simulate DELETE event for current user
          callback({ old: { follower_id: "user-1" } });
        }
        return mockChannel;
      });

      const { result } = renderHook(() => useUserFollow("user-2", 10, 5));

      // The callback should update following state for current user
      expect(result.current.followersCount).toBe(9); // Should decrement
    });
  });

  describe("Stability and re-render behavior", () => {
    it("should fetch follow status only once and not on callback/initial changes", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 3,
        followingCount: 1,
        following: false,
      });

      const callbackA = jest.fn();
      const { rerender } = renderHook(
        ({ cb, initialFollowers, initialFollowing }) =>
          useUserFollow("user-2", initialFollowers, initialFollowing, cb),
        {
          initialProps: {
            cb: callbackA,
            initialFollowers: 3,
            initialFollowing: 1,
          },
        }
      );

      // Wait for initial fetch to resolve
      await waitFor(() => {
        expect(mockGetStatusAndCounts).toHaveBeenCalledTimes(1);
      });

      // Re-render with new callback identity and different initial counts
      // Effect should NOT re-run fetch due to stabilized deps
      const callbackB = jest.fn();
      rerender({ cb: callbackB, initialFollowers: 10, initialFollowing: 5 });

      // Give time for any unexpected effects
      await new Promise((r) => setTimeout(r, 10));

      expect(mockGetStatusAndCounts).toHaveBeenCalledTimes(1);
    });
  });

  describe("Callback functionality", () => {
    it("should call onFollowersCountChange when follower count changes", async () => {
      const mockCallback = jest.fn();
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 10, followingCount: 5, following: false });

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "INSERT") {
          // Simulate INSERT event
          callback({ new: { follower_id: "user-3" } });
        }
        return mockChannel;
      });

      const { result } = renderHook(() =>
        useUserFollow("user-2", 10, 5, mockCallback)
      );

      // Wait for real-time update
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(11); // Should call with new count
      });
    });

    it("should call onFollowersCountChange when follower count decreases", async () => {
      const mockCallback = jest.fn();
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 10, followingCount: 5, following: false });

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "DELETE") {
          // Simulate DELETE event
          callback({ old: { follower_id: "user-3" } });
        }
        return mockChannel;
      });

      const { result } = renderHook(() =>
        useUserFollow("user-2", 10, 5, mockCallback)
      );

      // Wait for real-time update
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(9); // Should call with new count
      });
    });

    it("should call onFollowersCountChange during optimistic updates", async () => {
      const mockCallback = jest.fn();
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 10, followingCount: 5, following: false });
      mockToggleFollowGateway.mockResolvedValue({ success: true, data: { followId: "follow-1" } });

      const { result } = renderHook(() =>
        useUserFollow("user-2", 10, 5, mockCallback)
      );

      await act(async () => {
        await result.current.toggleFollow();
      });

      expect(mockCallback).toHaveBeenCalledWith(11); // Should call with optimistic update
    });

    it("should not call callback when no callback provided", async () => {
      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 10, followingCount: 5, following: false });
      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "INSERT") {
          callback({ new: { follower_id: "user-3" } });
        }
        return mockChannel;
      });

      // Should not throw when no callback provided
      expect(() => {
        renderHook(() => useUserFollow("user-2", 10, 5));
      }).not.toThrow();
    });

    it("should handle callback errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });

      mockGetStatusAndCounts.mockResolvedValue({ followersCount: 10, followingCount: 5, following: false });
      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === "postgres_changes" && config.event === "INSERT") {
          callback({ new: { follower_id: "user-3" } });
        }
        return mockChannel;
      });

      const { result } = renderHook(() =>
        useUserFollow("user-2", 10, 5, mockCallback)
      );

      // Should handle callback error gracefully
      await waitFor(() => {
        expect(result.current.followersCount).toBe(11); // Should still update state
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle PGRST116 error (no rows returned) gracefully", async () => {
      mockGetStatusAndCounts.mockResolvedValue({
        followersCount: 10,
        followingCount: 5,
        following: false,
      });

      const { result } = renderHook(() => useUserFollow("user-2"));

      await waitFor(() => {
        expect(result.current.following).toBe(false);
        expect(result.current.followersCount).toBe(10);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should handle non-PGRST116 errors during follow check", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      mockGetStatusAndCounts.mockRejectedValue(new Error("Database connection failed"));

      const { result } = renderHook(() => useUserFollow("user-2", 5, 10));

      await waitFor(() => {
        expect(result.current.following).toBe(false);
        expect(result.current.followersCount).toBe(5); // Falls back to initial
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

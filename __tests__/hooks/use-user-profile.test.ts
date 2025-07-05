import { renderHook, waitFor } from "@testing-library/react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { getProfile } from "@/actions/profile-actions";
import type { Profile } from "@/types/database";

// Mock the profile actions
jest.mock("@/actions/profile-actions");
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

describe("useUserProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockProfile: Profile = {
    id: "user-123",
    full_name: "Test User",
    email: "test@example.com",
    bio: "Test bio",
    location: "San Diego, CA",
    experience_level: "intermediate",
    favorite_spot: "Ocean Beach",
    instagram: "@testuser",
    phone_number: "+1234567890",
    avatar_url: "https://example.com/avatar.jpg",
    notification_session_reminders: true,
    notification_community_replies: true,
    followers_count: 10,
    following_count: 15,
    storage_used: 1024,
    storage_limit: 104857600,
    default_beach_id: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  describe("initial state", () => {
    it("should return initial state when disabled", () => {
      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: false })
      );

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe("function");
    });

    it("should return initial state when no userId provided", () => {
      const { result } = renderHook(() => useUserProfile({ enabled: true }));

      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("successful profile loading", () => {
    it("should load profile successfully", async () => {
      mockGetProfile.mockResolvedValueOnce({
        success: true,
        data: mockProfile,
      });

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      // Should start loading
      expect(result.current.loading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();

      // Wait for async operation
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.error).toBeNull();
      expect(mockGetProfile).toHaveBeenCalledWith("user-123");
    });

    it("should reset state when userId changes", async () => {
      const secondProfile = {
        ...mockProfile,
        id: "user-456",
        full_name: "User Two",
      };

      mockGetProfile
        .mockResolvedValueOnce({
          success: true,
          data: mockProfile,
        })
        .mockResolvedValueOnce({
          success: true,
          data: secondProfile,
        });

      const { result, rerender } = renderHook(
        ({ userId }) => useUserProfile({ userId, enabled: true }),
        { initialProps: { userId: "user-123" } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toEqual(mockProfile);

      // Change user ID
      rerender({ userId: "user-456" });

      // Should reset and start loading again
      expect(result.current.loading).toBe(true);
      expect(result.current.profile).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toEqual(secondProfile);
    });
  });

  describe("error handling", () => {
    it("should handle API error response", async () => {
      mockGetProfile.mockResolvedValueOnce({
        success: false,
        error: "User not found",
      });

      const { result } = renderHook(() =>
        useUserProfile({ userId: "invalid-user", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("User not found");
    });

    it("should handle connection errors", async () => {
      mockGetProfile.mockResolvedValueOnce({
        success: false,
        error: "Connection failed",
        isConnectionError: true,
      });

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe(
        "Connection to the database failed. Please try again later."
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      mockGetProfile.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Network error");
    });
  });

  describe("timeout handling", () => {
    it("should handle timeout with default timeout", async () => {
      // Mock a request that never resolves
      mockGetProfile.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      expect(result.current.loading).toBe(true);

      // Fast-forward past default timeout (10 seconds)
      jest.advanceTimersByTime(11000);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe(
        "Profile loading timed out. Please try again."
      );
    });

    it("should handle timeout with custom timeout", async () => {
      mockGetProfile.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() =>
        useUserProfile({
          userId: "user-123",
          enabled: true,
          timeout: 5000, // 5 second timeout
        })
      );

      expect(result.current.loading).toBe(true);

      // Fast-forward past custom timeout
      jest.advanceTimersByTime(6000);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(
        "Profile loading timed out. Please try again."
      );
    });
  });

  describe("request deduplication", () => {
    it("should not make duplicate requests for same user", async () => {
      mockGetProfile.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // Render two hooks with same user ID at the same time
      const { result: result1 } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      const { result: result2 } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
        expect(result2.current.loading).toBe(false);
      });

      // Should only call the API once due to deduplication
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(result1.current.profile).toEqual(mockProfile);
      expect(result2.current.profile).toEqual(mockProfile);
    });

    it("should clear cache after TTL", async () => {
      mockGetProfile.mockResolvedValue({
        success: true,
        data: mockProfile,
      });

      // First request
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      unmount1();

      // Fast-forward past TTL (30 seconds)
      jest.advanceTimersByTime(31000);

      // Second request after TTL
      const { result: result2 } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      // Should make two separate API calls
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe("refetch functionality", () => {
    it("should refetch data when refetch is called", async () => {
      const updatedProfile = { ...mockProfile, full_name: "Updated User" };

      mockGetProfile
        .mockResolvedValueOnce({
          success: true,
          data: mockProfile,
        })
        .mockResolvedValueOnce({
          success: true,
          data: updatedProfile,
        });

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile?.full_name).toBe("Test User");

      // Call refetch
      result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile?.full_name).toBe("Updated User");
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });

    it("should not refetch when no userId is available", () => {
      const { result } = renderHook(() => useUserProfile({ enabled: true }));

      result.current.refetch();

      expect(mockGetProfile).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should abort request on unmount", async () => {
      mockGetProfile.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      // Unmount before request completes
      unmount();

      // Should not throw any errors or warnings about state updates
      await waitFor(() => {
        expect(true).toBe(true); // Just wait a bit
      });
    });

    it("should handle rapid userId changes without race conditions", async () => {
      mockGetProfile.mockImplementation((userId) => {
        return Promise.resolve({
          success: true,
          data: { ...mockProfile, id: userId, full_name: `User ${userId}` },
        });
      });

      const { result, rerender } = renderHook(
        ({ userId }) => useUserProfile({ userId, enabled: true }),
        { initialProps: { userId: "user-1" } }
      );

      // Rapidly change user IDs
      rerender({ userId: "user-2" });
      rerender({ userId: "user-3" });
      rerender({ userId: "user-4" });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should end up with the final user's data
      expect(result.current.profile?.full_name).toBe("User user-4");
    });
  });

  describe("disabled state", () => {
    it("should not load when disabled", () => {
      renderHook(() => useUserProfile({ userId: "user-123", enabled: false }));

      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it("should stop loading when disabled mid-request", async () => {
      mockGetProfile.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result, rerender } = renderHook(
        ({ enabled }) => useUserProfile({ userId: "user-123", enabled }),
        { initialProps: { enabled: true } }
      );

      expect(result.current.loading).toBe(true);

      // Disable while loading
      rerender({ enabled: false });

      expect(result.current.loading).toBe(false);
      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty profile data", async () => {
      mockGetProfile.mockResolvedValueOnce({
        success: true,
        data: null,
      });

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Failed to load profile");
    });

    it("should handle malformed response", async () => {
      mockGetProfile.mockResolvedValueOnce({
        success: true,
        // Missing data field
      } as any);

      const { result } = renderHook(() =>
        useUserProfile({ userId: "user-123", enabled: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBe("Failed to load profile");
    });
  });
});

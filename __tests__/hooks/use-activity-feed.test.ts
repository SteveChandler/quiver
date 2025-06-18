import { renderHook, act, waitFor } from "@testing-library/react";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import * as activityActions from "@/actions/activity-actions";

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

// Mock the activity actions
jest.mock("@/actions/activity-actions", () => ({
  getUserActivityFeed: jest.fn(),
  getGlobalActivityFeed: jest.fn(),
}));

// Mock the data fetcher hook
const mockDataFetcher = {
  data: null,
  loading: false,
  error: null,
  refetch: jest.fn(),
};

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(() => mockDataFetcher),
}));

const mockActivities = [
  {
    id: "activity-1",
    user_id: "user-1",
    activity_type: "session_logged",
    entity_type: "session",
    entity_id: "session-1",
    metadata: { beach_name: "Malibu Beach" },
    created_at: "2024-01-16T10:00:00Z",
    user_name: "John Doe",
    user_avatar: "https://example.com/avatar.jpg",
  },
  {
    id: "activity-2",
    user_id: "user-2",
    activity_type: "beach_reviewed",
    entity_type: "beach_review",
    entity_id: "review-1",
    metadata: { beach_id: "beach-1", overall_rating: 5 },
    created_at: "2024-01-16T09:00:00Z",
    user_name: "Jane Smith",
    user_avatar: "https://example.com/avatar2.jpg",
  },
];

describe("useActivityFeed", () => {
  const getUserActivityFeedMock =
    activityActions.getUserActivityFeed as jest.MockedFunction<
      typeof activityActions.getUserActivityFeed
    >;
  const getGlobalActivityFeedMock =
    activityActions.getGlobalActivityFeed as jest.MockedFunction<
      typeof activityActions.getGlobalActivityFeed
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Initial state", () => {
    it("should initialize with empty state", () => {
      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.activities).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
    });

    it("should use provided options", () => {
      const { result } = renderHook(() =>
        useActivityFeed({
          userId: "user-2",
          limit: 15,
          autoRefresh: true,
          refreshInterval: 60000,
        })
      );

      expect(result.current.activities).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  describe("Data loading", () => {
    it("should load user activity feed when userId provided", () => {
      const { useDataFetcher } = require("@/hooks/use-data-fetcher");

      useDataFetcher.mockReturnValue({
        data: { success: true, data: mockActivities },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() =>
        useActivityFeed({ userId: "user-1" })
      );

      expect(result.current.activities).toEqual(mockActivities);
      expect(result.current.hasMore).toBe(false); // Since data length (2) < limit (20)
    });

    it("should handle loading state", () => {
      const { useDataFetcher } = require("@/hooks/use-data-fetcher");

      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.loading).toBe(true);
      expect(result.current.activities).toEqual([]);
    });

    it("should handle error state", () => {
      const { useDataFetcher } = require("@/hooks/use-data-fetcher");

      useDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: "Failed to load activities",
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => useActivityFeed());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Failed to load activities");
      expect(result.current.activities).toEqual([]);
    });
  });

  describe("Refresh functionality", () => {
    it("should refresh data successfully", async () => {
      const { useDataFetcher } = require("@/hooks/use-data-fetcher");
      const mockRefetch = jest.fn();

      useDataFetcher.mockReturnValue({
        data: { success: true, data: mockActivities },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useActivityFeed());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});

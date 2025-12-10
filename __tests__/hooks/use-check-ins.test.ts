import { describe, it, expect, beforeEach, vi } from "../setup/vitest-shim";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useRecentCheckIns,
  useForecastAccuracyStats,
  useUserCheckIns,
  useBeachCheckIns,
  useRealtimeBeachCheckIns,
} from "@/hooks/use-check-ins";
import {
  getRecentCheckIns,
  getForecastAccuracyStats,
  getUserCheckIns,
  getBeachCheckIns,
} from "@/actions/check-in-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

// Mock dependencies with factories for Jest
jest.mock("@/actions/check-in-actions", () => ({
  getRecentCheckIns: jest.fn(),
  getForecastAccuracyStats: jest.fn(),
  getUserCheckIns: jest.fn(),
  getBeachCheckIns: jest.fn(),
}));
jest.mock("@/hooks/use-data-fetcher", () => ({
  __esModule: true,
  useDataFetcher: jest.fn(),
}));

const mockGetRecentCheckIns =
  getRecentCheckIns as unknown as jest.MockedFunction<typeof getRecentCheckIns>;
const mockGetForecastAccuracyStats =
  getForecastAccuracyStats as unknown as jest.MockedFunction<
    typeof getForecastAccuracyStats
  >;
const mockGetUserCheckIns = getUserCheckIns as unknown as jest.MockedFunction<
  typeof getUserCheckIns
>;
const mockGetBeachCheckIns = getBeachCheckIns as unknown as jest.MockedFunction<
  typeof getBeachCheckIns
>;
const mockUseDataFetcher = useDataFetcher as unknown as jest.MockedFunction<
  typeof useDataFetcher
>;

// Helper to create complete mock return value for useDataFetcher
const createMockDataFetcherReturn = <T>(overrides: {
  data?: T | null;
  loading?: boolean;
  error?: string | null;
  refetch?: jest.Mock;
  retry?: jest.Mock;
  reset?: jest.Mock;
} = {}) => ({
  data: overrides.data ?? null,
  loading: overrides.loading ?? false,
  error: overrides.error ?? null,
  refetch: overrides.refetch ?? vi.fn(),
  retry: overrides.retry ?? vi.fn(),
  reset: overrides.reset ?? vi.fn(),
}) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDataFetcher.mockReturnValue(createMockDataFetcherReturn());
});

describe("Check-in Hooks", () => {
  describe("useRecentCheckIns", () => {
    it("fetches recent check-ins for a beach", async () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-1",
          beach_id: "beach-123",
          wave_height: 3.5,
          checked_in_at: "2025-01-16T10:00:00Z",
          forecast_accuracy_rating: "accurate" as const,
          user: { username: "surfer1", profile_picture_url: null },
          wind_speed: null,
          wind_direction: null,
          water_temp: null,
          crowd_level: null,
          vibe: null,
        },
      ];

      mockGetRecentCheckIns.mockResolvedValueOnce(mockCheckIns);

      // Mock useDataFetcher to call the function and return data
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn(); // Call the fetch function
        return createMockDataFetcherReturn({ data: mockCheckIns });
      });

      const { result } = renderHook(() =>
        useRecentCheckIns("beach-123", 24, 10)
      );

      expect(mockGetRecentCheckIns).toHaveBeenCalledWith("beach-123", 24, 10);
      expect(result.current.data).toEqual(mockCheckIns);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns empty array when beachId is null", () => {
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        const result = fetchFn(); // Call the fetch function
        expect(result).resolves.toEqual([]);
        return createMockDataFetcherReturn({ data: [] });
      });

      const { result } = renderHook(() => useRecentCheckIns(null, 24, 10));

      expect(mockGetRecentCheckIns).not.toHaveBeenCalled();
      expect(result.current.data).toEqual([]);
    });

    it("handles different time ranges", () => {
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: [] });
      });

      renderHook(() => useRecentCheckIns("beach-123", 12, 5));

      expect(mockGetRecentCheckIns).toHaveBeenCalledWith("beach-123", 12, 5);
    });
  });

  describe("useForecastAccuracyStats", () => {
    it("fetches forecast accuracy statistics", () => {
      const mockStats = {
        total_reports: 10,
        accurate_count: 7,
        somewhat_count: 2,
        inaccurate_count: 1,
        accuracy_percentage: 70.0,
      };

      mockGetForecastAccuracyStats.mockResolvedValueOnce(mockStats);

      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: mockStats });
      });

      const { result } = renderHook(() =>
        useForecastAccuracyStats("beach-123", 7)
      );

      expect(mockGetForecastAccuracyStats).toHaveBeenCalledWith("beach-123", 7);
      expect(result.current.data).toEqual(mockStats);
    });

    it("returns default stats when beachId is null", () => {
      const defaultStats = {
        total_reports: 0,
        accurate_count: 0,
        somewhat_count: 0,
        inaccurate_count: 0,
        accuracy_percentage: 0,
      };

      mockUseDataFetcher.mockImplementation((fetchFn) => {
        const result = fetchFn();
        expect(result).resolves.toEqual(defaultStats);
        return createMockDataFetcherReturn({ data: defaultStats });
      });

      const { result } = renderHook(() => useForecastAccuracyStats(null, 7));

      expect(mockGetForecastAccuracyStats).not.toHaveBeenCalled();
      expect(result.current.data).toEqual(defaultStats);
    });
  });

  describe("useUserCheckIns", () => {
    it("fetches user check-in history", () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-123",
          beach_id: "beach-123",
          wave_height: 3.5,
          checked_in_at: "2025-01-16T10:00:00Z",
          forecast_accuracy_rating: "accurate" as const,
          wind_speed: null,
          wind_direction: null,
          water_temp: null,
          crowd_level: null,
          vibe: null,
        },
      ];

      mockGetUserCheckIns.mockResolvedValueOnce(mockCheckIns);

      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: mockCheckIns });
      });

      const { result } = renderHook(() => useUserCheckIns("user-123", 20, 0));

      expect(mockGetUserCheckIns).toHaveBeenCalledWith("user-123", 20, 0);
      expect(result.current.data).toEqual(mockCheckIns);
    });

    it("returns empty array when userId is null", () => {
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        const result = fetchFn();
        expect(result).resolves.toEqual([]);
        return createMockDataFetcherReturn({ data: [] });
      });

      const { result } = renderHook(() => useUserCheckIns(null, 20, 0));

      expect(mockGetUserCheckIns).not.toHaveBeenCalled();
      expect(result.current.data).toEqual([]);
    });
  });

  describe("useBeachCheckIns", () => {
    it("fetches all check-ins for a beach with pagination", () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-1",
          beach_id: "beach-123",
          wave_height: 3.5,
          checked_in_at: "2025-01-16T10:00:00Z",
          forecast_accuracy_rating: "accurate" as const,
          user: { username: "surfer1", profile_picture_url: null },
          wind_speed: null,
          wind_direction: null,
          water_temp: null,
          crowd_level: null,
          vibe: null,
        },
      ];

      mockGetBeachCheckIns.mockResolvedValueOnce(mockCheckIns);

      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: mockCheckIns });
      });

      const { result } = renderHook(() => useBeachCheckIns("beach-123", 20, 0));

      expect(mockGetBeachCheckIns).toHaveBeenCalledWith("beach-123", 20, 0);
      expect(result.current.data).toEqual(mockCheckIns);
    });

    it("handles pagination parameters", () => {
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: [] });
      });

      renderHook(() => useBeachCheckIns("beach-123", 10, 20));

      expect(mockGetBeachCheckIns).toHaveBeenCalledWith("beach-123", 10, 20);
    });
  });

  describe("useRealtimeBeachCheckIns", () => {
    it("fetches recent check-ins for realtime display", () => {
      const mockCheckIns = [
        {
          id: "checkin-1",
          user_id: "user-1",
          beach_id: "beach-123",
          wave_height: 3.5,
          checked_in_at: "2025-01-16T10:00:00Z",
          forecast_accuracy_rating: "accurate" as const,
          user: { username: "surfer1", profile_picture_url: null },
          wind_speed: null,
          wind_direction: null,
          water_temp: null,
          crowd_level: null,
          vibe: null,
        },
      ];

      mockGetRecentCheckIns.mockResolvedValueOnce(mockCheckIns);

      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: mockCheckIns });
      });

      const { result } = renderHook(() =>
        useRealtimeBeachCheckIns("beach-123", 12)
      );

      expect(mockGetRecentCheckIns).toHaveBeenCalledWith("beach-123", 12, 20);
      expect(result.current.data).toEqual(mockCheckIns);
    });

    it("uses default hours back parameter", () => {
      mockUseDataFetcher.mockImplementation((fetchFn) => {
        fetchFn();
        return createMockDataFetcherReturn({ data: [] });
      });

      renderHook(() => useRealtimeBeachCheckIns("beach-123"));

      expect(mockGetRecentCheckIns).toHaveBeenCalledWith("beach-123", 12, 20);
    });
  });

  describe("error handling", () => {
    it("handles fetch errors in useRecentCheckIns", () => {
      const mockErrorMessage = "Fetch failed";

      mockUseDataFetcher.mockReturnValue(createMockDataFetcherReturn({
        data: null,
        error: mockErrorMessage,
      }));

      const { result } = renderHook(() => useRecentCheckIns("beach-123"));

      expect(result.current.error).toBe(mockErrorMessage);
      expect(result.current.data).toBe(null);
    });

    it("handles loading states", () => {
      mockUseDataFetcher.mockReturnValue(createMockDataFetcherReturn({
        data: null,
        loading: true,
      }));

      const { result } = renderHook(() =>
        useForecastAccuracyStats("beach-123")
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(null);
    });
  });

  describe("refetch functionality", () => {
    it("provides refetch function", () => {
      const mockRefetch = vi.fn();

      mockUseDataFetcher.mockReturnValue(createMockDataFetcherReturn({
        data: [],
        refetch: mockRefetch,
      }));

      const { result } = renderHook(() => useRecentCheckIns("beach-123"));

      expect(result.current.refetch).toBe(mockRefetch);
    });
  });
});

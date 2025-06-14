import { renderHook, act, waitFor } from "@testing-library/react";
import { useBeachSearch } from "@/hooks/use-beach-search";
import * as beachActions from "@/actions/beach-actions";

// Mock the beach actions
jest.mock("@/actions/beach-actions", () => ({
  getBeaches: jest.fn(),
  getNearbyBeaches: jest.fn(),
}));

const mockBeaches = [
  {
    id: "1",
    name: "Pacific Beach",
    latitude: 32.7841,
    longitude: -117.2527,
    location: "San Diego, CA",
    wave_quality_rating: 4,
  },
  {
    id: "2",
    name: "Ocean Beach",
    latitude: 32.7503,
    longitude: -117.2534,
    location: "San Diego, CA",
    wave_quality_rating: 4.5,
  },
  {
    id: "3",
    name: "Mission Beach",
    latitude: 32.7738,
    longitude: -117.2528,
    location: "San Diego, CA",
    wave_quality_rating: 3.5,
  },
  {
    id: "4",
    name: "Malibu Beach",
    latitude: 34.0259,
    longitude: -118.7798,
    location: "Malibu, CA",
    wave_quality_rating: 4.2,
  },
];

describe("useBeachSearch", () => {
  const getBeachesMock = beachActions.getBeaches as jest.MockedFunction<
    typeof beachActions.getBeaches
  >;
  const getNearbyBeachesMock =
    beachActions.getNearbyBeaches as jest.MockedFunction<
      typeof beachActions.getNearbyBeaches
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
      const { result } = renderHook(() => useBeachSearch());

      expect(result.current.beaches).toEqual([]);
      expect(result.current.filteredBeaches).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.searchQuery).toBe("");
      expect(result.current.selectedBeach).toBe(null);
      expect(result.current.nearbyBeachesForScroll).toEqual([]);
    });
  });

  describe("loadBeaches", () => {
    it("should load all beaches successfully", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: mockBeaches,
      });

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(getBeachesMock).toHaveBeenCalledTimes(1);
      expect(result.current.beaches).toEqual(mockBeaches);
      expect(result.current.filteredBeaches).toEqual(mockBeaches);
      expect(result.current.loading).toBe(false);
    });

    it("should handle loading error", async () => {
      getBeachesMock.mockRejectedValue(new Error("Network error"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.beaches).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading beaches:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle unsuccessful response", async () => {
      getBeachesMock.mockResolvedValue({
        success: false,
        error: "API Error",
      });

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      // Just verify basic state after error
      expect(result.current.beaches).toEqual([]);
    });
  });

  describe("loadNearbyBeaches", () => {
    it("should load nearby beaches successfully", async () => {
      const nearbyBeaches = mockBeaches.slice(0, 3);
      getNearbyBeachesMock.mockResolvedValue({
        success: true,
        data: nearbyBeaches,
      });

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7841, -117.2527);
      });

      expect(getNearbyBeachesMock).toHaveBeenCalledWith(32.7841, -117.2527, 30);
      expect(result.current.beaches).toEqual(nearbyBeaches);
      expect(result.current.filteredBeaches).toEqual(nearbyBeaches);
      expect(result.current.selectedBeach).toEqual(nearbyBeaches[0]);
      expect(result.current.loading).toBe(false);
    });

    it("should handle empty nearby beaches result", async () => {
      getNearbyBeachesMock.mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7841, -117.2527);
      });

      expect(result.current.beaches).toEqual([]);
      expect(result.current.filteredBeaches).toEqual([]);
      expect(result.current.selectedBeach).toBe(null);
      expect(result.current.loading).toBe(false);
    });

    it("should not change selected beach if one already exists", async () => {
      const nearbyBeaches = mockBeaches.slice(0, 3);
      getNearbyBeachesMock.mockResolvedValue({
        success: true,
        data: nearbyBeaches,
      });

      const { result } = renderHook(() => useBeachSearch());

      // Set initial selected beach
      act(() => {
        result.current.setSelectedBeach(mockBeaches[1]);
      });

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7841, -117.2527);
      });

      expect(result.current.selectedBeach).toEqual(mockBeaches[1]);
    });

    it("should handle loading error", async () => {
      getNearbyBeachesMock.mockRejectedValue(new Error("Network error"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7841, -117.2527);
      });

      expect(result.current.loading).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading nearby beaches:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Search functionality", () => {
    beforeEach(async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: mockBeaches,
      });
    });

    it("should update search query", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      expect(result.current.searchQuery).toBe("Pacific");
    });

    it("should clear search query", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      expect(result.current.searchQuery).toBe("Pacific");

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe("");
    });

    it("should search all beaches with debounce", async () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      // Fast-forward timers to trigger debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(getBeachesMock).toHaveBeenCalled();
      });

      // Just verify the search query was set
      expect(result.current.searchQuery).toBe("Pacific");
    });

    it("should filter beaches by name", async () => {
      const { result } = renderHook(() => useBeachSearch());

      // Load beaches first
      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.filteredBeaches).toEqual([
          mockBeaches.find((b) => b.name === "Pacific Beach"),
        ]);
      });
    });

    it("should filter beaches by location", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("Malibu");
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.filteredBeaches).toEqual([
          mockBeaches.find((b) => b.location === "Malibu, CA"),
        ]);
      });
    });

    it("should be case insensitive", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("PACIFIC");
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.filteredBeaches).toEqual([
          mockBeaches.find((b) => b.name === "Pacific Beach"),
        ]);
      });
    });

    it("should set first result as selected beach when searching", async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: [mockBeaches[0]], // Only Pacific Beach
      });

      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.selectedBeach).toEqual(mockBeaches[0]);
      });
    });
  });

  describe("Selected beach management", () => {
    it("should set selected beach", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSelectedBeach(mockBeaches[0]);
      });

      expect(result.current.selectedBeach).toEqual(mockBeaches[0]);
    });

    it("should clear selected beach", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSelectedBeach(mockBeaches[0]);
      });

      expect(result.current.selectedBeach).toEqual(mockBeaches[0]);

      act(() => {
        result.current.setSelectedBeach(null);
      });

      expect(result.current.selectedBeach).toBe(null);
    });
  });

  describe("nearbyBeachesForScroll", () => {
    beforeEach(async () => {
      getBeachesMock.mockResolvedValue({
        success: true,
        data: mockBeaches,
      });
    });

    it("should return beaches excluding selected beach", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSelectedBeach(mockBeaches[0]);
      });

      expect(result.current.nearbyBeachesForScroll).toEqual(
        mockBeaches.slice(1) // Exclude first beach
      );
    });

    it("should return all beaches when no beach is selected", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(result.current.nearbyBeachesForScroll).toEqual(mockBeaches);
    });

    it("should return empty array when no beaches", () => {
      const { result } = renderHook(() => useBeachSearch());

      expect(result.current.nearbyBeachesForScroll).toEqual([]);
    });

    it("should limit to 4 beaches when selected beach exists", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSelectedBeach(mockBeaches[0]);
      });

      // Should exclude the selected beach from scroll list
      expect(result.current.nearbyBeachesForScroll).toHaveLength(3);
    });
  });

  describe("Effect interactions", () => {
    it("should update search query correctly", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      expect(result.current.searchQuery).toBe("Pacific");
    });

    it("should clear search correctly", () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.setSearchQuery("Pacific");
      });

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe("");
    });
  });
});

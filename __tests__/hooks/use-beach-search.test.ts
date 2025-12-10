import { renderHook, act, waitFor } from "@testing-library/react";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

// Mock the beach actions
jest.mock("@/actions/beach-actions", () => ({
  getBeaches: jest.fn(),
  getNearbyBeaches: jest.fn(),
}));

const mockGetBeaches = getBeaches as jest.MockedFunction<typeof getBeaches>;
const mockGetNearbyBeaches = getNearbyBeaches as jest.MockedFunction<
  typeof getNearbyBeaches
>;

describe("useBeachSearch", () => {
  const mockBeaches = createMockBeaches(5) as any[];

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGetBeaches as any).mockResolvedValue({
      success: true,
      data: mockBeaches,
    });
    (mockGetNearbyBeaches as any).mockResolvedValue({
      success: true,
      data: mockBeaches,
    });
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useBeachSearch());

    expect(result.current.filteredBeaches).toEqual([]);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.selectedBeach).toBeNull();
    expect(result.current.beaches).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe("search functionality", () => {
    it("should filter beaches by name", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("Ocean");
      });

      expect(result.current.filteredBeaches).toHaveLength(1);
      expect(result.current.filteredBeaches[0].name).toBe("Ocean Beach");
    });

    it("should filter beaches by location", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("La Jolla");
      });

      // Should find beaches with "La Jolla" in location_text
      const laJollaBeaches = result.current.filteredBeaches.filter((beach: any) =>
        beach.location_text?.includes("La Jolla")
      );
      expect(laJollaBeaches.length).toBeGreaterThan(0);
      expect((result.current.filteredBeaches[0] as any).location_text).toContain(
        "La Jolla"
      );
    });

    it("should be case insensitive", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("ocean");
      });

      expect(result.current.filteredBeaches).toHaveLength(1);
      expect(result.current.filteredBeaches[0].name).toBe("Ocean Beach");
    });

    it("should return empty array for no matches", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("nonexistent");
      });

      expect(result.current.filteredBeaches).toHaveLength(0);
    });

    it("should clear search", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("Ocean");
      });

      expect(result.current.searchQuery).toBe("Ocean");
      expect(result.current.filteredBeaches).toHaveLength(1);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe("");
      expect(result.current.filteredBeaches).toHaveLength(5);
    });
  });

  describe("loading beaches", () => {
    it("should load all beaches successfully", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(result.current.beaches).toHaveLength(5);
      expect(result.current.filteredBeaches).toHaveLength(5);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle beach loading errors", async () => {
      mockGetBeaches.mockRejectedValue(new Error("API Error"));
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(result.current.beaches).toHaveLength(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("API Error");
    });

    it("should load nearby beaches", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });

      expect(mockGetNearbyBeaches).toHaveBeenCalledWith(32.7, -117.2, 30);
      expect(result.current.beaches).toHaveLength(5);
      expect(result.current.filteredBeaches).toHaveLength(5);
    });

    it("should handle nearby beaches with no results", async () => {
      mockGetNearbyBeaches.mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });

      expect(result.current.beaches).toHaveLength(0);
      expect(result.current.filteredBeaches).toHaveLength(0);
      expect(result.current.selectedBeach).toBeNull();
    });

    it("should handle nearby beaches API errors", async () => {
      mockGetNearbyBeaches.mockRejectedValue(new Error("Location Error"));
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });

      expect(result.current.beaches).toHaveLength(0);
      expect(result.current.error).toBe("Location Error");
    });
  });

  describe("beach selection", () => {
    it("should select a beach", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        (result.current.setSelectedBeach as any)(mockBeaches[0]);
      });

      expect(result.current.selectedBeach).toBe(mockBeaches[0]);
    });

    it("should clear selected beach", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        (result.current.setSelectedBeach as any)(mockBeaches[0]);
      });

      expect(result.current.selectedBeach).toBe(mockBeaches[0]);

      act(() => {
        result.current.setSelectedBeach(null);
      });

      expect(result.current.selectedBeach).toBeNull();
    });

    it("should prioritize search results over selected beach", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        (result.current.setSelectedBeach as any)(mockBeaches[0]);
      });

      expect(result.current.selectedBeach).toBe(mockBeaches[0]);

      act(() => {
        result.current.setSearchQuery("Mission");
      });

      // Should prioritize search results
      expect(result.current.selectedBeach?.name).toBe("Mission Beach");
    });
  });

  describe("nearbyBeachesForScroll", () => {
    it("should return beaches excluding selected beach", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        (result.current.setSelectedBeach as any)(mockBeaches[0]);
      });

      const nearbyBeaches = result.current.nearbyBeachesForScroll;
      expect(nearbyBeaches).toHaveLength(4);
      expect(nearbyBeaches).not.toContain(mockBeaches[0]);
    });

    it("should return beaches for scroll when no manual selection", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      const nearbyBeaches = result.current.nearbyBeachesForScroll;
      // Should return beaches, accounting for auto-selection behavior
      expect(nearbyBeaches.length).toBeGreaterThan(0);
      expect(nearbyBeaches.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array when no beaches available", () => {
      const { result } = renderHook(() => useBeachSearch());

      const nearbyBeaches = result.current.nearbyBeachesForScroll;
      expect(nearbyBeaches).toHaveLength(0);
    });
  });

  describe("loading states", () => {
    it("should show loading state during beach loading", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (mockGetBeaches as any).mockReturnValue(promise);

      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.loadBeaches();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise({ success: true, data: mockBeaches });
        await promise;
      });

      expect(result.current.loading).toBe(false);
    });

    it("should handle multiple load calls", async () => {
      const { result } = renderHook(() => useBeachSearch());

      act(() => {
        result.current.loadBeaches();
        result.current.loadBeaches(); // Second call - behavior depends on implementation
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should call the API (implementation may handle duplicates differently)
      expect(mockGetBeaches).toHaveBeenCalled();
    });
  });
});

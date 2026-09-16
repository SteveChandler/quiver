import { renderHook, act, waitFor } from "@testing-library/react";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { getBeaches, getNearbyBeaches } from "@/lib/map-beach-client";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

// Mock the beach actions
jest.mock("@/lib/map-beach-client", () => ({
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

    it("preserves nearby results when all-beaches loading fails", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });

      expect(result.current.beaches).toHaveLength(5);

      mockGetBeaches.mockRejectedValue(new Error("API Error"));

      await act(async () => {
        await result.current.loadBeaches();
      });

      expect(result.current.beaches).toHaveLength(5);
      expect(result.current.filteredBeaches).toHaveLength(5);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("API Error");
    });

    it("should load nearby beaches", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });

      expect(mockGetNearbyBeaches).toHaveBeenCalledWith(
        32.7,
        -117.2,
        30,
        expect.any(AbortSignal),
      );
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

    it("restores the previous beach presentation when the latest request fails", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });
      const previousPresentation = result.current.filteredBeaches;
      mockGetNearbyBeaches.mockRejectedValueOnce(new Error("Hawaii unavailable"));

      await act(async () => {
        await result.current.loadNearbyBeaches(21.66, -158.06);
      });

      expect(result.current.filteredBeaches).toEqual(previousPresentation);
      expect(result.current.error).toBe("Hawaii unavailable");
    });

    it("preserves a newer search presentation when a nearby request fails", async () => {
      const { result } = renderHook(() => useBeachSearch());
      await act(async () => {
        await result.current.loadNearbyBeaches(32.7, -117.2);
      });
      let rejectHawaii!: (reason: Error) => void;
      mockGetNearbyBeaches.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectHawaii = reject;
        }) as ReturnType<typeof getNearbyBeaches>,
      );

      let hawaiiRequest!: Promise<void>;
      act(() => {
        hawaiiRequest = result.current.loadNearbyBeaches(21.66, -158.06);
      });
      act(() => {
        result.current.setSearchQuery("Ocean");
      });
      await waitFor(() => {
        expect(result.current.filteredBeaches).toHaveLength(1);
      });

      await act(async () => {
        rejectHawaii(new Error("Hawaii unavailable"));
        await hawaiiRequest;
      });

      expect(result.current.filteredBeaches).toHaveLength(1);
      expect(result.current.filteredBeaches[0]?.name).toBe("Ocean Beach");
    });

    it("keeps the latest nearby request when an older request resolves last", async () => {
      const sanDiegoBeaches = createMockBeaches(2) as any[];
      const hawaiiBeaches = createMockBeaches(3).map((beach, index) => ({
        ...beach,
        id: `hawaii-${index}`,
        name: `Hawaii Beach ${index}`,
      })) as any[];
      type NearbyResult = Awaited<ReturnType<typeof getNearbyBeaches>>;
      let resolveSanDiego!: (value: NearbyResult) => void;
      let resolveHawaii!: (value: NearbyResult) => void;
      mockGetNearbyBeaches
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSanDiego = resolve;
          }) as ReturnType<typeof getNearbyBeaches>,
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveHawaii = resolve;
          }) as ReturnType<typeof getNearbyBeaches>,
        );
      const { result } = renderHook(() => useBeachSearch());

      let sanDiegoRequest!: Promise<void>;
      let hawaiiRequest!: Promise<void>;
      act(() => {
        sanDiegoRequest = result.current.loadNearbyBeaches(32.7, -117.2);
        hawaiiRequest = result.current.loadNearbyBeaches(21.66, -158.06);
      });
      expect(mockGetNearbyBeaches.mock.calls[0]?.[3]?.aborted).toBe(true);
      expect(mockGetNearbyBeaches.mock.calls[1]?.[3]?.aborted).toBe(false);

      await act(async () => {
        resolveHawaii({
          success: true,
          data: hawaiiBeaches,
          fallbackUsed: false,
        });
        await hawaiiRequest;
      });
      expect(result.current.beaches).toEqual(hawaiiBeaches);

      await act(async () => {
        resolveSanDiego({
          success: true,
          data: sanDiegoBeaches,
          fallbackUsed: false,
        });
        await sanDiegoRequest;
      });
      expect(result.current.beaches).toEqual(hawaiiBeaches);
      expect(mockGetNearbyBeaches).toHaveBeenCalledTimes(2);
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

  it("keeps visible beaches while a background pan request is pending", async () => {
    const { result } = renderHook(() => useBeachSearch());
    await act(async () => { await result.current.loadNearbyBeaches(32.75, -117.25); });
    const visible = result.current.filteredBeaches;
    let resolveNearby!: (value: any) => void;
    mockGetNearbyBeaches.mockImplementationOnce(() => new Promise((resolve) => { resolveNearby = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.loadNearbyBeaches(32.76, -117.25, { background: true }); });
    expect(result.current.filteredBeaches).toBe(visible);
    await act(async () => { resolveNearby({ success: true, data: mockBeaches.slice(1) }); await pending; });
    expect(result.current.filteredBeaches).toEqual(mockBeaches.slice(1));
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

  describe("break type filters", () => {
    // Dedicated fixtures with diverse break_type/skill_level for filter coverage
    const filterBeaches = [
      { id: "f-1", name: "Sandy Shore", lat: 32.75, lon: -117.25, break_type: "beach", skill_level: "beginner" },
      { id: "f-2", name: "Reef Ledge", lat: 32.76, lon: -117.26, break_type: "reef", skill_level: "advanced" },
      { id: "f-3", name: "Point Break Cove", lat: 32.77, lon: -117.27, break_type: "point", skill_level: "intermediate" },
      { id: "f-4", name: "Beach Reef Combo", lat: 32.78, lon: -117.28, break_type: "beach/reef break", skill_level: "intermediate-advanced" },
      { id: "f-5", name: "Mellow Point", lat: 32.79, lon: -117.29, break_type: "point", skill_level: "beginner-intermediate" },
      { id: "f-6", name: "Mystery Spot", lat: 32.80, lon: -117.30, break_type: null, skill_level: "beginner" },
      { id: "f-7", name: "Jetty Break", lat: 32.81, lon: -117.31, break_type: "jetty", skill_level: "lower-intermediate" },
    ] as any[];

    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: filterBeaches,
      });
    });

    it("should filter by 'beach' break type", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("beach");
      });

      // "Sandy Shore" (beach), "Beach Reef Combo" (beach/reef break)
      expect(result.current.filteredBeaches).toHaveLength(2);
      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).toContain("Sandy Shore");
      expect(names).toContain("Beach Reef Combo");
    });

    it("should filter by 'reef' break type", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("reef");
      });

      // "Reef Ledge" (reef), "Beach Reef Combo" (beach/reef break)
      expect(result.current.filteredBeaches).toHaveLength(2);
      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).toContain("Reef Ledge");
      expect(names).toContain("Beach Reef Combo");
    });

    it("should filter by 'point' break type", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("point");
      });

      // "Point Break Cove" (point, intermediate), "Mellow Point" (point, beginner-intermediate)
      expect(result.current.filteredBeaches).toHaveLength(2);
      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).toContain("Point Break Cove");
      expect(names).toContain("Mellow Point");
    });

    it("should exclude beaches with null break_type from filtered results", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("beach");
      });

      const ids = result.current.filteredBeaches.map((b: any) => b.id);
      expect(ids).not.toContain("f-6"); // Mystery Spot has null break_type
    });

    it("should match multiple break types with OR logic", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("reef");
      });
      act(() => {
        result.current.toggleBreakType("point");
      });

      // reef: "Reef Ledge", "Beach Reef Combo"; point: "Point Break Cove", "Mellow Point"
      expect(result.current.filteredBeaches).toHaveLength(4);
    });

    it("should toggle break type off when clicked again", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("reef");
      });
      expect(result.current.filteredBeaches).toHaveLength(2);

      act(() => {
        result.current.toggleBreakType("reef");
      });
      // All beaches should be shown again (no active filter)
      expect(result.current.filteredBeaches).toHaveLength(7);
    });
  });

  describe("longboard filter heuristic", () => {
    const longboardBeaches = [
      { id: "lb-1", name: "Mellow Beach", lat: 32.75, lon: -117.25, break_type: "beach", skill_level: "beginner" },
      { id: "lb-2", name: "Chill Point", lat: 32.76, lon: -117.26, break_type: "point", skill_level: "beginner-intermediate" },
      { id: "lb-3", name: "Intermediate Beach", lat: 32.77, lon: -117.27, break_type: "beach", skill_level: "intermediate" },
      { id: "lb-4", name: "Lower-Int Point", lat: 32.78, lon: -117.28, break_type: "point", skill_level: "lower-intermediate" },
      { id: "lb-5", name: "Advanced Reef", lat: 32.79, lon: -117.29, break_type: "reef", skill_level: "advanced" },
      { id: "lb-6", name: "Int-Advanced Beach", lat: 32.80, lon: -117.30, break_type: "beach", skill_level: "intermediate-advanced" },
      { id: "lb-7", name: "Expert Point", lat: 32.81, lon: -117.31, break_type: "point", skill_level: "expert" },
      { id: "lb-8", name: "Beginner Reef", lat: 32.82, lon: -117.32, break_type: "reef", skill_level: "beginner" },
    ] as any[];

    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: longboardBeaches,
      });
    });

    it("should match beach breaks at beginner/intermediate skill levels", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("longboard");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      // Should include: beach+beginner, point+beginner-intermediate, beach+intermediate, point+lower-intermediate
      expect(names).toContain("Mellow Beach");         // beach + beginner
      expect(names).toContain("Chill Point");           // point + beginner-intermediate
      expect(names).toContain("Intermediate Beach");    // beach + intermediate
      expect(names).toContain("Lower-Int Point");       // point + lower-intermediate
    });

    it("should exclude advanced and expert skill levels", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("longboard");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).not.toContain("Advanced Reef");       // reef + advanced
      expect(names).not.toContain("Int-Advanced Beach");  // beach + intermediate-advanced
      expect(names).not.toContain("Expert Point");        // point + expert
    });

    it("should exclude reef breaks even at beginner skill", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("longboard");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).not.toContain("Beginner Reef");  // reef + beginner — not longboard-friendly
    });
  });

  describe("bodyboard filter heuristic", () => {
    const bodyboardBeaches = [
      { id: "bb-1", name: "Shore Break", lat: 32.75, lon: -117.25, break_type: "beach", skill_level: "beginner" },
      { id: "bb-2", name: "Advanced Shore", lat: 32.76, lon: -117.26, break_type: "beach", skill_level: "advanced" },
      { id: "bb-3", name: "Rocky Reef", lat: 32.77, lon: -117.27, break_type: "reef", skill_level: "intermediate" },
      { id: "bb-4", name: "Long Point", lat: 32.78, lon: -117.28, break_type: "point", skill_level: "beginner" },
    ] as any[];

    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: bodyboardBeaches,
      });
    });

    it("should match all beach breaks regardless of skill level", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("bodyboard");
      });

      expect(result.current.filteredBeaches).toHaveLength(2);
      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).toContain("Shore Break");
      expect(names).toContain("Advanced Shore");
    });

    it("should exclude reef and point breaks", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBreakType("bodyboard");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).not.toContain("Rocky Reef");
      expect(names).not.toContain("Long Point");
    });
  });

  describe("beginner-friendly filter", () => {
    const skillBeaches = [
      { id: "sk-1", name: "Beginner Cove", lat: 32.75, lon: -117.25, break_type: "beach", skill_level: "beginner" },
      { id: "sk-2", name: "Begin-Int Shore", lat: 32.76, lon: -117.26, break_type: "beach", skill_level: "beginner-intermediate" },
      { id: "sk-3", name: "Intermediate Reef", lat: 32.77, lon: -117.27, break_type: "reef", skill_level: "intermediate" },
      { id: "sk-4", name: "Advanced Point", lat: 32.78, lon: -117.28, break_type: "point", skill_level: "advanced" },
    ] as any[];

    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: skillBeaches,
      });
    });

    it("should filter to beaches with beginner in skill_level", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBeginnerFriendly();
      });

      expect(result.current.filteredBeaches).toHaveLength(2);
      const names = result.current.filteredBeaches.map((b: any) => b.name);
      expect(names).toContain("Beginner Cove");
      expect(names).toContain("Begin-Int Shore");
    });

    it("should toggle off to show all beaches again", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.toggleBeginnerFriendly();
      });
      expect(result.current.filteredBeaches).toHaveLength(2);

      act(() => {
        result.current.toggleBeginnerFriendly();
      });
      expect(result.current.filteredBeaches).toHaveLength(4);
    });
  });

  describe("clearAllFilters", () => {
    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: mockBeaches,
      });
    });

    it("should reset all filters and show all beaches", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      // Apply both filter types
      act(() => {
        result.current.toggleBeginnerFriendly();
        result.current.toggleBreakType("reef");
      });

      // Filters are active — fewer results
      expect(result.current.filteredBeaches.length).toBeLessThan(5);

      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.filteredBeaches).toHaveLength(5);
      expect(result.current.filters.beginnerFriendly).toBe(false);
      expect(result.current.filters.breakTypes.size).toBe(0);
    });

    it("clearAllFilters also resets searchQuery (used by map Clear all)", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("Ocean");
        result.current.toggleBreakType("reef");
      });

      expect(result.current.searchQuery).toBe("Ocean");

      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.searchQuery).toBe("");
      expect(result.current.filters.breakTypes.size).toBe(0);
      expect(result.current.filteredBeaches).toHaveLength(5);
    });
  });

  describe("search ranking", () => {
    const rankingBeaches = [
      { id: "r-1", name: "7th Street Beach", city: "Ocean City", state: "NJ", lat: 39.27, lon: -74.57 },
      { id: "r-2", name: "Ocean Beach", city: "San Diego", state: "CA", lat: 32.75, lon: -117.25 },
      { id: "r-3", name: "Ocean Park Beach", city: "Santa Monica", state: "CA", lat: 34.0, lon: -118.49 },
      { id: "r-4", name: "Waverly Beach", city: "Ocean City", state: "NJ", lat: 39.28, lon: -74.58 },
    ] as any[];

    beforeEach(() => {
      (mockGetBeaches as any).mockResolvedValue({
        success: true,
        data: rankingBeaches,
      });
    });

    it("should rank exact name match above cross-field matches", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("ocean beach");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      // Ocean Beach (exact name match) must be first
      expect(names[0]).toBe("Ocean Beach");
      // Cross-field matches (ocean in city, beach in name) should rank last
      expect(names).toContain("7th Street Beach");
      expect(names.indexOf("Ocean Beach")).toBeLessThan(names.indexOf("7th Street Beach"));
    });

    it("should rank all-tokens-in-name above tokens split across name and city", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("ocean beach");
      });

      const names = result.current.filteredBeaches.map((b: any) => b.name);
      // Ocean Park Beach has both "ocean" and "beach" in its name
      expect(names.indexOf("Ocean Park Beach")).toBeLessThan(names.indexOf("7th Street Beach"));
    });

    it("should still return all matching beaches (no results dropped)", async () => {
      const { result } = renderHook(() => useBeachSearch());

      await act(async () => {
        await result.current.loadBeaches();
      });

      act(() => {
        result.current.setSearchQuery("ocean beach");
      });

      // All 3 match: Ocean Beach, Ocean Park Beach, 7th Street Beach
      // Waverly Beach doesn't have "ocean" in name, only in city, and doesn't have "beach" wait —
      // Waverly Beach + Ocean City NJ → hay = "waverly beach ocean city nj" → has "ocean" and "beach" → matches
      expect(result.current.filteredBeaches).toHaveLength(4);
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

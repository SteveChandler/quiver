import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Beach } from "@/types/database";

const MAX_DISTANCE_MILES = 30;

interface BeachSearchState {
  filteredBeaches: Beach[];
  searchQuery: string;
  selectedBeach: Beach | null;
  activeRegion: string | "ALL";
  filters: {
    beginnerFriendly: boolean;
    breakTypes: Set<string>;
  };
}

export function useBeachSearch() {
  const [state, setState] = useState<BeachSearchState>({
    filteredBeaches: [],
    searchQuery: "",
    selectedBeach: null,
    activeRegion: "ALL",
    filters: {
      beginnerFriendly: false,
      breakTypes: new Set<string>(),
    },
  });

  // Separate state for beaches data to handle both loadBeaches and loadNearbyBeaches
  const [beachesState, setBeachesState] = useState<{
    beaches: Beach[];
    loading: boolean;
    error: string | null;
  }>({
    beaches: [],
    loading: false,
    error: null,
  });

  // Memoize fetch function to prevent infinite loops - only create once
  const fetchBeaches = useCallback(async () => {
    const result = await getBeaches();
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beaches");
  }, []);

  const {
    data: beachesData,
    loading: dataFetcherLoading,
    error: dataFetcherError,
    refetch: refetchBeaches,
  } = useDataFetcher(fetchBeaches, { immediate: false });

  // Sync useDataFetcher state with our local beaches state
  useEffect(() => {
    setBeachesState((prev) => ({
      beaches: beachesData || prev.beaches,
      loading: dataFetcherLoading,
      error: dataFetcherError,
    }));
  }, [beachesData, dataFetcherLoading, dataFetcherError]);

  const { beaches, loading, error } = beachesState;

  // Compute distinct regions from loaded beaches
  const regions = useMemo(() => {
    const unique = new Set<string>();
    for (const b of beaches || []) {
      if (b?.region) unique.add(b.region);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [beaches]);

  // Memoize the filter + search pipeline
  const applyFiltersAndSearch = useCallback(
    (query: string, beachList: Beach[], activeRegion: string | "ALL", filters: BeachSearchState["filters"]) => {
      let working = beachList;

      // Debug logging
      console.log('🔍 Applying filters:', {
        totalBeaches: beachList.length,
        activeRegion,
        filters: {
          beginnerFriendly: filters.beginnerFriendly,
          breakTypes: Array.from(filters.breakTypes),
        },
        sampleBeach: beachList[0] ? {
          name: beachList[0].name,
          skill_level: beachList[0].skill_level,
          break_type: beachList[0].break_type,
        } : null,
      });

      // Region filter
      if (activeRegion !== "ALL") {
        working = working.filter((b) => (b.region || "") === activeRegion);
        console.log(`  After region filter: ${working.length} beaches`);
      }

      // Beginner-friendly filter
      if (filters.beginnerFriendly) {
        working = working.filter((b) => (b.skill_level || "").toLowerCase().includes("beginner"));
        console.log(`  After beginner filter: ${working.length} beaches`);
      }

      // Break type filter
      if (filters.breakTypes && filters.breakTypes.size > 0) {
        working = working.filter((b) => b.break_type ? filters.breakTypes.has(b.break_type.toLowerCase()) : false);
        console.log(`  After break type filter: ${working.length} beaches`);
      }

      // Fuzzy-ish search (tokens include)
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        console.log(`✅ Final filtered beaches: ${working.length}`);
        return working;
      }

      const tokens = trimmed.split(/\s+/g).filter(Boolean);
      const result = working.filter((beach) => {
        const hay = `${beach.name} ${(beach.location || "")}`.toLowerCase();
        return tokens.every((t) => hay.includes(t) || t.includes(hay));
      });
      
      console.log(`✅ Final filtered beaches (after search): ${result.length}`);
      return result;
    },
    []
  );

  // Update filtered beaches when inputs change
  useEffect(() => {
    const filtered = applyFiltersAndSearch(
      state.searchQuery,
      beaches || [],
      state.activeRegion,
      state.filters
    );

    const hasSearchQuery = state.searchQuery.trim().length > 0;

    setState((prev) => {
      const prevSelection = prev.selectedBeach;
      const selectionStillValid = prevSelection
        ? filtered.some((beach) => beach.id === prevSelection.id)
        : false;

      let nextSelection: Beach | null = null;

      if (hasSearchQuery) {
        nextSelection = filtered.length > 0 ? filtered[0] : null;
      } else if (selectionStillValid) {
        nextSelection = prevSelection;
      } else {
        nextSelection = filtered.length > 0 ? filtered[0] : null;
      }

      return {
        ...prev,
        filteredBeaches: filtered,
        selectedBeach: nextSelection,
      };
    });
  }, [beaches, state.searchQuery, state.activeRegion, state.filters, applyFiltersAndSearch]);

  // Debounced search effect - separate from the main update logic
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      return;
    }

    // Avoid triggering search if we already have beaches loaded
    if (!beaches?.length && !loading) {
      const timeoutId = setTimeout(() => {
        loadBeaches();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [state.searchQuery, beaches?.length, loading]);

  const loadBeaches = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loading) return;

    setBeachesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetchBeaches();
      setBeachesState({
        beaches: result,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error loading beaches:", err);
      setBeachesState({
        beaches: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load beaches",
      });
    }
  }, [fetchBeaches, loading]);

  const loadNearbyBeaches = useCallback(
    async (latitude: number, longitude: number) => {
      // Prevent multiple simultaneous loads using previous state
      setBeachesState((prev) => {
        if (prev.loading) return prev; // Already loading, don't start another
        return { ...prev, loading: true, error: null };
      });

      try {
        const result = await getNearbyBeaches(
          latitude,
          longitude,
          MAX_DISTANCE_MILES
        );

        if (result.success && result.data && result.data.length > 0) {
          const sortedBeaches = [...result.data];

          // Update both main beaches state and filtered beaches
          setBeachesState({
            beaches: sortedBeaches,
            loading: false,
            error: null,
          });

          setState((prev) => ({
            ...prev,
            filteredBeaches: sortedBeaches,
            selectedBeach:
              sortedBeaches.length > 0 && !prev.selectedBeach
                ? sortedBeaches[0]
                : prev.selectedBeach,
          }));
        } else {
          // Handle empty result
          setBeachesState({
            beaches: [],
            loading: false,
            error: null,
          });

          setState((prev) => ({
            ...prev,
            filteredBeaches: [],
            selectedBeach: null,
          }));
        }
      } catch (error) {
        console.error("Error loading nearby beaches:", error);
        setBeachesState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load nearby beaches",
        }));
      }
    },
    [] // No dependencies to prevent recreation and infinite loops
  );

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const clearSearch = useCallback(() => {
    setState((prev) => ({ ...prev, searchQuery: "" }));
  }, []);

  const setSelectedBeach = useCallback((beach: Beach | null) => {
    setState((prev) => ({ ...prev, selectedBeach: beach }));
  }, []);

  // Get beaches to show in the horizontal scroll (excluding selected beach)
  const nearbyBeachesForScroll = useMemo(() => {
    if (!state.filteredBeaches?.length) return [];

    if (state.selectedBeach) {
      return state.filteredBeaches
        .filter((beach) => beach.id !== state.selectedBeach!.id)
        .slice(0, 4);
    }

    return state.filteredBeaches.slice(0, 5);
  }, [state.filteredBeaches, state.selectedBeach]);

  return {
    ...state,
    beaches,
    loading,
    error,
    regions,
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    nearbyBeachesForScroll,
    // Filters API
    setActiveRegion: useCallback((region: string | "ALL") => {
      setState((prev) => ({ ...prev, activeRegion: region }));
    }, []),
    toggleBeginnerFriendly: useCallback(() => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, beginnerFriendly: !prev.filters.beginnerFriendly },
      }));
    }, []),
    toggleBreakType: useCallback((type: string) => {
      setState((prev) => {
        const next = new Set(prev.filters.breakTypes);
        const key = type.toLowerCase();
        if (next.has(key)) next.delete(key); else next.add(key);
        return { ...prev, filters: { ...prev.filters, breakTypes: next } };
      });
    }, []),
    clearAllFilters: useCallback(() => {
      setState((prev) => ({
        ...prev,
        filters: {
          beginnerFriendly: false,
          breakTypes: new Set<string>(),
        },
      }));
    }, []),
  };
}

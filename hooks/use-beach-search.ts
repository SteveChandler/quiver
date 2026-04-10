import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Beach } from "@/types/database";
import { normalizeSearchText, expandSearchWithAliases } from "@/lib/utils/text-normalization";

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
  const [hasLoadedAllBeaches, setHasLoadedAllBeaches] = useState(false);

  // State for beaches near the selected beach (not user location)
  const [selectedBeachNearby, setSelectedBeachNearby] = useState<Beach[]>([]);

  // Track in-flight requests to prevent duplicates
  const nearbyRequestInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const allBeachesLoadingRef = useRef(false);

  // Memoize fetch function to prevent infinite loops - only create once
  const fetchBeaches = useCallback(async () => {
    const result = await getBeaches();
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beaches");
  }, []);

  const { data: beachesData } = useDataFetcher(fetchBeaches, {
    immediate: false,
  });

  // Sync useDataFetcher state with our local beaches state
  useEffect(() => {
    if (!beachesData) return;
    setBeachesState((prev) => ({
      ...prev,
      beaches: beachesData,
    }));
    if (beachesData.length > 0) {
      setHasLoadedAllBeaches(true);
    }
  }, [beachesData]);

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

      // Region filter
      if (activeRegion !== "ALL") {
        working = working.filter((b) => (b.region || "") === activeRegion);
      }

      // Beginner-friendly filter
      if (filters.beginnerFriendly) {
        working = working.filter((b) => (b.skill_level || "").toLowerCase().includes("beginner"));
      }

      // Break type filter - use substring matching to handle descriptive break_type values
      // (e.g., "beach/reef break" matches both "beach" and "reef" filters).
      // "longboard" and "bodyboard" are board-type heuristics, not break_type values:
      //   longboard → mellow waves: beach or point breaks at beginner/intermediate skill
      //   bodyboard → shore break: beach breaks at any skill level
      if (filters.breakTypes && filters.breakTypes.size > 0) {
        working = working.filter((b) => {
          if (!b.break_type) return false;
          const breakTypeLower = b.break_type.toLowerCase();
          const skillLower = (b.skill_level || "").toLowerCase();

          return Array.from(filters.breakTypes).some((filterType) => {
            if (filterType === "longboard") {
              const mellowBreak = breakTypeLower.includes("beach") || breakTypeLower.includes("point");
              const mellowSkill = skillLower.includes("beginner") || (skillLower.includes("intermediate") && !skillLower.includes("advanced"));
              return mellowBreak && mellowSkill;
            }
            if (filterType === "bodyboard") {
              return breakTypeLower.includes("beach");
            }
            return breakTypeLower.includes(filterType);
          });
        });
      }

      // Fuzzy search with punctuation-insensitive normalization and alias support
      const searchVariants = expandSearchWithAliases(query);

      // If no normalized query, return all filtered beaches
      if (searchVariants.length === 0 || !searchVariants[0]) {
        return working;
      }

      // Score and filter beaches by relevance
      const scored: { beach: Beach; score: number }[] = [];

      for (const beach of working) {
        const normalizedName = normalizeSearchText(beach.name);
        const normalizedLocation = normalizeSearchText(
          [beach.city, beach.state].filter(Boolean).join(" ")
        );
        const hay = `${normalizedName} ${normalizedLocation}`;

        let bestScore = 0;
        for (const variant of searchVariants) {
          const tokens = variant.split(/\s+/g).filter(Boolean);
          if (!tokens.every((t) => hay.includes(t))) continue;

          // All tokens match somewhere — now score by WHERE they match
          let score = 1;
          const allInName = tokens.every((t) => normalizedName.includes(t));
          if (allInName) {
            score = normalizedName === variant ? 1000 // exact name match
              : normalizedName.startsWith(variant) ? 800 // name starts with query
              : normalizedName.includes(variant) ? 600 // name contains full query as substring
              : 400; // all tokens in name but not contiguous
          }
          // tokens split across name and location get score = 1

          bestScore = Math.max(bestScore, score);
        }

        if (bestScore > 0) {
          scored.push({ beach, score: bestScore });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.map((s) => s.beach);
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

  // Load all beaches function - defined before useEffect to avoid hoisting issues
  const loadBeaches = useCallback(async () => {
    if (allBeachesLoadingRef.current) {
      return;
    }

    allBeachesLoadingRef.current = true;
    setBeachesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetchBeaches();
      setBeachesState({
        beaches: result,
        loading: false,
        error: null,
      });
      setHasLoadedAllBeaches(true);
    } catch (err) {
      console.error("Error loading beaches:", err);
      setBeachesState({
        beaches: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load beaches",
      });
      setHasLoadedAllBeaches(false);
    } finally {
      allBeachesLoadingRef.current = false;
    }
  }, [fetchBeaches]);

  // Debounced search effect - separate from the main update logic
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      return;
    }

    if (!hasLoadedAllBeaches && !allBeachesLoadingRef.current) {
      const timeoutId = setTimeout(() => {
        loadBeaches();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [state.searchQuery, hasLoadedAllBeaches, loadBeaches]);

  const loadNearbyBeaches = useCallback(
    async (latitude: number, longitude: number) => {
      // Prevent duplicate requests - check ref first (more reliable than state)
      if (nearbyRequestInFlightRef.current) {
        return;
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Mark request as in-flight
      nearbyRequestInFlightRef.current = true;
      abortControllerRef.current = new AbortController();

      setBeachesState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));
 
      try {
        const result = await getNearbyBeaches(
          latitude,
          longitude,
          MAX_DISTANCE_MILES
        );

        // Check if request was cancelled
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (result.success && result.data && result.data.length > 0) {
          if ((result as any).fallbackUsed) {
            // Surface spatial fallback in the browser so E2E tests can catch DB regressions
            console.warn(
              "Spatial function failed, falling back to client-side filtering"
            );
          }

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
            selectedBeach: prev.selectedBeach,
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
      } finally {
        // Clear in-flight flag
        nearbyRequestInFlightRef.current = false;
      }
    },
    [] // No dependencies to prevent recreation and infinite loops
  );

  // Load beaches near a selected beach (not user location)
  const loadNearbyBeachesForSelected = useCallback(
    async (beach: Beach) => {
      if (typeof beach.lat !== "number" || typeof beach.lon !== "number") {
        console.warn("[useBeachSearch] Selected beach has no coordinates");
        return;
      }

      try {
        const result = await getNearbyBeaches(beach.lat, beach.lon, MAX_DISTANCE_MILES);

        if (result.success && result.data) {
          // Filter out the selected beach itself
          const nearby = result.data.filter((b) => b.id !== beach.id);
          setSelectedBeachNearby(nearby);
        }
      } catch (error) {
        console.error("[useBeachSearch] Error loading nearby beaches for selected:", error);
      }
    },
    []
  );

  // Clear the selected beach nearby list
  const clearSelectedBeachNearby = useCallback(() => {
    setSelectedBeachNearby([]);
  }, []);

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
    // When a beach is selected, prefer beaches near THAT beach (not user location)
    if (state.selectedBeach && selectedBeachNearby.length > 0) {
      return selectedBeachNearby.slice(0, 4);
    }

    // Fallback to filtered beaches (user location based)
    if (!state.filteredBeaches?.length) return [];

    if (state.selectedBeach) {
      return state.filteredBeaches
        .filter((beach) => beach.id !== state.selectedBeach!.id)
        .slice(0, 4);
    }

    return state.filteredBeaches.slice(0, 5);
  }, [state.filteredBeaches, state.selectedBeach, selectedBeachNearby]);

  return {
    ...state,
    beaches,
    loading,
    error,
    regions,
    loadBeaches,
    loadNearbyBeaches,
    loadNearbyBeachesForSelected,
    clearSelectedBeachNearby,
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

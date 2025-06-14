import { useState, useEffect, useCallback, useMemo } from "react";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Beach } from "@/types/database";

const MAX_DISTANCE_MILES = 30;

interface BeachSearchState {
  filteredBeaches: Beach[];
  searchQuery: string;
  selectedBeach: Beach | null;
}

export function useBeachSearch() {
  const [state, setState] = useState<BeachSearchState>({
    filteredBeaches: [],
    searchQuery: "",
    selectedBeach: null,
  });

  // Memoize fetch function to prevent infinite loops
  const fetchBeaches = useCallback(async () => {
    const result = await getBeaches();
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beaches");
  }, []);

  const {
    data: beaches = [],
    loading,
    error,
    refetch: loadBeaches,
  } = useDataFetcher(fetchBeaches, { immediate: false });

  // Update filtered beaches when beaches array changes and no search query
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      setState((prev) => ({ ...prev, filteredBeaches: beaches || [] }));
    }
  }, [beaches, state.searchQuery]);

  // Filter beaches based on search query with debounce
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      return;
    }

    const timeoutId = setTimeout(() => {
      searchAllBeaches(state.searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [state.searchQuery]);

  const searchAllBeaches = useCallback(
    async (query: string) => {
      if (!beaches?.length && !loading) {
        loadBeaches();
        return;
      }

      const filtered = (beaches || []).filter(
        (beach) =>
          beach.name.toLowerCase().includes(query.toLowerCase()) ||
          (beach.location &&
            beach.location.toLowerCase().includes(query.toLowerCase()))
      );
      setState((prev) => ({
        ...prev,
        filteredBeaches: filtered,
        selectedBeach: filtered.length > 0 ? filtered[0] : null,
      }));
    },
    [beaches, loading, loadBeaches]
  );

  const loadNearbyBeaches = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        const result = await getNearbyBeaches(
          latitude,
          longitude,
          MAX_DISTANCE_MILES
        );

        if (result.success && result.data && result.data.length > 0) {
          const sortedBeaches = [...result.data];
          setState((prev) => ({
            ...prev,
            filteredBeaches: sortedBeaches,
            selectedBeach:
              sortedBeaches.length > 0 && !prev.selectedBeach
                ? sortedBeaches[0]
                : prev.selectedBeach,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            filteredBeaches: [],
            selectedBeach: null,
          }));
        }
      } catch (error) {
        console.error("Error loading nearby beaches:", error);
      }
    },
    []
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
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    nearbyBeachesForScroll,
  };
}

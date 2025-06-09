import { useState, useEffect, useCallback, useMemo } from "react";
import { getBeaches, getNearbyBeaches } from "@/actions/beach-actions";
import type { Beach } from "@/types/database";

const MAX_DISTANCE_MILES = 30;

interface BeachSearchState {
  beaches: Beach[];
  filteredBeaches: Beach[];
  loading: boolean;
  searchQuery: string;
  selectedBeach: Beach | null;
}

export function useBeachSearch() {
  const [state, setState] = useState<BeachSearchState>({
    beaches: [],
    filteredBeaches: [],
    loading: true,
    searchQuery: "",
    selectedBeach: null,
  });

  // Update filtered beaches when beaches array changes and no search query
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      setState((prev) => ({ ...prev, filteredBeaches: prev.beaches }));
    }
  }, [state.beaches, state.searchQuery]);

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

  const searchAllBeaches = useCallback(async (query: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        const filtered = result.data.filter(
          (beach) =>
            beach.name.toLowerCase().includes(query.toLowerCase()) ||
            (beach.location &&
              beach.location.toLowerCase().includes(query.toLowerCase()))
        );
        setState((prev) => ({
          ...prev,
          filteredBeaches: filtered,
          selectedBeach: filtered.length > 0 ? filtered[0] : null,
          loading: false,
        }));
      }
    } catch (error) {
      console.error("Error searching beaches:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const loadBeaches = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          beaches: result.data,
          filteredBeaches: result.data,
          loading: false,
        }));
      }
    } catch (error) {
      console.error("Error loading beaches:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const loadNearbyBeaches = useCallback(
    async (latitude: number, longitude: number) => {
      setState((prev) => ({ ...prev, loading: true }));
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
            beaches: sortedBeaches,
            filteredBeaches: sortedBeaches,
            selectedBeach:
              sortedBeaches.length > 0 && !prev.selectedBeach
                ? sortedBeaches[0]
                : prev.selectedBeach,
            loading: false,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            beaches: [],
            filteredBeaches: [],
            selectedBeach: null,
            loading: false,
          }));
        }
      } catch (error) {
        console.error("Error loading nearby beaches:", error);
        setState((prev) => ({ ...prev, loading: false }));
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
    if (!state.filteredBeaches.length) return [];

    if (state.selectedBeach) {
      return state.filteredBeaches
        .filter((beach) => beach.id !== state.selectedBeach!.id)
        .slice(0, 4);
    }

    return state.filteredBeaches.slice(0, 5);
  }, [state.filteredBeaches, state.selectedBeach]);

  return {
    ...state,
    loadBeaches,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    nearbyBeachesForScroll,
  };
}

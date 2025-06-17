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

  // Memoize fetch function to prevent infinite loops
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

  // Update filtered beaches when beaches array changes
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      setState((prev) => ({ ...prev, filteredBeaches: beaches || [] }));
    } else if (beaches?.length > 0) {
      // Re-run search when beaches are loaded and there's an active search query
      const filtered = beaches.filter(
        (beach) =>
          beach.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          (beach.location &&
            beach.location
              .toLowerCase()
              .includes(state.searchQuery.toLowerCase()))
      );
      setState((prev) => ({
        ...prev,
        filteredBeaches: filtered,
        selectedBeach: filtered.length > 0 ? filtered[0] : null,
      }));
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

  const loadBeaches = useCallback(async () => {
    // Create a wrapper that throws on error
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
  }, [fetchBeaches]);

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
      setBeachesState((prev) => ({ ...prev, loading: true, error: null }));

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

import { useState, useCallback } from "react";
import { getBeaches, getBeachById } from "@/actions/beach-actions";
import { getCurrentForecast } from "@/lib/utils/current-forecast-utils";
import type { Beach, Profile } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface UseBeachForecastReturn {
  beach: Beach | null;
  forecast: EnhancedForecastEntity | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  availableBeaches: Beach[];
  loadingBeaches: boolean;
  setBeach: (beach: Beach | null) => void;
  setForecast: (forecast: EnhancedForecastEntity | null) => void;
  loadForecastForBeach: (beachId: string) => Promise<void>;
  loadAvailableBeaches: () => Promise<void>;
  refreshForecast: () => Promise<void>;
  initializeWithProfile: (profile: Profile | null) => Promise<void>;
}

export function useBeachForecast(): UseBeachForecastReturn {
  const [beach, setBeach] = useState<Beach | null>(null);
  const [forecast, setForecast] = useState<EnhancedForecastEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [availableBeaches, setAvailableBeaches] = useState<Beach[]>([]);
  const [loadingBeaches, setLoadingBeaches] = useState(false);

  // Helper to fetch enhanced forecast
  const fetchForecast = async (beachId: string) => {
    // Let errors bubble up to be caught by the caller
    const url = `/api/forecasts/update-enhanced?beachId=${beachId}&days=1`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Forecast API failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.success && data.data?.forecasts?.length > 0) {
      return getCurrentForecast(data.data.forecasts);
    }
    return null;
  };

  const loadForecastForBeach = useCallback(async (beachId: string) => {
    setLoading(true);
    setError(null);
    try {
      const bestForecast = await fetchForecast(beachId);
      setForecast(bestForecast);
    } catch (err) {
      setError("Failed to load forecast");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshForecast = useCallback(async () => {
    if (!beach) return;
    setRefreshing(true);
    try {
      const bestForecast = await fetchForecast(beach.id);
      if (bestForecast) setForecast(bestForecast);
    } finally {
      setRefreshing(false);
    }
  }, [beach]);

  const loadAvailableBeaches = useCallback(async () => {
    setLoadingBeaches(true);
    try {
      const result = await getBeaches();
      if (result.success && result.data) {
        const sorted = result.data
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 12);
        setAvailableBeaches(sorted);
      }
    } finally {
      setLoadingBeaches(false);
    }
  }, []);

  // Initialize Logic (Home Beach or Fallback)
  const initializeWithProfile = useCallback(async (profile: Profile | null) => {
    try {
      const homeBeachId = profile?.home_beach_id;
      let targetBeach: Beach | null = null;

      if (homeBeachId) {
        const result = await getBeachById(homeBeachId);
        if (result.success && result.data) targetBeach = result.data;
      }

      if (!targetBeach) {
        const result = await getBeaches();
        if (result.success && result.data) {
          targetBeach = result.data.find(b => 
            b.name.toLowerCase().includes("pacific beach")
          ) || result.data[0];
        }
      }

      if (targetBeach) {
        setBeach(targetBeach);
        await loadForecastForBeach(targetBeach.id);
      }
    } catch (err) {
      console.error("Initialization failed", err);
      setError("Failed to initialize");
    }
  }, [loadForecastForBeach]);

  return {
    beach,
    forecast,
    loading,
    error,
    refreshing,
    availableBeaches,
    loadingBeaches,
    setBeach,
    setForecast,
    loadForecastForBeach,
    loadAvailableBeaches,
    refreshForecast,
    initializeWithProfile
  };
}


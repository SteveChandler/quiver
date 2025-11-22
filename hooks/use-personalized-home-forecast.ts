"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { PersonalizedForecastRecommendation } from "@/types/personalization";

/**
 * Options for usePersonalizedHomeForecast hook
 */
interface UsePersonalizedHomeForecastOptions {
  /** Optional override for user's home beach ID */
  homeBeachId?: string;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Optional callback when recommendation is fetched successfully */
  onSuccess?: (data: PersonalizedForecastRecommendation | null) => void;
  /** Optional callback when an error occurs */
  onError?: (error: string) => void;
}

/**
 * Return type for usePersonalizedHomeForecast hook
 */
interface UsePersonalizedHomeForecastReturn {
  /** Personalized forecast recommendation or null */
  recommendation: PersonalizedForecastRecommendation | null;
  /** Whether the request is currently loading */
  loading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch the recommendation */
  refetch: () => Promise<void>;
  /** Convenience helper: true if recommendation exists, false otherwise */
  hasRecommendation: boolean;
}

/**
 * Hook for fetching personalized home forecast recommendations
 * 
 * Fetches a personalized surf forecast recommendation based on user preferences,
 * home beach, and favorite beaches. Uses the personalization service to score
 * and rank forecast opportunities.
 * 
 * @param options - Configuration options for the hook
 * @returns Recommendation data with loading and error states
 * 
 * @example
 * ```tsx
 * function HomePage() {
 *   const { recommendation, loading, error, refetch } = usePersonalizedHomeForecast({
 *     immediate: true,
 *     enabled: true,
 *   });
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!recommendation) return <div>No recommendations available</div>;
 * 
 *   return (
 *     <div>
 *       <h2>{recommendation.summary}</h2>
 *       <p>Beach: {recommendation.beach.name}</p>
 *       <p>Score: {recommendation.score}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersonalizedHomeForecast(
  options: UsePersonalizedHomeForecastOptions = {}
): UsePersonalizedHomeForecastReturn {
  const { homeBeachId, enabled = true, immediate = true, onSuccess, onError } = options;
  const { user } = useAuth();

  // Memoized fetch function to get personalized forecast
  const fetchPersonalizedForecast = useCallback(async () => {
    console.log('🔍 usePersonalizedHomeForecast: Starting fetch', {
      hasUser: !!user,
      homeBeachId,
      enabled,
      immediate
    });

    if (!user) {
      console.log('❌ usePersonalizedHomeForecast: No user, skipping fetch');
      throw new Error("User must be authenticated to fetch personalized forecast");
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (homeBeachId) {
      params.set("homeBeachId", homeBeachId);
    }

    const queryString = params.toString();
    const url = `/api/home/personalized-forecast${queryString ? `?${queryString}` : ""}`;

    console.log('📡 usePersonalizedHomeForecast: Fetching from API', { url });

    // Fetch from API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Failed to fetch personalized forecast: ${response.status}`;
      console.log('❌ usePersonalizedHomeForecast: API error', {
        status: response.status,
        errorMessage
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();

    console.log('📊 usePersonalizedHomeForecast: API response received', {
      hasData: !!result.data,
      data: result.data
    });

    // API returns { data: recommendation } or { data: null }
    return result.data as PersonalizedForecastRecommendation | null;
  }, [user, homeBeachId, enabled, immediate]);

  /**
   * Hydrates date strings from API response back to Date objects
   * API responses are JSON, which serializes Date objects to ISO strings
   * This function converts them back to Date instances for proper usage
   */
  const hydrateDates = useCallback((recommendation: PersonalizedForecastRecommendation | null): PersonalizedForecastRecommendation | null => {
    if (!recommendation?.window) {
      return recommendation;
    }

    try {
      // Hydrate window start and end dates
      const start = new Date(recommendation.window.start);
      const end = new Date(recommendation.window.end);

      // Validate dates are valid
      if (isNaN(start.getTime())) {
        throw new Error(`Invalid window start date: ${recommendation.window.start}`);
      }
      if (isNaN(end.getTime())) {
        throw new Error(`Invalid window end date: ${recommendation.window.end}`);
      }

      return {
        ...recommendation,
        window: {
          ...recommendation.window,
          start,
          end,
        },
      };
    } catch (error) {
      console.error('❌ usePersonalizedHomeForecast: Date hydration error', error);
      throw error;
    }
  }, []);

  // Wrap fetch function to include date hydration
  const fetchWithHydration = useCallback(async () => {
    const data = await fetchPersonalizedForecast();
    return hydrateDates(data);
  }, [fetchPersonalizedForecast, hydrateDates]);

  // Use standard data fetcher pattern with date hydration
  const { data, loading, error, refetch } = useDataFetcher(
    fetchWithHydration,
    {
      immediate: immediate && enabled && !!user,
      skip: !enabled || !user,
      onSuccess,
      onError,
    }
  );

  // Log final state for debugging
  console.log('✅ usePersonalizedHomeForecast: Hook state', {
    hasRecommendation: data !== null,
    loading,
    hasError: !!error,
    error
  });

  return {
    recommendation: data,
    loading,
    error,
    refetch,
    hasRecommendation: data !== null,
  };
}

"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { PersonalizedInsights, SimilarityInsightsInput } from "@/types/personalization";

/**
 * Options for useInsights hook
 */
interface UseInsightsOptions extends SimilarityInsightsInput {
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for useInsights hook
 */
interface UseInsightsReturn {
  /** Personalized insights data */
  insights: PersonalizedInsights | null;
  /** Whether the request is currently loading */
  loading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch the insights */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching personalized insights based on forecast conditions
 *
 * Fetches insights from the API that compare current forecast conditions
 * with the user's historical surf sessions, including similar sessions and
 * board recommendations.
 *
 * @param options - Configuration options including forecast conditions
 * @returns Insights data with loading and error states
 *
 * @example
 * ```tsx
 * function ForecastCard() {
 *   const { insights, loading, error, refetch } = useInsights({
 *     beachId: 'beach-123',
 *     beachName: 'Ocean Beach',
 *     waveHeight: 4.5,
 *     wavePeriod: 12,
 *     windSpeed: 10,
 *     enabled: !!profile,
 *   });
 *
 *   if (loading) return <div>Loading insights...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!insights) return null;
 *
 *   return (
 *     <div>
 *       <p>{insights.label} match ({insights.matchPercent}%)</p>
 *       <ul>
 *         {insights.reasonBullets.map((reason, i) => (
 *           <li key={i}>{reason}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInsights(options: UseInsightsOptions): UseInsightsReturn {
  const {
    beachId,
    beachName,
    waveHeight,
    wavePeriod,
    windSpeed,
    windDirection,
    tideHeight,
    tideStatus,
    windowStart,
    enabled = true,
  } = options;
  const { user } = useAuth();

  // Memoized fetch function to get insights
  const fetchInsights = useCallback(async () => {
    if (!user) {
      throw new Error("User must be authenticated to fetch insights");
    }

    if (!beachId || !beachName) {
      throw new Error("Beach ID and name are required");
    }

    // Build query parameters
    const params = new URLSearchParams({
      beachId,
      beachName,
      waveHeight: waveHeight.toString(),
      wavePeriod: wavePeriod.toString(),
      windSpeed: windSpeed.toString(),
    });

    // Add optional parameters
    if (windDirection !== undefined) {
      params.set("windDirection", windDirection.toString());
    }
    if (tideHeight !== undefined) {
      params.set("tideHeight", tideHeight.toString());
    }
    if (tideStatus) {
      params.set("tideStatus", tideStatus);
    }
    if (windowStart) {
      params.set("windowStart", windowStart);
    }

    const url = `/api/surf/insights?${params.toString()}`;

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
      const errorMessage = errorData.error || `Failed to fetch insights: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // API returns { data: PersonalizedInsights }
    return result.data as PersonalizedInsights;
  }, [
    user,
    beachId,
    beachName,
    waveHeight,
    wavePeriod,
    windSpeed,
    windDirection,
    tideHeight,
    tideStatus,
    windowStart,
  ]);

  // Use standard data fetcher pattern
  const { data, loading, error, refetch } = useDataFetcher(fetchInsights, {
    immediate: enabled && !!user && !!beachId && !!beachName,
    skip: !enabled || !user || !beachId || !beachName,
  });

  return {
    insights: data,
    loading,
    error,
    refetch,
  };
}

"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SurfDiscoveryResponse } from "@/types/personalization";

/**
 * Options for useSurfDiscovery hook
 */
interface UseSurfDiscoveryOptions {
  /** User's GPS location (Phase 2) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles (Phase 2, default: 25) */
  radiusMiles?: number;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Include home beach in results (default: true) */
  includeHome?: boolean;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Optional callback when discovery results are fetched successfully */
  onSuccess?: (data: SurfDiscoveryResponse) => void;
  /** Optional callback when an error occurs */
  onError?: (error: string) => void;
}

/**
 * Return type for useSurfDiscovery hook
 */
interface UseSurfDiscoveryReturn {
  /** Surf discovery response with ranked recommendations */
  discovery: SurfDiscoveryResponse | null;
  /** Whether the request is currently loading */
  loading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch the recommendations */
  refetch: () => Promise<void>;
  /** Convenience helper: true if recommendations exist, false otherwise */
  hasRecommendations: boolean;
}

/**
 * Hook for discovering ranked surf spot recommendations
 *
 * Fetches multiple surf spot recommendations ranked by current conditions,
 * user preferences, beach metadata, and familiarity. Supports GPS discovery
 * in Phase 2.
 *
 * @param options - Configuration options for the hook
 * @returns Discovery data with loading and error states
 *
 * @example
 * ```tsx
 * function DiscoverPage() {
 *   const { discovery, loading, error, refetch } = useSurfDiscovery({
 *     maxResults: 5,
 *     immediate: true,
 *     enabled: true,
 *   });
 *
 *   if (loading) return <div>Finding the best spots...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!discovery || discovery.recommendations.length === 0) {
 *     return <div>No surf spots found</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {discovery.recommendations.map((rec) => (
 *         <div key={rec.beach.id}>
 *           <h3>{rec.beach.name}</h3>
 *           <p>Match: {rec.matchQuality} ({rec.score}/100)</p>
 *           <p>{rec.summary}</p>
 *           <ul>
 *             {rec.reasons.map((reason, i) => (
 *               <li key={i}>{reason}</li>
 *             ))}
 *           </ul>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSurfDiscovery(
  options: UseSurfDiscoveryOptions = {}
): UseSurfDiscoveryReturn {
  const {
    userLocation,
    radiusMiles,
    maxResults,
    includeHome,
    enabled = true,
    immediate = true,
    onSuccess,
    onError,
  } = options;
  const { user } = useAuth();

  // Memoized fetch function to discover surf spots
  const fetchSurfDiscovery = useCallback(async () => {
    console.log('🔍 useSurfDiscovery: Starting fetch', {
      hasUser: !!user,
      userLocation,
      radiusMiles,
      maxResults,
      includeHome,
      enabled,
      immediate,
    });

    if (!user) {
      console.log('❌ useSurfDiscovery: No user, skipping fetch');
      throw new Error("User must be authenticated to discover surf spots");
    }

    // Build query parameters
    const params = new URLSearchParams();

    // GPS parameters (Phase 2)
    if (userLocation) {
      params.set("lat", userLocation.lat.toString());
      params.set("lon", userLocation.lon.toString());
      if (radiusMiles) {
        params.set("radius", radiusMiles.toString());
      }
    }

    if (maxResults) {
      params.set("maxResults", maxResults.toString());
    }

    if (includeHome !== undefined) {
      params.set("includeHome", includeHome.toString());
    }

    const queryString = params.toString();
    const url = `/api/surf/discover${queryString ? `?${queryString}` : ""}`;

    console.log('📡 useSurfDiscovery: Fetching from API', { url });

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
      const errorMessage = errorData.error || `Failed to discover surf spots: ${response.status}`;
      console.log('❌ useSurfDiscovery: API error', {
        status: response.status,
        errorMessage,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();

    console.log('📊 useSurfDiscovery: API response received', {
      hasData: !!result.data,
      recommendationCount: result.data?.recommendations?.length || 0,
      data: result.data,
    });

    // API returns { data: SurfDiscoveryResponse }
    // Transform date strings back to Date objects
    if (result.data?.recommendations) {
      result.data.recommendations = result.data.recommendations.map((rec: any) => ({
        ...rec,
        window: {
          ...rec.window,
          start: new Date(rec.window.start),
          end: new Date(rec.window.end),
        },
      }));
    }

    return result.data as SurfDiscoveryResponse;
  }, [user, userLocation, radiusMiles, maxResults, includeHome, enabled, immediate]);

  // Use standard data fetcher pattern
  const { data, loading, error, refetch } = useDataFetcher(
    fetchSurfDiscovery,
    {
      immediate: immediate && enabled && !!user,
      skip: !enabled || !user,
      onSuccess,
      onError,
    }
  );

  // Log final state for debugging
  console.log('✅ useSurfDiscovery: Hook state', {
    hasRecommendations: data !== null && data.recommendations.length > 0,
    recommendationCount: data?.recommendations.length || 0,
    loading,
    hasError: !!error,
    error,
  });

  return {
    discovery: data,
    loading,
    error,
    refetch,
    hasRecommendations: data !== null && data.recommendations.length > 0,
  };
}

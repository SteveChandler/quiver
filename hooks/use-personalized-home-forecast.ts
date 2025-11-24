"use client";

import { useCallback } from "react";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { adaptDiscoveryResponse } from "@/lib/adapters/discovery-to-personalized";
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
 * @deprecated This hook is deprecated. Use `useSurfDiscovery` with `maxResults=1`
 * and `adaptDiscoveryResponse` instead. This hook now wraps the discovery service
 * for backward compatibility.
 *
 * **Migration:**
 * ```tsx
 * // Old (deprecated):
 * const { recommendation } = usePersonalizedHomeForecast({ enabled: true });
 *
 * // New (recommended):
 * import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
 * import { adaptDiscoveryResponse } from "@/lib/adapters/discovery-to-personalized";
 *
 * const { discovery } = useSurfDiscovery({ maxResults: 1, enabled: true });
 * const recommendation = discovery ? adaptDiscoveryResponse(discovery) : null;
 * ```
 *
 * **Why migrate:**
 * - Discovery service uses superior time-decay scoring (prioritizes near-term quality)
 * - Single codebase to maintain and test
 * - Consistent window selection across all recommendations
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

  // Log deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[DEPRECATED] usePersonalizedHomeForecast is deprecated. ' +
      'Use useSurfDiscovery with maxResults=1 and adaptDiscoveryResponse instead. ' +
      'This wrapper will be removed in a future version.'
    );
  }

  // Wrap onSuccess callback to adapt SurfDiscoveryResponse to PersonalizedForecastRecommendation
  const wrappedOnSuccess = useCallback(
    (discoveryData: any) => {
      if (onSuccess) {
        const adapted = discoveryData ? adaptDiscoveryResponse(discoveryData) : null;
        onSuccess(adapted);
      }
    },
    [onSuccess]
  );

  // Use discovery service with maxResults=1 (wrapper implementation)
  const {
    discovery,
    loading,
    error,
    refetch,
    hasRecommendations,
  } = useSurfDiscovery({
    maxResults: 1, // Single recommendation for backward compatibility
    enabled,
    immediate,
    onSuccess: wrappedOnSuccess, // Forward adapted callback
    onError, // Forward error callback as-is
    // Note: homeBeachId option is ignored - discovery service always includes home beach
    // This is acceptable as it's the expected behavior for personalized forecast
  });

  // Adapt discovery response to personalized format
  const recommendation = discovery ? adaptDiscoveryResponse(discovery) : null;

  return {
    recommendation,
    loading,
    error,
    refetch,
    hasRecommendation: hasRecommendations,
  };
}

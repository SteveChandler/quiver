"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";

interface UseBeachPersonalizationOptions {
  beachId: string | null;
  baseScore: number;
  forecast: any; // Required by API endpoint
}

interface UseBeachPersonalizationResult {
  data: PersonalizedScore | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch personalized beach scores
 *
 * Fetches personalized scores from the /api/beach/personalized-score endpoint
 * Returns null when beachId is null or user is not authenticated
 *
 * @param beachId - Beach ID to score (null to skip fetching)
 * @param baseScore - Base algorithmic score
 * @param forecast - Current forecast data for the beach
 *
 * @example
 * const { data: personalizedScore, loading, error } = useBeachPersonalization({
 *   beachId: "beach-123",
 *   baseScore: 75,
 * });
 *
 * if (personalizedScore?.personalized) {
 *   console.log(`Personalized score: ${personalizedScore.score}`);
 * }
 */
export function useBeachPersonalization({
  beachId,
  baseScore,
  forecast,
}: UseBeachPersonalizationOptions): UseBeachPersonalizationResult {
  const { user } = useAuth();

  const fetchPersonalizedScore = useCallback(async (): Promise<PersonalizedScore | null> => {
    if (!user || !beachId) return null;

    const response = await fetch("/api/beach/personalized-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        beachId,
        baseScore,
        forecast,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch personalized score: ${response.status}`);
    }

    const json = await response.json();
    return json.data ?? null;
  }, [user, beachId, baseScore, forecast]);

  const { data, loading, error, refetch } = useDataFetcher(fetchPersonalizedScore, {
    immediate: true,
    skip: !user || !beachId,
    initialData: null,
  });

  return {
    data: data ?? null,
    loading,
    error: error ? error : null,
    refetch,
  };
}

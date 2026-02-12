"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/**
 * Board recommendation data returned from the hook
 */
export interface BoardRecommendation {
  boardName: string;
  boardType: string;
  boardId: string;
}

/**
 * Options for the useBoardRecommendation hook
 */
export interface UseBoardRecommendationOptions {
  /** Current wave height in feet (required for recommendation) */
  waveHeight: number | null;
  /** Current wind speed in mph (required for recommendation) */
  windSpeed: number | null;
  /** Optional beach ID for beach-specific recommendations */
  beachId?: string | null;
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
}

/**
 * Board recommendation hook state
 */
export interface UseBoardRecommendationResult {
  /** The recommended board, or null if no confident recommendation */
  recommendation: BoardRecommendation | null;
  /** Whether the hook is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch recommendations */
  refetch: () => void;
}

/**
 * Module-level cache for board recommendations.
 *
 * This is intentionally a singleton shared across all component instances to avoid
 * redundant API calls when multiple components request the same recommendation.
 * Uses LRU eviction (via cacheOrder array) to bound memory usage at MAX_CACHE_SIZE entries.
 *
 * Key format: "waveHeight|windSpeed|beachId"
 */
const MAX_CACHE_SIZE = 100;
const cacheOrder: string[] = [];
const recommendationCache = new Map<
  string,
  { data: BoardRecommendation | null; timestamp: number }
>();
// 30 minute TTL to align with other API caches (CACHE_TTL.API_CALLS)
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Add entry to cache with LRU eviction
 */
function setCacheEntry(
  key: string,
  value: { data: BoardRecommendation | null; timestamp: number }
): void {
  // Remove key from order if it exists (will be re-added at end)
  const existingIndex = cacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    cacheOrder.splice(existingIndex, 1);
  }

  // Evict oldest entry if at capacity
  if (recommendationCache.size >= MAX_CACHE_SIZE && !recommendationCache.has(key)) {
    const oldest = cacheOrder.shift();
    if (oldest) {
      recommendationCache.delete(oldest);
    }
  }

  // Add to cache and track order
  cacheOrder.push(key);
  recommendationCache.set(key, value);
}

/**
 * Confidence thresholds for showing recommendations
 * Only show recommendations when we're confident in the suggestion
 */
const MIN_SCORE = 50;
const MIN_CONFIDENCE = 0.5;

/**
 * Creates a cache key from the options
 */
function getCacheKey(
  waveHeight: number | null,
  windSpeed: number | null,
  beachId: string | null | undefined
): string {
  return `${waveHeight ?? ""}|${windSpeed ?? ""}|${beachId ?? ""}`;
}

/**
 * Hook to fetch board recommendations based on current conditions.
 *
 * Uses the gear-suggestions API to get personalized board recommendations
 * based on the user's past sessions and current conditions.
 *
 * Only returns a recommendation when confidence thresholds are met:
 * - score >= 50
 * - confidence >= 0.5
 *
 * @example
 * ```tsx
 * const { recommendation, loading, error } = useBoardRecommendation({
 *   waveHeight: 4,
 *   windSpeed: 8,
 *   beachId: 'beach-123',
 * });
 *
 * if (recommendation) {
 *   return <span>Bring your {recommendation.boardName}</span>;
 * }
 * ```
 */
export function useBoardRecommendation({
  waveHeight,
  windSpeed,
  beachId,
  enabled = true,
}: UseBoardRecommendationOptions): UseBoardRecommendationResult {
  const [recommendation, setRecommendation] =
    useState<BoardRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);
  // Track current fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  // Memoize the cache key
  const cacheKey = useMemo(
    () => getCacheKey(waveHeight, windSpeed, beachId),
    [waveHeight, windSpeed, beachId]
  );

  // Check if user is likely authenticated (has Supabase auth cookie).
  // This prevents firing an API call that will 401 for unauthenticated users,
  // avoiding console noise from the browser logging the failed network request.
  const hasAuthCookie = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.cookie.includes("sb-") && document.cookie.includes("-auth-token");
  }, []);

  // Check if we have valid inputs
  const hasValidInputs = useMemo(
    () =>
      enabled &&
      hasAuthCookie &&
      waveHeight !== null &&
      waveHeight > 0 &&
      windSpeed !== null &&
      windSpeed >= 0,
    [enabled, hasAuthCookie, waveHeight, windSpeed]
  );

  const fetchRecommendation = useCallback(
    async (bypassCache = false) => {
      // Early return if inputs are invalid
      if (!hasValidInputs || waveHeight === null || windSpeed === null) {
        setRecommendation(null);
        setLoading(false);
        setError(null);
        return;
      }

      // Check cache first
      if (!bypassCache) {
        const cached = recommendationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setRecommendation(cached.data);
          setLoading(false);
          setError(null);
          return;
        }
      }

      // Increment fetch ID to track this specific fetch
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        // Build URL with query params
        const params = new URLSearchParams({
          waveHeight: waveHeight.toString(),
          windSpeed: windSpeed.toString(),
        });
        if (beachId) {
          params.set("beachId", beachId);
        }

        const response = await fetch(
          `/api/session-planner/gear-suggestions?${params.toString()}`
        );

        // Bail if component unmounted or a newer fetch was started
        if (!isMountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }

        if (!response.ok) {
          // 401 means user is not authenticated - this is expected for guests
          if (response.status === 401) {
            setRecommendation(null);
            setLoading(false);
            setError(null);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        // Bail if component unmounted or a newer fetch was started
        if (!isMountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }

        // Extract the first suggestion that meets our confidence thresholds
        const suggestions = json.data?.suggestions || [];
        const confidentSuggestion = suggestions.find(
          (s: { score: number; confidence: number }) =>
            s.score >= MIN_SCORE && s.confidence >= MIN_CONFIDENCE
        );

        const result: BoardRecommendation | null = confidentSuggestion
          ? {
              boardName: confidentSuggestion.board.name,
              boardType: confidentSuggestion.board.board_type,
              boardId: confidentSuggestion.board.id,
            }
          : null;

        // Cache the result with LRU eviction
        setCacheEntry(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });

        setRecommendation(result);
        setLoading(false);
        setError(null);
      } catch (err) {
        // Bail if component unmounted or a newer fetch was started
        if (!isMountedRef.current || fetchId !== fetchIdRef.current) {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch recommendation";
        setError(errorMessage);
        setRecommendation(null);
        setLoading(false);
      }
    },
    [hasValidInputs, waveHeight, windSpeed, beachId, cacheKey]
  );

  // Fetch on mount and when dependencies change
  useEffect(() => {
    isMountedRef.current = true;
    fetchRecommendation();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchRecommendation]);

  const refetch = useCallback(() => {
    fetchRecommendation(true);
  }, [fetchRecommendation]);

  return {
    recommendation,
    loading,
    error,
    refetch,
  };
}

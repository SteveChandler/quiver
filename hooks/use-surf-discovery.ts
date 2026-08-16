"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  clearDiscoveryRecommendationCache,
  hashDiscoveryOptions,
} from "@/lib/utils/discovery-cache-utils";
import { projectCanonicalDiscoverySurface } from "@/lib/recommendations/canonical-decision/client-projection";
import type { SurfDiscoveryResponse, TimeSlot } from "@/types/personalization";

/** Largest delay setTimeout can hold without overflowing to an immediate fire. */
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

/**
 * How close together two resume signals must be to count as one tab switch.
 * `focus` and `visibilitychange` fire within a frame of each other; anything
 * beyond this is treated as a separate resume that earns its own recheck.
 */
const RESUME_COALESCE_MS = 1_000;

/**
 * Options for useSurfDiscovery hook
 */
interface UseSurfDiscoveryOptions {
  /** User's GPS location (required for discovery) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles; omitted lets discovery expand from 25 to 100 as needed */
  radiusMiles?: number;
  /** Hard cap for window start time in hours (e.g. 24 for next-day UX) */
  horizonHours?: number;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Filter windows to specific time of day (default: 'any') */
  timeSlot?: TimeSlot;
  /** User's skill level — changes trigger a fresh policy-gated request. */
  userSkillLevel?: string | null;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Optional callback immediately before an API request starts */
  onRequest?: () => void;
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
  refetch: () => Promise<SurfDiscoveryResponse | undefined>;
  /** Convenience helper: true if recommendations exist, false otherwise */
  hasRecommendations: boolean;
  /** Compatibility field; recommendation responses are never cached. */
  isCached: boolean;
  /** Remove any pre-migration entries and refetch fresh data. */
  clearCacheAndRefetch: () => Promise<void>;
}

/**
 * Hook for discovering ranked surf spot recommendations.
 *
 * Fetches multiple surf spot recommendations ranked by current conditions,
 * user preferences, beach metadata, and familiarity. Recommendation responses
 * are intentionally never persisted because a newly active safety hold must
 * take precedence over every prior positive response.
 *
 * @param options - Configuration options for the hook
 * @returns Discovery data with loading and error states
 *
 * @example
 * ```tsx
 * function DiscoverPage() {
 *   const { discovery, loading, error, clearCacheAndRefetch } = useSurfDiscovery({
 *     maxResults: 5,
 *     immediate: true,
 *     enabled: true,
 *   });
 *
 *   // Pull-to-refresh should call clearCacheAndRefetch()
 *   const handleRefresh = () => clearCacheAndRefetch();
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
    horizonHours,
    maxResults,
    timeSlot,
    userSkillLevel,
    enabled = true,
    immediate = true,
    onRequest,
    onSuccess,
    onError,
  } = options;
  const { user } = useAuth();
  const onRequestRef = useRef(onRequest);
  onRequestRef.current = onRequest;

  const userLat = userLocation?.lat;
  const userLon = userLocation?.lon;

  // Compute a stable options hash from primitive values (avoid using `options` object identity).
  const optionsHash = useMemo(() => {
    return hashDiscoveryOptions({
      userLocation:
        userLat !== undefined && userLon !== undefined
          ? { lat: userLat, lon: userLon }
          : undefined,
      radiusMiles,
      horizonHours,
      maxResults,
      timeSlot,
      userSkillLevel,
    });
  }, [userLat, userLon, radiusMiles, horizonHours, maxResults, timeSlot, userSkillLevel]);

  // One-time migration: discard every old persisted recommendation response.
  // Other localStorage namespaces contain objective/user data and are untouched.
  useEffect(() => {
    clearDiscoveryRecommendationCache();
  }, []);

  // Memoized fetch function to discover surf spots
  const fetchSurfDiscovery = useCallback(async () => {
    if (!user) {
      throw new Error("User must be authenticated to discover surf spots");
    }

    // Build query parameters
    const params = new URLSearchParams();

    // GPS parameters (use primitives to avoid object-identity re-renders)
    if (userLat !== undefined && userLon !== undefined) {
      params.set("lat", userLat.toString());
      params.set("lon", userLon.toString());
      if (radiusMiles) {
        params.set("radius", radiusMiles.toString());
      }
    }

    if (maxResults) {
      params.set("maxResults", maxResults.toString());
    }

    if (horizonHours) {
      params.set("horizonHours", horizonHours.toString());
    }

    if (timeSlot) {
      params.set("timeSlot", timeSlot);
    }

    const queryString = params.toString();
    const url = `/api/surf/discover${queryString ? `?${queryString}` : ""}`;

    onRequestRef.current?.();

    // Fetch from API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Failed to discover surf spots: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();

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
    if (result.data?.includedRecommendations) {
      result.data.includedRecommendations = result.data.includedRecommendations.map(
        (rec: any) => ({
          ...rec,
          window: {
            ...rec.window,
            start: new Date(rec.window.start),
            end: new Date(rec.window.end),
          },
        }),
      );
    }

    const discoveryData = result.data as SurfDiscoveryResponse;
    return projectCanonicalDiscoverySurface(discoveryData);
  }, [
    user,
    userLat,
    userLon,
    radiusMiles,
    horizonHours,
    maxResults,
    timeSlot,
  ]);

  // Keep the data-fetcher callback stable so option changes are handled by the
  // guarded, fail-closed debounce below instead of triggering a second request.
  const fetchSurfDiscoveryRef = useRef(fetchSurfDiscovery);
  fetchSurfDiscoveryRef.current = fetchSurfDiscovery;
  const executeSurfDiscovery = useCallback(
    () => fetchSurfDiscoveryRef.current(),
    [],
  );

  // Use standard data fetcher pattern
  const {
    data: freshData,
    loading,
    error,
    refetch,
    reset,
  } = useDataFetcher(
    executeSurfDiscovery,
    {
      immediate: immediate && enabled && !!user,
      skip: !enabled || !immediate || !user,
      onSuccess,
      onError,
    }
  );

  const refreshDiscovery = useCallback(async () => {
    reset();
    return refetch();
  }, [refetch, reset]);

  const currentUserId = user?.id ?? null;
  const previousUserIdRef = useRef(currentUserId);
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = currentUserId;
    if (
      previousUserId === currentUserId ||
      previousUserId === null ||
      currentUserId === null ||
      !enabled ||
      !immediate
    ) {
      return;
    }
    void refreshDiscovery();
  }, [currentUserId, enabled, immediate, refreshDiscovery]);

  const resumeRevalidationRef = useRef<Promise<unknown> | null>(null);
  const resumeRevalidationQueuedRef = useRef(false);
  const resumeStartedAtRef = useRef(0);
  const [resumeRevalidationPending, setResumeRevalidationPending] =
    useState(false);

  const startResumeRevalidation = useCallback(() => {
    if (
      !enabled ||
      !immediate ||
      !user ||
      loading ||
      resumeRevalidationRef.current
    ) {
      return;
    }

    resumeRevalidationQueuedRef.current = false;
    setResumeRevalidationPending(true);
    resumeStartedAtRef.current = Date.now();
    const pending = refreshDiscovery();
    resumeRevalidationRef.current = pending;
    const settle = () => {
      if (resumeRevalidationRef.current !== pending) return;
      resumeRevalidationRef.current = null;
      if (!resumeRevalidationQueuedRef.current) {
        setResumeRevalidationPending(false);
      }
    };
    void pending.then(settle, settle);
  }, [enabled, immediate, loading, refreshDiscovery, user]);

  const revalidateOnResume = useCallback(() => {
    if (!enabled || !immediate || !user) return;

    setResumeRevalidationPending(true);

    if (resumeRevalidationRef.current) {
      // One tab switch raises `focus` and `visibilitychange` back to back, and
      // firing a request for each doubled load on an uncacheable route. Those
      // paired events describe the same resume, so collapse them.
      //
      // Anything arriving after that pairing window is a genuinely separate
      // resume, and the in-flight request cannot answer for it: the server may
      // have already read hold state before whatever changed. Dropping it
      // would lose a recheck, so queue it — a duplicate request is the cheap
      // failure here, a stale positive call is not.
      if (Date.now() - resumeStartedAtRef.current <= RESUME_COALESCE_MS) return;
      resumeRevalidationQueuedRef.current = true;
      return;
    }
    if (loading) {
      // Work that started BEFORE this resume (the initial fetch, or an options
      // refresh) can predate whatever changed while the tab was away, so it
      // cannot stand in for a recheck either.
      resumeRevalidationQueuedRef.current = true;
      return;
    }
    startResumeRevalidation();
  }, [enabled, immediate, loading, startResumeRevalidation, user]);

  useEffect(() => {
    if (!enabled || !immediate || !user) {
      resumeRevalidationQueuedRef.current = false;
      setResumeRevalidationPending(false);
      return;
    }
    if (
      !loading &&
      resumeRevalidationQueuedRef.current &&
      !resumeRevalidationRef.current
    ) {
      startResumeRevalidation();
    }
  }, [enabled, immediate, loading, startResumeRevalidation, user]);

  useEffect(() => {
    if (!enabled || !immediate || !user) return;

    const handleFocus = () => revalidateOnResume();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidateOnResume();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, immediate, revalidateOnResume, user]);

  // Refetch when options change (e.g., timeSlot) - debounced to prevent rapid clicks
  const prevOptionsHashRef = useRef(optionsHash);
  useEffect(() => {
    if (prevOptionsHashRef.current === optionsHash) {
      prevOptionsHashRef.current = optionsHash;
      return;
    }
    prevOptionsHashRef.current = optionsHash;
    if (!enabled || !immediate || !user) return;

    // Debounce to prevent rapid time slot switching from hitting rate limits
    reset();
    const timeoutId = setTimeout(() => {
      void refreshDiscovery();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [enabled, immediate, optionsHash, refreshDiscovery, reset, user]);

  useEffect(() => {
    const decision = freshData?.sessionDecision;
    if (
      !freshData ||
      freshData.recommendations.length === 0 ||
      !decision ||
      decision.verdict === "no"
    ) {
      return;
    }

    const expiresAt = Date.parse(decision.expiresAt);
    const authoredAt = Date.parse(decision.createdAt);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(authoredAt)) {
      reset();
      return;
    }

    const expireAndRevalidate = () => {
      if (enabled && immediate && user) {
        void refreshDiscovery();
        return;
      }
      reset();
    };
    // A client clock behind the server would stretch `expiresAt - now` far past
    // the authority the server actually granted. Both stamps are server-authored,
    // so their difference is skew-independent — bound the grant by it.
    const grantedMs = Math.min(expiresAt - Date.now(), expiresAt - authoredAt);
    if (grantedMs <= 0) {
      expireAndRevalidate();
      return;
    }

    // setTimeout coerces its delay to a signed 32-bit int, so authority running
    // past ~24.8 days would fire immediately and revalidate in a loop. Re-arm in
    // bounded hops, and let whichever limit runs out first end the grant: the
    // wall clock catches a hop delayed by a suspended tab, while the budget spent
    // down per hop catches a clock moved backward mid-session. Neither alone is
    // enough, and both can only shorten the grant.
    const deadline = Date.now() + grantedMs;
    let budgetMs = grantedMs;
    let timeoutId = 0;
    const armExpiry = () => {
      const remainingMs = Math.min(deadline - Date.now(), budgetMs);
      if (remainingMs <= 0) {
        expireAndRevalidate();
        return;
      }
      const hopMs = Math.min(remainingMs, MAX_TIMEOUT_DELAY_MS);
      budgetMs -= hopMs;
      timeoutId = window.setTimeout(armExpiry, hopMs);
    };
    armExpiry();
    return () => window.clearTimeout(timeoutId);
  }, [enabled, freshData, immediate, refreshDiscovery, reset, user]);

  const discovery = resumeRevalidationPending ? null : freshData;

  // Preserve the existing pull-to-refresh interface while ensuring any
  // pre-migration entries are removed before the fresh request.
  const clearCacheAndRefetch = useCallback(async () => {
    clearDiscoveryRecommendationCache();
    await refreshDiscovery();
  }, [refreshDiscovery]);

  return {
    discovery: discovery ?? null,
    loading: loading || resumeRevalidationPending,
    error,
    refetch: refreshDiscovery,
    hasRecommendations: discovery !== null && discovery.recommendations.length > 0,
    isCached: false,
    clearCacheAndRefetch,
  };
}

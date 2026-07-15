"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  getDiscoveryCacheKey,
  hasValidCache,
  hashDiscoveryOptions,
  writeToCache,
  type DiscoveryCacheOptions,
} from "@/lib/utils/discovery-cache-utils";
import type { SurfDiscoveryResponse, TimeSlot } from "@/types/personalization";

/**
 * All available time slots for prefetching
 */
const ALL_TIME_SLOTS: TimeSlot[] = ["any", "dawn-patrol", "lunch-session", "afternoon"];

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
  removeEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
};

function isPrefetchEnvironmentReady(): boolean {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }

  if (typeof navigator === "undefined") return true;
  if (navigator.onLine === false) return false;

  const connection = (navigator as Navigator & {
    connection?: NavigatorConnection;
  }).connection;

  if (connection?.saveData) return false;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
    return false;
  }

  return true;
}

/**
 * Options for useTimeSlotPrefetch hook
 */
interface UseTimeSlotPrefetchOptions {
  /** User's GPS location (required for discovery) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles */
  radiusMiles?: number;
  /** Hard cap for window start time in hours */
  horizonHours?: number;
  /** Maximum recommendations to return */
  maxResults?: number;
  /** Current active time slot (will be excluded from prefetch) */
  currentSlot: TimeSlot;
  /** Whether prefetching is enabled */
  enabled?: boolean;
  /** Called immediately before a time-slot request starts */
  onRequest?: (slot: TimeSlot) => void;
}

/**
 * Prefetch surf discovery data for all time slots in the background
 *
 * This hook improves perceived performance by pre-caching discovery data
 * for time slots the user hasn't selected yet. When they switch filters,
 * data loads instantly from cache instead of requiring a network request.
 *
 * Strategy:
 * - Waits 500ms after initial render to not block main content
 * - Uses requestIdleCallback (with setTimeout fallback for Safari)
 * - Pauses while hidden, offline, data-saving, or constrained and resumes when ready
 * - Fetches remaining time slots sequentially to avoid competing with active UI requests
 * - Skips slots that already have valid cache
 * - Silent failure - errors don't affect user experience
 * - Re-prefetches when user location changes significantly
 *
 * @example
 * ```tsx
 * useTimeSlotPrefetch({
 *   userLocation: { lat: 32.715, lon: -117.161 },
 *   horizonHours: 24,
 *   maxResults: 6,
 *   currentSlot: 'any',
 *   enabled: !discoveryLoading,
 * });
 * ```
 */
export function useTimeSlotPrefetch(options: UseTimeSlotPrefetchOptions): void {
  const {
    userLocation,
    radiusMiles,
    horizonHours,
    maxResults,
    currentSlot,
    enabled = true,
    onRequest,
  } = options;

  const { user } = useAuth();
  const prefetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const idleCallbackIdRef = useRef<number | null>(null);
  const prevLocationKeyRef = useRef<string | null>(null);
  const onRequestRef = useRef(onRequest);
  const [environmentReady, setEnvironmentReady] = useState(
    isPrefetchEnvironmentReady
  );
  onRequestRef.current = onRequest;

  useEffect(() => {
    const updateEnvironmentReady = (): void => {
      setEnvironmentReady(isPrefetchEnvironmentReady());
    };
    const connection = (navigator as Navigator & {
      connection?: NavigatorConnection;
    }).connection;

    document.addEventListener("visibilitychange", updateEnvironmentReady);
    window.addEventListener("online", updateEnvironmentReady);
    window.addEventListener("offline", updateEnvironmentReady);
    connection?.addEventListener?.("change", updateEnvironmentReady);
    updateEnvironmentReady();

    return () => {
      document.removeEventListener("visibilitychange", updateEnvironmentReady);
      window.removeEventListener("online", updateEnvironmentReady);
      window.removeEventListener("offline", updateEnvironmentReady);
      connection?.removeEventListener?.("change", updateEnvironmentReady);
    };
  }, []);

  // Reset prefetch tracking when location changes significantly (0.1 degree ~ 11km)
  const locationKey = userLocation
    ? `${userLocation.lat.toFixed(1)}_${userLocation.lon.toFixed(1)}`
    : "none";

  useEffect(() => {
    if (prevLocationKeyRef.current !== null && prevLocationKeyRef.current !== locationKey) {
      // Location changed - reset prefetch tracking to allow re-prefetch
      prefetchedRef.current = false;
    }
    prevLocationKeyRef.current = locationKey;
  }, [locationKey]);

  useEffect(() => {
    // Skip if not enabled, no user, already prefetched, or the browser is in a
    // context where background network work is likely to hurt the session.
    if (
      !enabled ||
      !user?.id ||
      prefetchedRef.current ||
      !environmentReady
    ) {
      return;
    }

    // Get slots to prefetch (exclude current slot)
    const slotsToFetch = ALL_TIME_SLOTS.filter((slot) => slot !== currentSlot);

    // Filter out slots that already have valid cache
    const slotsNeedingFetch = slotsToFetch.filter((slot) => {
      const cacheOptions: DiscoveryCacheOptions = {
        userLocation,
        radiusMiles,
        horizonHours,
        maxResults,
        timeSlot: slot,
      };
      const cacheKey = getDiscoveryCacheKey(user.id, cacheOptions);
      return !hasValidCache(cacheKey);
    });

    // All slots already cached - nothing to do
    if (slotsNeedingFetch.length === 0) {
      prefetchedRef.current = true;
      return;
    }

    // Schedule prefetch during idle time
    const scheduleIdleCallback = (callback: () => void): number => {
      // Use requestIdleCallback if available (Chrome, Firefox, Edge)
      if (typeof requestIdleCallback === "function") {
        return requestIdleCallback(callback, { timeout: 3000 });
      } else {
        // Safari and older browsers don't support requestIdleCallback
        // Use 1000ms timeout to ensure main content loads first
        return setTimeout(callback, 1000) as unknown as number;
      }
    };

    const cancelIdleCallbackSafe = (id: number) => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };

    // Delay prefetch to not compete with initial render
    const delayTimeoutId = setTimeout(() => {
      idleCallbackIdRef.current = scheduleIdleCallback(async () => {
        // Clear the ref since we're now executing
        idleCallbackIdRef.current = null;

        if (!isPrefetchEnvironmentReady()) return;

        // Create abort controller for cleanup
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        let interrupted = false;

        for (const slot of slotsNeedingFetch) {
          try {
            // Check abort signal before fetch
            if (signal.aborted || !isPrefetchEnvironmentReady()) {
              interrupted = true;
              break;
            }

            const cacheOptions: DiscoveryCacheOptions = {
              userLocation,
              radiusMiles,
              horizonHours,
              maxResults,
              timeSlot: slot,
            };

            // Build query parameters
            const params = new URLSearchParams();

            if (userLocation) {
              params.set("lat", userLocation.lat.toString());
              params.set("lon", userLocation.lon.toString());
            }

            if (radiusMiles) {
              params.set("radius", radiusMiles.toString());
            }

            if (maxResults) {
              params.set("maxResults", maxResults.toString());
            }

            if (horizonHours) {
              params.set("horizonHours", horizonHours.toString());
            }

            params.set("timeSlot", slot);

            const queryString = params.toString();
            const url = `/api/surf/discover${queryString ? `?${queryString}` : ""}`;

            onRequestRef.current?.(slot);
            const response = await fetch(url, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              signal,
            });

            // Check abort signal after fetch
            if (signal.aborted || !isPrefetchEnvironmentReady()) {
              interrupted = true;
              break;
            }

            if (!response.ok) {
              // Silent failure - just skip this slot
              continue;
            }

            const result = await response.json();

            // Check abort signal after parsing
            if (signal.aborted || !isPrefetchEnvironmentReady()) {
              interrupted = true;
              break;
            }

            // Transform date strings to Date objects
            if (result.data?.recommendations) {
              result.data.recommendations = result.data.recommendations.map(
                (rec: any) => ({
                  ...rec,
                  window: {
                    ...rec.window,
                    start: new Date(rec.window.start),
                    end: new Date(rec.window.end),
                  },
                })
              );
            }

            const discoveryData = result.data as SurfDiscoveryResponse;

            // Write to cache
            const cacheKey = getDiscoveryCacheKey(user.id, cacheOptions);
            const optionsHash = hashDiscoveryOptions(cacheOptions);
            writeToCache(cacheKey, discoveryData, optionsHash);
          } catch (error) {
            // Silent failure - prefetch errors shouldn't affect UX
            if (
              signal.aborted ||
              !isPrefetchEnvironmentReady() ||
              (error instanceof Error && error.name === "AbortError")
            ) {
              interrupted = true;
              break;
            }
            if (error instanceof Error) {
              console.debug(`Prefetch for ${slot} failed:`, error.message);
            }
          }
        }

        if (!interrupted) {
          prefetchedRef.current = true;
        }
      });
    }, 500);

    // Cleanup function
    return () => {
      clearTimeout(delayTimeoutId);

      // Cancel idle callback if it hasn't fired yet
      if (idleCallbackIdRef.current !== null) {
        cancelIdleCallbackSafe(idleCallbackIdRef.current);
        idleCallbackIdRef.current = null;
      }

      // Abort any in-flight fetches
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    enabled,
    environmentReady,
    user?.id,
    currentSlot,
    locationKey,
    userLocation,
    radiusMiles,
    horizonHours,
    maxResults,
  ]);
}

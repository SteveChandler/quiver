"use client";

import { useEffect, useRef } from "react";
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
const ALL_TIME_SLOTS: TimeSlot[] = ["any", "dawn-patrol", "morning", "afternoon"];

/**
 * Options for useTimeSlotPrefetch hook
 */
interface UseTimeSlotPrefetchOptions {
  /** User's GPS location */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles */
  radiusMiles?: number;
  /** Hard cap for window start time in hours */
  horizonHours?: number;
  /** Maximum recommendations to return */
  maxResults?: number;
  /** Include home beach in results */
  includeHome?: boolean;
  /** Current active time slot (will be excluded from prefetch) */
  currentSlot: TimeSlot;
  /** Whether prefetching is enabled */
  enabled?: boolean;
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
 * - Fetches remaining 3 time slots in parallel
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
 *   includeHome: true,
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
    includeHome,
    currentSlot,
    enabled = true,
  } = options;

  const { user } = useAuth();
  const prefetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const idleCallbackIdRef = useRef<number | null>(null);
  const prevLocationKeyRef = useRef<string | null>(null);

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
    // Skip if not enabled, no user, or already prefetched
    if (!enabled || !user?.id || prefetchedRef.current) return;

    // Get slots to prefetch (exclude current slot)
    const slotsToFetch = ALL_TIME_SLOTS.filter((slot) => slot !== currentSlot);

    // Filter out slots that already have valid cache
    const slotsNeedingFetch = slotsToFetch.filter((slot) => {
      const cacheOptions: DiscoveryCacheOptions = {
        userLocation,
        radiusMiles,
        horizonHours,
        maxResults,
        includeHome,
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
      // Fall back to setTimeout for Safari and older browsers
      if (typeof requestIdleCallback === "function") {
        return requestIdleCallback(callback, { timeout: 3000 });
      } else {
        return setTimeout(callback, 500) as unknown as number;
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

        // Create abort controller for cleanup
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Fetch all slots in parallel
        const fetchPromises = slotsNeedingFetch.map(async (slot) => {
          try {
            // Check abort signal before fetch
            if (signal.aborted) return;

            const cacheOptions: DiscoveryCacheOptions = {
              userLocation,
              radiusMiles,
              horizonHours,
              maxResults,
              includeHome,
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

            if (includeHome !== undefined) {
              params.set("includeHome", includeHome.toString());
            }

            params.set("timeSlot", slot);

            const queryString = params.toString();
            const url = `/api/surf/discover${queryString ? `?${queryString}` : ""}`;

            const response = await fetch(url, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              signal,
            });

            // Check abort signal after fetch
            if (signal.aborted) return;

            if (!response.ok) {
              // Silent failure - just skip this slot
              return;
            }

            const result = await response.json();

            // Check abort signal after parsing
            if (signal.aborted) return;

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
            // AbortError is expected during cleanup
            if (error instanceof Error && error.name !== "AbortError") {
              console.debug(`Prefetch for ${slot} failed:`, error.message);
            }
          }
        });

        await Promise.allSettled(fetchPromises);
        prefetchedRef.current = true;
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
    user?.id,
    currentSlot,
    locationKey,
    userLocation,
    radiusMiles,
    horizonHours,
    maxResults,
    includeHome,
  ]);
}

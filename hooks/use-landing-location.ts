"use client";

import { useLocationSafe } from "@/context/location-context";
import { DEFAULT_LOCATION } from "@/lib/location/ip-location";

/**
 * Simplified hook for landing page components.
 *
 * Returns display-ready location information without requiring
 * the full location context. Falls back gracefully if used
 * outside the LocationProvider.
 *
 * @example
 * const { regionName, isLoading } = useLandingLocation();
 * return <span>Local favorites near {regionName}</span>;
 */
export function useLandingLocation() {
  const locationContext = useLocationSafe();

  // If outside provider, return default location
  if (!locationContext) {
    return {
      regionName: DEFAULT_LOCATION.displayName,
      isLoading: false,
      requestLocation: () => Promise.resolve(),
      hasPreciseLocation: false,
      locationError: null,
    };
  }

  const { location, requestPreciseLocation, hasPreciseLocation, locationError } = locationContext;

  return {
    /** Display name for the current region (e.g., "San Diego", "Orange County") */
    regionName: location.displayName,

    /** Whether location is still being determined */
    isLoading: location.isLoading,

    /** Request browser geolocation (triggers permission prompt) */
    requestLocation: requestPreciseLocation,

    /** Whether browser geolocation has been granted */
    hasPreciseLocation,

    /** Error message from browser geolocation (if any) */
    locationError,
  };
}

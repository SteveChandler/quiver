import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Coordinates } from "@/lib/types/coordinates";
import { calculateDistance } from "@/lib/utils/distance-utils";

// Default to Ocean Beach, San Diego coordinates (ultimate fallback)
const OCEAN_BEACH_COORDS: Coordinates = {
  lat: 32.7503,
  lon: -117.2534,
};

// Safety timeout for iOS/mobile where geolocation can hang
const SAFETY_TIMEOUT_MS = 10000; // 10 seconds

// Polling defaults for traveling user detection
const DEFAULT_POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MIN_DISTANCE_CHANGE_METERS = 1000;   // 1 km

type GeoSource = "browser" | "lastUsedBeach" | "default";

const DEFAULT_LAST_BEACH_KEY = "quiver:lastBeach";

type LastBeachMeta = Coordinates & {
  id?: string;
  name?: string;
};

export type GeolocationErrorType = 'denied' | 'unavailable' | 'timeout' | null;

interface GeolocationState {
  userLocation: Coordinates | null;
  locationError: string | null;
  errorType: GeolocationErrorType;
  usingDefaultLocation: boolean;
  loading: boolean;
  hasTimedOut: boolean;
  source: GeoSource;
}

interface UseGeolocationOptions {
  defaultLocation?: Coordinates | null;
  /** If false, do NOT auto-request browser geolocation on mount (home screen behavior). */
  autoRequest?: boolean;
  /** localStorage key for "last used beach" fallback. */
  lastBeachStorageKey?: string;
  /** Enable periodic location polling for traveling user detection. Default: false */
  enablePolling?: boolean;
  /** Polling interval in milliseconds. Default: 300000 (5 minutes) */
  pollingIntervalMs?: number;
  /** Minimum distance change in meters to trigger location update. Default: 1000 (1 km) */
  minDistanceChangeMeters?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    defaultLocation,
    autoRequest = true,
    lastBeachStorageKey = DEFAULT_LAST_BEACH_KEY,
    enablePolling = false,
    pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
    minDistanceChangeMeters = DEFAULT_MIN_DISTANCE_CHANGE_METERS,
  } = options;

  const readLastBeach = useCallback((): LastBeachMeta | null => {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(lastBeachStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lon === "number"
      ) {
        return parsed as LastBeachMeta;
      }
      return null;
    } catch {
      return null;
    }
  }, [lastBeachStorageKey]);

  const setLastBeach = useCallback(
    (beach: LastBeachMeta) => {
      try {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(lastBeachStorageKey, JSON.stringify(beach));
      } catch {
        // ignore
      }
    },
    [lastBeachStorageKey]
  );

  const lastBeach = useMemo(() => readLastBeach(), [readLastBeach]);

  // Fallback chain: last used beach → provided default → Ocean Beach
  const fallbackCoords: Coordinates = lastBeach ?? defaultLocation ?? OCEAN_BEACH_COORDS;
  const fallbackSource: GeoSource = lastBeach ? "lastUsedBeach" : "default";

  const [state, setState] = useState<GeolocationState>({
    userLocation: fallbackCoords, // Start with fallback
    locationError: null,
    errorType: null,
    usingDefaultLocation: true, // Start as default
    loading: autoRequest, // Only loading if we'll auto-request
    hasTimedOut: false,
    source: fallbackSource,
  });

  const hasAttemptedRef = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout>();
  const isRequestInFlightRef = useRef(false); // Track active geolocation requests

  const useDefaultLocation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      usingDefaultLocation: true,
      userLocation: fallbackCoords,
      locationError: null,
      errorType: null,
      loading: false,
      hasTimedOut: false,
      source: fallbackSource,
    }));
  }, [fallbackCoords, fallbackSource]);

  const resetAttempt = useCallback(() => {
    hasAttemptedRef.current = false;
    setState((prev) => ({
      ...prev,
      hasTimedOut: false,
      locationError: null,
      errorType: null,
    }));
  }, []);

  const getUserLocation = useCallback(async (forceRetry = false): Promise<void> => {
    // Prevent multiple simultaneous requests (unless force retry)
    if (isRequestInFlightRef.current && !forceRetry) {
      return;
    }

    if (hasAttemptedRef.current && !forceRetry) return;
    hasAttemptedRef.current = true;
    isRequestInFlightRef.current = true;

    // Mark as loading for explicit requests too
    setState((prev) => ({ ...prev, loading: true }));

    // Safety timeout - force fallback if geolocation hangs (common on iOS simulator)
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn(
        "[useGeolocation] Safety timeout reached - using fallback location"
      );
      isRequestInFlightRef.current = false; // Clear in-flight flag
      // Log timeout event for monitoring
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "geolocation_timeout", {
          event_category: "geolocation",
          event_label: "safety_timeout",
          value: SAFETY_TIMEOUT_MS,
        });
      }
      setState((prev) => ({
        ...prev,
        usingDefaultLocation: true,
        userLocation: fallbackCoords,
        locationError: "Location request timed out - using fallback location",
        errorType: 'timeout',
        loading: false,
        hasTimedOut: true,
        source: fallbackSource,
      }));
    }, SAFETY_TIMEOUT_MS);

    if (typeof window === "undefined" || !navigator.geolocation) {
      clearTimeout(safetyTimeoutRef.current);
      isRequestInFlightRef.current = false;
      setState((prev) => ({
        ...prev,
        locationError: "Location services not supported",
        errorType: 'unavailable',
        loading: false,
        source: fallbackSource,
      }));
      return;
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000, // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(safetyTimeoutRef.current);
        isRequestInFlightRef.current = false; // Clear in-flight flag
        const { latitude, longitude } = position.coords;

        setState((prev) => ({
          ...prev,
          userLocation: { lat: latitude, lon: longitude },
          usingDefaultLocation: false,
          locationError: null,
          errorType: null,
          loading: false,
          hasTimedOut: false,
          source: "browser",
        }));
      },
      (error) => {
        clearTimeout(safetyTimeoutRef.current);
        isRequestInFlightRef.current = false; // Clear in-flight flag
        let errorMessage = "Location access denied";
        let errorType: GeolocationErrorType = 'denied';

        if (error.code === error.PERMISSION_DENIED) {
          errorType = 'denied';
          errorMessage = "Location access denied - using default location";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorType = 'unavailable';
          errorMessage = "Location unavailable - using default location";
        } else if (error.code === error.TIMEOUT) {
          errorType = 'timeout';
          errorMessage = "Location request timed out - using default location";
        }

        console.warn("[useGeolocation] Error:", error.message);
        setState((prev) => ({
          ...prev,
          locationError: errorMessage,
          errorType,
          loading: false,
          usingDefaultLocation: true,
          userLocation: fallbackCoords,
          hasTimedOut: false, // Distinguish from safety timeout
          source: fallbackSource,
        }));
      },
      options
    );
  }, [fallbackCoords, fallbackSource]);

  useEffect(() => {
    if (autoRequest) {
      getUserLocation();
    } else {
      // Mirror HomeScreen behavior: no auto prompt, but we should ensure loading is false.
      setState((prev) => ({ ...prev, loading: false }));
    }

    // Cleanup safety timeout on unmount
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Polling effect for traveling user detection
  useEffect(() => {
    // Only poll when enabled AND we have a valid browser-sourced location
    if (!enablePolling || !state.userLocation || state.source !== 'browser') return;

    let pollingInterval: NodeJS.Timeout | null = null;

    const checkLocationChange = () => {
      // Only poll when app is visible (foreground)
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      // Don't check if geolocation is unavailable
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLon = position.coords.longitude;
          const currentLat = state.userLocation?.lat ?? 0;
          const currentLon = state.userLocation?.lon ?? 0;

          const distance = calculateDistance(
            { lat: currentLat, lon: currentLon },
            { lat: newLat, lon: newLon },
            "meters"
          );

          // Only update if user has moved beyond threshold
          if (distance >= minDistanceChangeMeters) {
            setState(prev => ({
              ...prev,
              userLocation: { lat: newLat, lon: newLon },
              source: 'browser',
              usingDefaultLocation: false,
            }));
          }
        },
        () => {}, // Silent fail on polling errors - don't disrupt UX
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    };

    const handleVisibilityChange = () => {
      // Immediately check location when app returns to foreground
      if (document.visibilityState === 'visible') {
        checkLocationChange();
      }
    };

    // Set up visibility change listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Start polling interval
    pollingInterval = setInterval(checkLocationChange, pollingIntervalMs);

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enablePolling, state.userLocation, state.source, pollingIntervalMs, minDistanceChangeMeters]);

  return {
    ...state,
    getUserLocation,
    useDefaultLocation,
    resetAttempt,
    // Compatibility layer for `useGeo` consumers (Home / Nearby chips)
    coords: state.userLocation,
    error: state.locationError,
    requestLocation: () => {
      void getUserLocation(true);
    },
    setLastBeach,
  };
}

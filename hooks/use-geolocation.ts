import { useState, useEffect, useCallback, useRef } from "react";

// Default to Ocean Beach, San Diego coordinates (ultimate fallback)
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

// Safety timeout for iOS/mobile where geolocation can hang
const SAFETY_TIMEOUT_MS = 10000; // 10 seconds

interface GeolocationState {
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;
  usingDefaultLocation: boolean;
  loading: boolean;
  hasTimedOut: boolean;
}

interface UseGeolocationOptions {
  defaultLocation?: { lat: number; lng: number } | null;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { defaultLocation } = options;

  // Fallback chain: user's home beach → Ocean Beach
  const fallbackLat = defaultLocation?.lat ?? OCEAN_BEACH_LAT;
  const fallbackLng = defaultLocation?.lng ?? OCEAN_BEACH_LNG;

  const [state, setState] = useState<GeolocationState>({
    userLocation: { lat: fallbackLat, lng: fallbackLng }, // Start with fallback
    locationError: null,
    usingDefaultLocation: true, // Start as default
    loading: true,
    hasTimedOut: false,
  });

  const hasAttemptedRef = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout>();

  const useDefaultLocation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      usingDefaultLocation: true,
      userLocation: { lat: fallbackLat, lng: fallbackLng },
      locationError: null,
      loading: false,
      hasTimedOut: false,
    }));
  }, [fallbackLat, fallbackLng]);

  const resetAttempt = useCallback(() => {
    hasAttemptedRef.current = false;
    setState((prev) => ({
      ...prev,
      hasTimedOut: false,
      locationError: null,
    }));
  }, []);

  const getUserLocation = useCallback(async (forceRetry = false): Promise<void> => {
    // Prevent multiple simultaneous requests (unless force retry)
    if (hasAttemptedRef.current && !forceRetry) return;
    hasAttemptedRef.current = true;

    // Safety timeout - force fallback if geolocation hangs (common on iOS simulator)
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn(
        "[useGeolocation] Safety timeout reached - using fallback location"
      );
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
        userLocation: { lat: fallbackLat, lng: fallbackLng },
        locationError: "Location request timed out - using fallback location",
        loading: false,
        hasTimedOut: true,
      }));
    }, SAFETY_TIMEOUT_MS);

    if (typeof window === "undefined" || !navigator.geolocation) {
      clearTimeout(safetyTimeoutRef.current);
      setState((prev) => ({
        ...prev,
        locationError: "Location services not supported",
        loading: false,
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
        const { latitude, longitude } = position.coords;

        setState((prev) => ({
          ...prev,
          userLocation: { lat: latitude, lng: longitude },
          usingDefaultLocation: false,
          locationError: null,
          loading: false,
          hasTimedOut: false,
        }));
      },
      (error) => {
        clearTimeout(safetyTimeoutRef.current);
        let errorMessage = "Location access denied";

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied - using default location";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Location unavailable - using default location";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out - using default location";
        }

        console.warn("[useGeolocation] Error:", error.message);
        setState((prev) => ({
          ...prev,
          locationError: errorMessage,
          loading: false,
          // Keep default location from initial state
        }));
      },
      options
    );
  }, []);

  useEffect(() => {
    getUserLocation();

    // Cleanup safety timeout on unmount
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return {
    ...state,
    getUserLocation,
    useDefaultLocation,
    resetAttempt,
  };
}

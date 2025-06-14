import { useState, useEffect, useCallback } from "react";

// Default to Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

interface GeolocationState {
  userLocation: { lat: number; lng: number } | null;
  locationError: string | null;
  usingDefaultLocation: boolean;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    userLocation: null,
    locationError: null,
    usingDefaultLocation: false,
    loading: true,
  });

  const useDefaultLocation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      usingDefaultLocation: true,
      userLocation: { lat: OCEAN_BEACH_LAT, lng: OCEAN_BEACH_LNG },
      locationError: null,
      loading: false,
    }));
  }, []);

  const getUserLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, locationError: null, loading: true }));

    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        locationError: "Location services not supported by your browser",
        loading: false,
      }));
      useDefaultLocation();
      return;
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000, // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(
          `✅ Location found: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
        );
        setState((prev) => ({
          ...prev,
          userLocation: { lat: latitude, lng: longitude },
          usingDefaultLocation: false,
          locationError: null,
          loading: false,
        }));
      },
      (error) => {
        console.log("📍 Location unavailable, using San Diego default");
        let errorMessage = "Location access denied";

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage =
            "Location access is blocked. Please click the lock icon in your browser's address bar and allow location access.";
        }

        setState((prev) => ({
          ...prev,
          locationError: errorMessage,
          loading: false,
        }));
        useDefaultLocation();
      },
      options
    );
  }, [useDefaultLocation]);

  // Get location on mount
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  return {
    ...state,
    getUserLocation,
    useDefaultLocation,
  };
}

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

  const getUserLocation = useCallback(async (): Promise<void> => {
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

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          setState((prev) => ({
            ...prev,
            userLocation: { lat: latitude, lng: longitude },
            usingDefaultLocation: false,
            locationError: null,
            loading: false,
          }));
          resolve();
        },
        (error) => {
          let errorMessage = "Location access denied";

          if (error.code === error.PERMISSION_DENIED) {
            errorMessage =
              "Location access is blocked. Please enable location permissions in your browser settings or click the location icon in the address bar.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = "Location information is unavailable.";
          } else if (error.code === error.TIMEOUT) {
            errorMessage = "Location request timed out.";
          }

          console.warn("Geolocation error:", error.message);
          setState((prev) => ({
            ...prev,
            locationError: errorMessage,
            loading: false,
          }));
          useDefaultLocation();
          resolve();
        },
        options
      );
    });
  }, [useDefaultLocation]);

  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  return {
    ...state,
    getUserLocation,
    useDefaultLocation,
  };
}

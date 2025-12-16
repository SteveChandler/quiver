"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { IPLocationData, ResolvedLocation, LocationSource } from "@/lib/location/types";
import { IP_LOCATION_COOKIE } from "@/lib/location/types";
import {
  parseIPLocationCookie,
  matchToMetroArea,
  DEFAULT_LOCATION,
} from "@/lib/location/ip-location";

/**
 * LocationContext provides IP-based and browser location throughout the application.
 *
 * Two-tier location system:
 * 1. IP-based location (automatic, no permission needed)
 * 2. Browser geolocation (on user action, requires permission)
 *
 * The landing page uses IP-based location for initial display,
 * then can upgrade to browser geolocation when user interacts.
 */

interface LocationContextType {
  /** Current resolved location for display */
  location: ResolvedLocation;

  /** Raw IP location data (if available) */
  ipLocation: IPLocationData | null;

  /** Request precise browser location (triggers permission prompt) */
  requestPreciseLocation: () => Promise<void>;

  /** Whether browser geolocation has been granted */
  hasPreciseLocation: boolean;

  /** Error message from browser geolocation (if any) */
  locationError: string | null;

  /** Clear the location error */
  clearError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

/**
 * Get cookie value by name (client-side only)
 */
function getCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return undefined;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [ipLocation, setIPLocation] = useState<IPLocationData | null>(null);
  const [browserCoords, setBrowserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasPreciseLocation, setHasPreciseLocation] = useState(false);

  // Initialize from cookie on mount
  useEffect(() => {
    const cookieValue = getCookieValue(IP_LOCATION_COOKIE);
    const parsedLocation = parseIPLocationCookie(cookieValue);

    if (parsedLocation) {
      setIPLocation(parsedLocation);
    }

    setIsLoading(false);
  }, []);

  // Compute resolved location
  const location = useMemo<ResolvedLocation>(() => {
    // Priority 1: Browser geolocation (if available)
    if (browserCoords) {
      // Try to match browser coords to a metro
      const metro = matchToMetroArea({
        city: null,
        region: null,
        country: null,
        latitude: browserCoords.lat,
        longitude: browserCoords.lon,
      });

      return {
        displayName: metro.displayName,
        coordinates: browserCoords,
        source: "browser" as LocationSource,
        isLoading: false,
      };
    }

    // Priority 2: IP geolocation
    if (ipLocation) {
      const metro = matchToMetroArea(ipLocation);
      return {
        displayName: metro.displayName,
        coordinates: metro.coordinates,
        source: "ip" as LocationSource,
        isLoading: false,
      };
    }

    // Priority 3: Default (still loading or no data)
    return {
      displayName: DEFAULT_LOCATION.displayName,
      coordinates: DEFAULT_LOCATION.coordinates,
      source: "default" as LocationSource,
      isLoading,
    };
  }, [ipLocation, browserCoords, isLoading]);

  // Request browser geolocation
  const requestPreciseLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        });
      });

      setBrowserCoords({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
      setHasPreciseLocation(true);
      setLocationError(null);
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
          setLocationError("Location permission denied. Using approximate location.");
          break;
        case geoError.POSITION_UNAVAILABLE:
          setLocationError("Location unavailable. Using approximate location.");
          break;
        case geoError.TIMEOUT:
          setLocationError("Location request timed out. Using approximate location.");
          break;
        default:
          setLocationError("Unable to get your location. Using approximate location.");
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setLocationError(null);
  }, []);

  const value = useMemo<LocationContextType>(
    () => ({
      location,
      ipLocation,
      requestPreciseLocation,
      hasPreciseLocation,
      locationError,
      clearError,
    }),
    [location, ipLocation, requestPreciseLocation, hasPreciseLocation, locationError, clearError]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook to access location context.
 *
 * @throws Error if used outside LocationProvider
 */
export function useLocation(): LocationContextType {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}

/**
 * Hook to access location context safely (returns null if outside provider).
 * Useful for components that may be rendered outside the provider.
 */
export function useLocationSafe(): LocationContextType | null {
  return useContext(LocationContext) ?? null;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GeoSource = "browser" | "lastUsedBeach" | "default";

interface Coordinates {
  lat: number;
  lon: number;
}

interface LastBeachMeta extends Coordinates {
  id?: string;
  name?: string;
}

interface UseGeoOptions {
  defaultCoords?: Coordinates; // Fallback when nothing else available
  lastBeachStorageKey?: string; // localStorage key for last used beach
  highAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

interface UseGeoResult {
  coords: Coordinates | null;
  loading: boolean;
  error: string | null;
  source: GeoSource;
  // Request browser geolocation permission and update coords if allowed
  requestLocation: () => void;
  // Helper to persist a "last used" beach for future fallback
  setLastBeach: (beach: LastBeachMeta) => void;
}

const DEFAULT_COORDS: Coordinates = { lat: 32.8473, lon: -117.2750 }; // La Jolla, CA approx
const DEFAULT_KEY = "quiver:lastBeach";

export function useGeo(options: UseGeoOptions = {}): UseGeoResult {
  const {
    defaultCoords = DEFAULT_COORDS,
    lastBeachStorageKey = DEFAULT_KEY,
    highAccuracy = true,
    timeoutMs = 12000,
    maximumAgeMs = 60_000,
  } = options;

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [source, setSource] = useState<GeoSource>("default");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef<boolean>(false);

  // Read last-used beach from localStorage (client only)
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

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation not available in this environment");
      return;
    }
    setLoading(true);
    requestedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
        setSource("browser");
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err?.message || "Unable to retrieve location");
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
      }
    );
  }, [highAccuracy, maximumAgeMs, timeoutMs]);

  // Initial fallback resolution (last-used beach -> default). We do not auto-request permission.
  useEffect(() => {
    // If coords already set (e.g., due to prior request), skip
    if (coords) return;
    const last = readLastBeach();
    if (last) {
      setCoords({ lat: last.lat, lon: last.lon });
      setSource("lastUsedBeach");
      return;
    }
    setCoords(defaultCoords);
    setSource("default");
  }, [coords, defaultCoords, readLastBeach]);

  return {
    coords,
    loading,
    error,
    source,
    requestLocation,
    setLastBeach,
  };
}


"use client";

import { useState, useEffect, useCallback } from "react";

const LAST_BEACH_KEY = "quiver:lastBeach";

export type BeachSource = "url" | "lastUsed" | "gps" | null;

interface NearestBeachResult {
  beach: { id: string; name: string } | null;
  source: BeachSource;
  loading: boolean;
  /** High confidence = auto-select; low = show confirmation chip */
  confidence: "high" | "low" | null;
}

interface UseNearestBeachOptions {
  /** Beach ID from URL params (highest priority) */
  urlBeachId?: string;
  /** Beach name from URL params */
  urlBeachName?: string;
  /** Skip GPS detection entirely */
  skipGps?: boolean;
}

/**
 * Auto-detect beach with priority chain:
 * 1. URL param (deep links)
 * 2. localStorage quiver:lastBeach (written after each session save)
 * 3. GPS via /api/beaches/nearby
 * 4. null (manual search)
 */
export function useNearestBeach(
  options: UseNearestBeachOptions = {}
): NearestBeachResult {
  const { urlBeachId, urlBeachName, skipGps = false } = options;

  const [result, setResult] = useState<NearestBeachResult>({
    beach: null,
    source: null,
    loading: true,
    confidence: null,
  });

  const resolveBeach = useCallback(async () => {
    // 1. URL param (highest priority, highest confidence)
    if (urlBeachId && urlBeachName) {
      setResult({
        beach: { id: urlBeachId, name: urlBeachName },
        source: "url",
        loading: false,
        confidence: "high",
      });
      return;
    }

    // 2. Last used beach from localStorage
    try {
      const raw = localStorage.getItem(LAST_BEACH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id && parsed?.name) {
          setResult({
            beach: { id: parsed.id, name: parsed.name },
            source: "lastUsed",
            loading: false,
            confidence: "high",
          });
          return;
        }
      }
    } catch {
      // ignore
    }

    // 3. GPS-based nearest beach
    if (
      !skipGps &&
      typeof window !== "undefined" &&
      navigator.geolocation
    ) {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 300000, // 5 min cache OK for beach detection
            });
          }
        );

        const { latitude, longitude } = position.coords;
        const res = await fetch(
          `/api/beaches/nearby?lat=${latitude}&lon=${longitude}&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          const nearest = data?.beaches?.[0] ?? data?.[0];
          if (nearest?.id && nearest?.name) {
            setResult({
              beach: { id: nearest.id, name: nearest.name },
              source: "gps",
              loading: false,
              confidence: "low", // GPS = show confirmation
            });
            return;
          }
        }
      } catch {
        // GPS failed — fall through to null
      }
    }

    // 4. No beach detected
    setResult({
      beach: null,
      source: null,
      loading: false,
      confidence: null,
    });
  }, [urlBeachId, urlBeachName, skipGps]);

  useEffect(() => {
    void resolveBeach();
  }, [resolveBeach]);

  return result;
}

/**
 * Write the last-used beach to localStorage for future auto-detection.
 */
export function saveLastBeach(beach: { id: string; name: string }) {
  try {
    localStorage.setItem(LAST_BEACH_KEY, JSON.stringify(beach));
  } catch {
    // ignore
  }
}

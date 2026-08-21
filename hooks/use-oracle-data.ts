"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";
import {
  FALLBACK_IMAGE_BY_NAME,
} from "@/lib/constants/featured-beaches-config";
import type { Profile, Beach } from "@/types/database";
import type {
  SurfDiscoveryResponse,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";

// ============================================================================
// Types
// ============================================================================

export type SessionTimePreference =
  | "dawn_patrol"
  | "morning"
  | "lunch"
  | "afternoon"
  | "evening"
  | "any";

export interface OracleData {
  profile: Profile | null;
  /** True while the profile fetch is in flight (cache may still expose a profile). */
  profileLoading: boolean;
  homeBeach: Beach | null;
  refreshProfile: () => void;
  heroPhotoUrl: string;
  heroPhotoLoading: boolean;
  discovery: SurfDiscoveryResponse | null;
  discoveryLoading: boolean;
  /** Hard error from the discovery query, if any. Used to distinguish "still bootstrapping" from "real failure." */
  discoveryError: string | null;
  topRecommendation: SurfDiscoveryRecommendation | null;
  remainingSpots: SurfDiscoveryRecommendation[];
  shouldAnimate: boolean;
  markAnimationPlayed: () => void;
  reducedMotion: boolean;
  userLocation: { lat: number; lon: number };
  geoSource: string;
  requestLocation: () => void;
  geoLoading: boolean;
  /** Parsed user skill level from profile (for frontend skill comparisons) */
  userSkillLevel: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOCATION = { lat: 32.715, lon: -117.161 }; // San Diego

/** Abstract aerial ocean — used when no beach-specific photo is available. */
const FALLBACK_HERO_IMAGE = "/images/hero/hero-5-aerial-ocean.webp";

const LAST_ORACLE_REVEAL_KEY = "lastOracleReveal";

// ============================================================================
// Helpers
// ============================================================================

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Resolves the best hero photo URL for a beach.
 *
 * Resolution order:
 * 1. FALLBACK_IMAGE_BY_NAME keyed by beach name (instant, no async call needed)
 * 2. Return null to signal that an async beach-photo fetch is required
 */
function getFallbackImageForBeach(beach: Beach | null): string | null {
  if (!beach) return null;
  const key = beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME;
  return FALLBACK_IMAGE_BY_NAME[key] ?? null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Aggregates all data needed for the oracle hero screen.
 *
 * Composes:
 * - useCachedProfile — profile + home beach
 * - useGeolocation — GPS with fallback chain (GPS > home beach > San Diego)
 * - useSurfDiscovery — surf recommendations
 * - Beach photo fetching — with three-tier fallback
 * - Animation state — first-visit-of-day detection via localStorage
 * - useReducedMotion — respects prefers-reduced-motion
 */
export function useOracleData(): OracleData {
  const recordHomeDiscoveryRequest = useHomeDiscoveryRequestMetrics();

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  const { profile, homeBeach, refreshProfile, profileLoading } = useCachedProfile();

  // ------------------------------------------------------------------
  // Geolocation — explicit GPS > home beach > San Diego default
  // ------------------------------------------------------------------
  const homeBeachCoords = useMemo(() => {
    if (homeBeach?.lat != null && homeBeach?.lon != null) {
      return { lat: homeBeach.lat, lon: homeBeach.lon };
    }
    return null;
  }, [homeBeach?.lat, homeBeach?.lon]);

  const {
    coords: geoCoords,
    loading: geoLoading,
    source: geoSource,
    usingDefaultLocation,
    requestLocation,
  } = useGeolocation({
    autoRequest: false,
    enablePolling: true,
    pollingIntervalMs: 5 * 60 * 1000,
    minDistanceChangeMeters: 1000,
    monitoringContext: "home",
    defaultLocation: homeBeachCoords ?? DEFAULT_LOCATION,
  });

  // Resolve effective user location with fallback chain
  const userLocation = useMemo((): { lat: number; lon: number } => {
    // GPS has priority when it's a fresh browser fix
    if (
      geoSource === "browser" &&
      !usingDefaultLocation &&
      geoCoords?.lat != null &&
      geoCoords?.lon != null
    ) {
      return { lat: geoCoords.lat, lon: geoCoords.lon };
    }
    // Home beach as secondary fallback
    if (homeBeachCoords != null) {
      return homeBeachCoords;
    }
    return DEFAULT_LOCATION;
  }, [geoSource, usingDefaultLocation, geoCoords?.lat, geoCoords?.lon, homeBeachCoords]);

  // ------------------------------------------------------------------
  // Skill level (parsed from profile for cache invalidation + frontend display)
  // ------------------------------------------------------------------
  const userSkillLevel = (profile as Record<string, unknown> | null)?.experience_level as string | null ?? null;

  // ------------------------------------------------------------------
  // Surf discovery
  // ------------------------------------------------------------------
  const {
    discovery: primaryDiscovery,
    loading: primaryLoading,
    error: primaryError,
  } = useSurfDiscovery({
    maxResults: 10,
    horizonHours: 24,
    enabled: !!profile && !geoLoading,
    immediate: true,
    suppressInitialResume: true,
    userLocation,
    userSkillLevel,
    onRequest: () => recordHomeDiscoveryRequest("primary"),
  });

  // Fallback: if the user's location returns nothing (e.g. Nazaré, inland US,
  // anywhere without Quiver coverage), retry with San Diego so they see a hero
  // instead of an empty state. Skip when the primary query is already SD.
  const primaryRecommendationUnavailable =
    primaryDiscovery?.recommendationAvailability?.state === "none";
  const primaryReturnedEmpty =
    primaryDiscovery !== null &&
    !primaryRecommendationUnavailable &&
    (primaryDiscovery.recommendations?.length ?? 0) === 0;
  const alreadySanDiego =
    userLocation.lat === DEFAULT_LOCATION.lat &&
    userLocation.lon === DEFAULT_LOCATION.lon;

  const {
    discovery: fallbackDiscovery,
    loading: fallbackLoading,
    error: fallbackError,
  } = useSurfDiscovery({
    maxResults: 10,
    horizonHours: 24,
    enabled: !!profile && !geoLoading && primaryReturnedEmpty && !alreadySanDiego,
    immediate: true,
    suppressInitialResume: true,
    userLocation: DEFAULT_LOCATION,
    userSkillLevel,
    onRequest: () => recordHomeDiscoveryRequest("fallback"),
  });

  const shouldUseFallback = primaryReturnedEmpty && !alreadySanDiego;
  const discovery = shouldUseFallback
    ? fallbackDiscovery
    : primaryDiscovery;
  const discoveryLoading = primaryLoading || (shouldUseFallback && fallbackLoading);
  // Surface a hard error so the consumer can distinguish "still bootstrapping"
  // (discovery hasn't run yet because profile/geo isn't ready) from "discovery
  // failed." Prefer the active query's error.
  const discoveryError = (shouldUseFallback ? fallbackError : primaryError) ?? null;

  const recommendationUnavailable =
    discovery?.recommendationAvailability?.state === "none";
  const topRecommendation = recommendationUnavailable
    ? null
    : discovery?.recommendations[0] ?? null;
  const remainingSpots = recommendationUnavailable
    ? []
    : discovery?.recommendations.slice(1) ?? [];

  // ------------------------------------------------------------------
  // Hero photo — three-tier fallback
  // ------------------------------------------------------------------

  // Tier 1: check FALLBACK_IMAGE_BY_NAME synchronously
  const fallbackByName = getFallbackImageForBeach(homeBeach);

  // Tier 2: async fetch from getBestBeachPhotosAction
  const fetchBeachPhoto = useCallback(async (): Promise<string | null> => {
    // If we already have a name-keyed fallback there is no need for a round trip
    if (fallbackByName !== null) return null;
    if (!homeBeach?.id) return null;

    try {
      const { getBestBeachPhotosAction } = await import(
        "@/actions/beach-media-actions"
      );
      const result = await getBestBeachPhotosAction(homeBeach.id, 1);
      const photos = result?.data;
      if (photos && photos.length > 0 && photos[0].public_url) {
        return photos[0].public_url;
      }
      return null;
    } catch {
      return null;
    }
  }, [homeBeach?.id, fallbackByName]);

  const { data: fetchedPhotoUrl, loading: photoFetchLoading } = useDataFetcher(
    fetchBeachPhoto,
    {
      // Skip when we already resolved via name map, or have no home beach
      skip: fallbackByName !== null || !homeBeach?.id,
    }
  );

  // Final resolved hero photo URL
  // When no home beach is set, prefer the top recommendation's photo so the
  // hero image matches the beach name shown in the overlay.
  // Falls back to a generic abstract aerial ocean image.
  const heroPhotoUrl = useMemo((): string => {
    if (fallbackByName) return fallbackByName;
    if (fetchedPhotoUrl) return fetchedPhotoUrl;
    if (topRecommendation?.beach?.photo_url) return topRecommendation.beach.photo_url;
    const topBeachFallback = getFallbackImageForBeach(topRecommendation?.beach as Beach | null);
    if (topBeachFallback) return topBeachFallback;
    return FALLBACK_HERO_IMAGE;
  }, [fallbackByName, fetchedPhotoUrl, topRecommendation]);

  const heroPhotoLoading = photoFetchLoading && fallbackByName === null;

  // ------------------------------------------------------------------
  // Animation state — first visit of day
  // ------------------------------------------------------------------
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LAST_ORACLE_REVEAL_KEY);
      const today = getTodayDateString();
      if (stored !== today) {
        setShouldAnimate(true);
      }
    } catch {
      // Ignore storage errors; default to no animation
    }
  }, []);

  const markAnimationPlayed = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          LAST_ORACLE_REVEAL_KEY,
          getTodayDateString()
        );
      }
    } catch {
      // Ignore storage errors
    }
    setShouldAnimate(false);
  }, []);

  // ------------------------------------------------------------------
  // Reduced motion
  // ------------------------------------------------------------------
  const reducedMotion = useReducedMotion();

  // ------------------------------------------------------------------
  // Return
  // ------------------------------------------------------------------
  return {
    profile,
    profileLoading,
    homeBeach,
    refreshProfile,
    heroPhotoUrl,
    heroPhotoLoading,
    discovery,
    discoveryLoading,
    discoveryError,
    topRecommendation,
    remainingSpots,
    shouldAnimate: shouldAnimate && !reducedMotion,
    markAnimationPlayed,
    reducedMotion,
    userLocation,
    geoSource,
    requestLocation,
    geoLoading,
    userSkillLevel,
  };
}

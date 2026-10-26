"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProfileContext } from "@/context/profile-context";
import { readRecentFix, useGeolocation } from "@/hooks/use-geolocation";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";
import {
  FALLBACK_IMAGE_BY_NAME,
} from "@/lib/constants/featured-beaches-config";
import { resolveApproximateOrigin } from "@/lib/location/approximate-origin";
import { parseIPLocationCookie } from "@/lib/location/ip-location";
import { IP_LOCATION_COOKIE } from "@/lib/location/types";
import type { Coordinates } from "@/lib/types/coordinates";
import type { Profile, Beach } from "@/types/database";
import type {
  SurfDiscoveryResponse,
  SurfDiscoveryRecommendation,
  SurfDiscoveryScope,
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

type HomeOriginSource =
  | "selectedBeach"
  | "browser"
  | "recentFix"
  | "homeBeach"
  | "ip"
  | "lastBeach";

/** Where Home scouts from, and how much to trust it. */
export interface HomeOrigin {
  lat: number;
  lon: number;
  source: HomeOriginSource;
  /** True for IP and last-beach evidence; the screen says so and offers a correction. */
  approximate: boolean;
  label: string | null;
}

type NearestBeach = NonNullable<SurfDiscoveryScope["nearestBeach"]>;

export interface OracleData {
  profile: Profile | null;
  /** True while the profile fetch is in flight (cache may still expose a profile). */
  profileLoading: boolean;
  homeBeach: Beach | null;
  refreshProfile: () => void;
  /** Real photo of the beach the hero shows; null when none exists. */
  heroPhotoUrl: string | null;
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
  /** Coordinates discovery ran from; null until an origin resolves. */
  userLocation: { lat: number; lon: number } | null;
  origin: HomeOrigin | null;
  /** No location evidence at all: the screen asks the surfer to pick a place. */
  locationUnresolved: boolean;
  /** The drive range held no beach, so results come from up to 100 miles out. */
  widenedFromMiles: number | null;
  /** Nothing within 100 miles; the closest beach the surfer can scout from. */
  nearestBeach: NearestBeach | null;
  scoutFromBeach: (beach: NearestBeach) => void;
  geoSource: string;
  requestLocation: () => void;
  geoLoading: boolean;
  /** Report that a surf call became visible (time-to-call metric). */
  recordCallRendered: (details: { recheck: boolean }) => void;
  /** Parsed user skill level from profile (for frontend skill comparisons) */
  userSkillLevel: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const LAST_ORACLE_REVEAL_KEY = "lastOracleReveal";

// ============================================================================
// Helpers
// ============================================================================

function readIPCookie(): string | undefined {
  const prefix = `${IP_LOCATION_COOKIE}=`;
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}

interface StoredLocationEvidence {
  recentFix: Coordinates | null;
  ip: { lat: number; lon: number; label: string } | null;
}

function readStoredLocationEvidence(): StoredLocationEvidence {
  const approximate = resolveApproximateOrigin({
    ip: parseIPLocationCookie(readIPCookie()),
    browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    now: new Date(),
  });
  return {
    recentFix: readRecentFix(),
    ip: approximate ? { lat: approximate.lat, lon: approximate.lon, label: approximate.label } : null,
  };
}

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
 * - useProfileContext — shared profile + home beach
 * - useGeolocation — browser fixes and the last beach a session was logged at
 * - useSurfDiscovery — surf recommendations
 * - Beach photo fetching — with three-tier fallback
 * - Animation state — first-visit-of-day detection via localStorage
 * - useReducedMotion — respects prefers-reduced-motion
 */
export function useOracleData(): OracleData {
  const { recordRequest: recordHomeDiscoveryRequest, recordCallRendered } =
    useHomeDiscoveryRequestMetrics();

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  const { profile, homeBeach, refreshProfile, isLoading: profileLoading } = useProfileContext();

  // ------------------------------------------------------------------
  // Origin — scouting choice > browser fix > fix ≤24 h > home beach >
  // timezone-corroborated IP > last beach. Nothing else: with no evidence the
  // screen asks for a place instead of borrowing one.
  // ------------------------------------------------------------------
  const homeBeachCoords = useMemo(() => {
    if (homeBeach?.lat != null && homeBeach?.lon != null &&
      Number.isFinite(homeBeach.lat) && Math.abs(homeBeach.lat) <= 90 &&
      Number.isFinite(homeBeach.lon) && Math.abs(homeBeach.lon) <= 180) {
      return { lat: homeBeach.lat, lon: homeBeach.lon };
    }
    return null;
  }, [homeBeach?.lat, homeBeach?.lon]);

  const {
    coords: geoCoords,
    loading: geoLoading,
    source: geoSource,
    lastBeach,
    requestLocation: requestBrowserLocation,
  } = useGeolocation({
    autoRequest: false,
    enablePolling: true,
    pollingIntervalMs: 5 * 60 * 1000,
    minDistanceChangeMeters: 1000,
    monitoringContext: "home",
  });

  // Storage and cookies are read after mount so the server render and the
  // first client render agree; discovery waits for this.
  const [storedEvidence, setStoredEvidence] = useState<StoredLocationEvidence | null>(null);
  useEffect(() => {
    setStoredEvidence(readStoredLocationEvidence());
  }, []);

  const [selectedBeach, setSelectedBeach] = useState<NearestBeach | null>(null);
  const scoutFromBeach = useCallback((beach: NearestBeach): void => {
    setSelectedBeach(beach);
  }, []);
  const requestLocation = useCallback((): void => {
    setSelectedBeach(null);
    requestBrowserLocation();
  }, [requestBrowserLocation]);

  const origin = useMemo((): HomeOrigin | null => {
    if (!storedEvidence) return null;
    if (selectedBeach) {
      return { lat: selectedBeach.lat, lon: selectedBeach.lon, source: "selectedBeach", approximate: false, label: selectedBeach.name };
    }
    if (geoSource === "browser" && geoCoords) {
      return { lat: geoCoords.lat, lon: geoCoords.lon, source: "browser", approximate: false, label: null };
    }
    if (storedEvidence.recentFix) {
      return { ...storedEvidence.recentFix, source: "recentFix", approximate: false, label: null };
    }
    if (homeBeachCoords) {
      return { ...homeBeachCoords, source: "homeBeach", approximate: false, label: homeBeach?.name ?? null };
    }
    if (storedEvidence.ip) {
      return { ...storedEvidence.ip, source: "ip", approximate: true };
    }
    if (lastBeach) {
      return { lat: lastBeach.lat, lon: lastBeach.lon, source: "lastBeach", approximate: true, label: lastBeach.name?.trim() || null };
    }
    return null;
  }, [storedEvidence, selectedBeach, geoSource, geoCoords, homeBeachCoords, homeBeach?.name, lastBeach]);

  const originLat = origin?.lat;
  const originLon = origin?.lon;
  const userLocation = useMemo(
    () => originLat !== undefined && originLon !== undefined ? { lat: originLat, lon: originLon } : null,
    [originLat, originLon],
  );
  const locationUnresolved = storedEvidence !== null && !profileLoading && origin === null;

  // ------------------------------------------------------------------
  // Skill level (parsed from profile for cache invalidation + frontend display)
  // ------------------------------------------------------------------
  const userSkillLevel = (profile as Record<string, unknown> | null)?.experience_level as string | null ?? null;

  const locationReadyRef = useRef(!geoLoading);
  useEffect(() => {
    if (!geoLoading) locationReadyRef.current = true;
  }, [geoLoading]);
  // Later GPS checks must not disable discovery when the coordinates have not changed.
  const discoveryEnabled =
    !!profile && userLocation !== null && (!geoLoading || locationReadyRef.current);

  // ------------------------------------------------------------------
  // Surf discovery
  // ------------------------------------------------------------------
  const {
    discovery,
    loading: discoveryLoading,
    error,
  } = useSurfDiscovery({
    maxResults: 10,
    horizonHours: 24,
    enabled: discoveryEnabled,
    immediate: true,
    suppressInitialResume: true,
    userLocation: userLocation ?? undefined,
    userSkillLevel,
    widenEmptyRange: true,
    onRequest: () => recordHomeDiscoveryRequest("primary"),
  });
  // Surface a hard error so the consumer can distinguish "still bootstrapping"
  // (discovery hasn't run yet because profile/geo isn't ready) from "discovery
  // failed."
  const discoveryError = error ?? null;
  const widenedFromMiles = discovery?.scope?.widenedFromMiles ?? null;
  const nearestBeach = discovery?.scope?.nearestBeach ?? null;

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

  // The photo must be of the beach the hero names. Home-beach photos only
  // apply while the hero IS the home beach (or before discovery picks one);
  // a regional best elsewhere uses its own photo. No stock fallback: the hero
  // shows the map instead of an ocean that isn't this beach.
  const heroPhotoUrl = useMemo((): string | null => {
    const topBeach = topRecommendation?.beach;
    const heroIsHome = !topBeach || !homeBeach || topBeach.id === homeBeach.id;
    if (heroIsHome && fallbackByName) return fallbackByName;
    if (heroIsHome && fetchedPhotoUrl) return fetchedPhotoUrl;
    if (topBeach?.photo_url) return topBeach.photo_url;
    return getFallbackImageForBeach((topBeach as Beach | undefined) ?? null);
  }, [fallbackByName, fetchedPhotoUrl, homeBeach, topRecommendation]);

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
    origin,
    locationUnresolved,
    widenedFromMiles,
    nearestBeach,
    scoutFromBeach,
    geoSource,
    requestLocation,
    geoLoading,
    userSkillLevel,
    recordCallRendered,
  };
}

"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BookOpen, X } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useBeachSearch } from "@/hooks/use-beach-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import { Button } from "@/components/ui/button";
import {
  MAP_REGION_PILLS,
  type MapRegionPill,
} from "@/components/map/map-regions";
import { MapContent } from "@/components/map/map-content";
import { MapLearningPanel } from "@/components/map/map-learning-panel";
import { type SwellLayerId } from "@/components/map/swell-map-theme";
import { useProfileContext } from "@/context/profile-context";
import type { Beach } from "@/types/database";

const MISSION_BEACH_COORDS = { lat: 32.7702, lon: -117.2525 } as const;

// Shared with use-geolocation / use-nearest-beach. The two writers disagree on
// shape ({lat,lon} vs {id,name}), so the resolver below handles both.
const LAST_BEACH_KEY = "quiver:lastBeach";

function isFiniteCoord(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Resolve the last beach the user was looking at into map coordinates.
 * Accepts both stored shapes: `{lat,lon}` (geolocation writer) directly, or
 * `{id,name}` (session-save writer) by looking the beach up via the API.
 */
async function resolveLastViewedCenter(): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LAST_BEACH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (isFiniteCoord(parsed?.lat) && isFiniteCoord(parsed?.lon)) {
      return { lat: parsed.lat, lon: parsed.lon };
    }

    if (parsed?.id) {
      const res = await fetch(`/api/beaches/${parsed.id}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        const beach = json?.data?.beach ?? json?.beach;
        if (isFiniteCoord(beach?.lat) && isFiniteCoord(beach?.lon)) {
          return { lat: beach.lat, lon: beach.lon };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function MapView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isShareView = searchParams.get("share") === "1";
  const [showFieldGuide, setShowFieldGuide] = useState(false);
  const [mapFocusCenter, setMapFocusCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Tracks the last location we loaded beaches for, to prevent duplicate calls.
  // Seeded with the default center so the userLocation effect below doesn't fire
  // a redundant default-area load before the center resolver (home/last/nearest)
  // has run; the resolver owns the initial load.
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(
    MISSION_BEACH_COORDS
  );
  const preserveSearchStateOnNextUrlClearRef = useRef(false);

  const [showSwellField, setShowSwellField] = useState(true);
  const [swellLayerId, setSwellLayerId] = useState<SwellLayerId>("s1");
  const [swellTimelineIndex, setSwellTimelineIndex] = useState(0);
  const swellTimelineSteps = useMemo(
    () => ["Now", "+3h", "+6h", "+12h", "+18h", "+24h", "+36h", "+48h"],
    []
  );

  // Custom hooks for state management
  const { homeBeach, isLoading: profileLoading } = useProfileContext();

  const {
    userLocation,
    locationError,
    usingDefaultLocation,
    hasTimedOut,
    loading: locationLoading,
    getUserLocation,
    useDefaultLocation: applyDefaultLocation,
  } = useGeolocation({
    useLastBeach: false,
    defaultLocation: MISSION_BEACH_COORDS,
    // Don't auto-prompt for GPS: a signed-in home beach or last-viewed beach
    // should center the map first (and skip the permission prompt entirely).
    // GPS is requested only as the final fallback, in the resolver effect below.
    autoRequest: false,
  });

  const {
    filteredBeaches,
    searchQuery,
    selectedBeach,
    filters,
    loadNearbyBeaches,
    setSearchQuery,
    clearSearch,
    setSelectedBeach,
    toggleBeginnerFriendly,
    toggleBreakType,
    clearAllFilters,
  } = useBeachSearch();

  // Load nearby beaches when user location is available - prevent duplicate calls
  // Wait for geolocation to resolve before fetching to avoid using stale fallback coords
  useEffect(() => {
    if (!userLocation || locationLoading) {
      return;
    }

    // A home/last/region focus center owns the map and its own beach load; don't
    // override it with the userLocation (default or GPS) load.
    if (mapFocusCenter) {
      return;
    }

    // Check if we've already loaded beaches for this location
    const lastLocation = lastLocationRef.current;
    if (
      lastLocation &&
      Math.abs(lastLocation.lat - userLocation.lat) < 0.001 &&
      Math.abs(lastLocation.lon - userLocation.lon) < 0.001
    ) {
      return; // Same location, don't reload
    }

    // Update the last location and load nearby beaches
    lastLocationRef.current = userLocation;
    loadNearbyBeaches(userLocation.lat, userLocation.lon);
  }, [userLocation, locationLoading, loadNearbyBeaches, mapFocusCenter]);

  // Resolve the initial map center once, in priority order: signed-in home
  // beach → last beach the user was looking at → nearest to their GPS location.
  // Gated on `profileLoading` so a signed-in user's home beach wins before any
  // fallback fires (and we never prompt for GPS when we already have a center).
  const initialCenterResolvedRef = useRef(false);
  useEffect(() => {
    if (initialCenterResolvedRef.current) return;
    if (profileLoading) return;

    let cancelled = false;

    const centerOn = (lat: number, lon: number) => {
      if (cancelled) return;
      initialCenterResolvedRef.current = true;
      setMapFocusCenter({ lat, lon });
      lastLocationRef.current = { lat, lon };
      void loadNearbyBeaches(lat, lon);
    };

    // 1. Signed-in home beach.
    if (homeBeach && isFiniteCoord(homeBeach.lat) && isFiniteCoord(homeBeach.lon)) {
      centerOn(homeBeach.lat, homeBeach.lon);
      return;
    }

    // 2. Last beach the user was looking at, then 3. nearest to their location.
    void (async () => {
      const last = await resolveLastViewedCenter();
      if (cancelled || initialCenterResolvedRef.current) return;
      if (last) {
        centerOn(last.lat, last.lon);
        return;
      }
      // 3. Nearest to the user — only now do we request GPS. Load the default
      // area first as a baseline so a denied or slow GPS still shows beaches;
      // a granted GPS fix updates userLocation and the effect above reloads.
      initialCenterResolvedRef.current = true;
      lastLocationRef.current = { ...MISSION_BEACH_COORDS };
      void loadNearbyBeaches(MISSION_BEACH_COORDS.lat, MISSION_BEACH_COORDS.lon);
      getUserLocation();
    })();

    return () => {
      cancelled = true;
    };
  }, [profileLoading, homeBeach, loadNearbyBeaches, getUserLocation]);

  // Hydrate deep-linked search state from the URL. Local toolbar edits may strip the
  // stale URL param without clearing the active input state.
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl === null) {
      if (preserveSearchStateOnNextUrlClearRef.current) {
        preserveSearchStateOnNextUrlClearRef.current = false;
        return;
      }
      setSearchQuery("");
      return;
    }

    preserveSearchStateOnNextUrlClearRef.current = false;
    setSearchQuery(searchFromUrl);
    if (searchFromUrl) {
      setMapFocusCenter(null);
    }
  }, [searchParams, setSearchQuery]);

  // Apply filters from URL params on initial mount (e.g. /map?type=reef or /map?level=beginner)
  const VALID_BREAK_TYPES = new Set(["beach", "point", "reef", "longboard", "bodyboard"]);
  const urlFiltersAppliedRef = useRef(false);
  useEffect(() => {
    if (urlFiltersAppliedRef.current) return;
    urlFiltersAppliedRef.current = true;

    const typeParam = searchParams.get("type")?.toLowerCase();
    const levelParam = searchParams.get("level");

    if (typeParam && VALID_BREAK_TYPES.has(typeParam)) {
      toggleBreakType(typeParam);
    }
    if (levelParam === "beginner") {
      toggleBeginnerFriendly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      setMapFocusCenter(null);
      setSelectedBeach(beach);
      // Smooth scroll to top to show the selected beach on map
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSelectedBeach]
  );

  const stripMapUrlParams = useCallback(
    (
      keys: readonly string[],
      options?: { preserveSearchState?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      let mutated = false;
      for (const key of keys) {
        if (params.has(key)) {
          params.delete(key);
          mutated = true;
        }
      }
      if (mutated) {
        if (options?.preserveSearchState && keys.includes("search")) {
          preserveSearchStateOnNextUrlClearRef.current = true;
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  // Both clearers write state directly (immediate visual reset) AND strip the URL param.
  // The URL→state effect above will re-sync searchQuery="" on the next tick when the URL
  // update lands — same value, React bails — but skipping the direct hook write would
  // introduce a one-tick window where the UI still shows filtered results.
  const handleClearSearch = useCallback(() => {
    setMapFocusCenter(null);
    clearSearch();
    stripMapUrlParams(["search"]);
    // Reset to nearby beaches when clearing search
    if (userLocation) {
      loadNearbyBeaches(userLocation.lat, userLocation.lon);
    } else {
      getUserLocation();
    }
  }, [clearSearch, stripMapUrlParams, userLocation, loadNearbyBeaches, getUserLocation]);

  const handleSearchChange = useCallback(
    (query: string) => {
      setMapFocusCenter(null);
      setSelectedBeach(null);
      setSearchQuery(query);
      stripMapUrlParams(["search"], { preserveSearchState: true });
    },
    [setSearchQuery, setSelectedBeach, stripMapUrlParams]
  );

  const handleClearAll = useCallback(() => {
    setMapFocusCenter(null);
    clearAllFilters();
    stripMapUrlParams(["search", "type", "level"]);
  }, [clearAllFilters, stripMapUrlParams]);

  const handleUseMyLocation = useCallback(() => {
    setSelectedBeach(null);
    clearSearch();
    setMapFocusCenter(null);
    lastLocationRef.current = null;
    getUserLocation(true);
  }, [clearSearch, getUserLocation, setSelectedBeach]);

  const handleUseDefaultLocation = useCallback(() => {
    setMapFocusCenter(null);
    applyDefaultLocation();
  }, [applyDefaultLocation]);

  const handleRegionSelect = useCallback(
    (region: MapRegionPill) => {
      setSelectedBeach(null);
      clearSearch();
      setMapFocusCenter(region.center);
      stripMapUrlParams(["search"]);
      lastLocationRef.current = null;
      void loadNearbyBeaches(region.center.lat, region.center.lon);
    },
    [clearSearch, loadNearbyBeaches, setSelectedBeach, stripMapUrlParams]
  );

  const handleMapClick = useCallback(() => {
    setMapFocusCenter(null);
    setSelectedBeach(null);
  }, [setSelectedBeach]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.beginnerFriendly ||
    filters.breakTypes.size > 0;

  const selectedBeachForMap = mapFocusCenter ? null : selectedBeach;
  const fieldGuideVisible = showFieldGuide || isShareView;

  const handleOpenFieldGuide = useCallback((): void => {
    setShowFieldGuide(true);
  }, []);

  const handleCloseFieldGuide = useCallback((): void => {
    setShowFieldGuide(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="map-view">
      <MapToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        suggestions={filteredBeaches.slice(0, 6)}
        onSuggestionSelect={handleBeachSelect}
        regions={MAP_REGION_PILLS}
        onRegionSelect={handleRegionSelect}
        onUseMyLocation={handleUseMyLocation}
        filters={filters}
        onToggleBeginner={toggleBeginnerFriendly}
        onToggleBreakType={toggleBreakType}
        onClearAll={handleClearAll}
        hasActiveFilters={hasActiveFilters}
        showSwellField={showSwellField}
        onToggleSwellField={() => setShowSwellField((v) => !v)}
      />

      <div className="border-b bg-background px-3 py-2 sm:px-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={fieldGuideVisible}
            aria-controls="map-field-guide-panel"
            data-testid="map-field-guide-toggle"
            onClick={handleOpenFieldGuide}
            className="h-10 w-full justify-center whitespace-nowrap px-3 text-xs sm:w-auto sm:text-sm"
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            How to read this map
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={
          fieldGuideVisible
            ? "grid flex-1 grid-rows-[minmax(320px,1fr)_auto] min-h-0 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-1"
            : "grid flex-1 grid-rows-1 min-h-0"
        }
      >
        <div className="relative min-h-0 flex flex-col">
          <MapContent
            loading={false}
            locationError={locationError}
            usingDefaultLocation={usingDefaultLocation}
            hasTimedOut={hasTimedOut}
            userLocation={userLocation}
            focusCenter={mapFocusCenter}
            selectedBeach={selectedBeachForMap}
            filteredBeaches={filteredBeaches}
            searchQuery={searchQuery}
            regionViewport={null}
            onGetUserLocation={handleUseMyLocation}
            onUseDefaultLocation={handleUseDefaultLocation}
            onBeachSelect={handleBeachSelect}
            onMapClick={handleMapClick}
            autoNavigateOnMarkerClick={true}
            showSwellField={showSwellField}
            swellLayerId={swellLayerId}
            onSwellLayerChange={setSwellLayerId}
            swellTimelineSteps={swellTimelineSteps}
            swellTimelineIndex={swellTimelineIndex}
            onSwellTimelineChange={setSwellTimelineIndex}
          />
        </div>
        {fieldGuideVisible && (
          <div id="map-field-guide-panel" className="relative min-h-0">
            {showFieldGuide && !isShareView && (
              <button
                type="button"
                aria-label="Close map field guide"
                onClick={handleCloseFieldGuide}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#11100D]/20 bg-[#F5EEDC] text-[#11100D] shadow-sm transition-colors hover:bg-[#F4EBD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A75]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <MapLearningPanel />
          </div>
        )}
      </div>
    </div>
  );
}
